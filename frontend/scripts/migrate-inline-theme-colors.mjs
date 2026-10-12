#!/usr/bin/env node
/**
 * Codemod Dark Mode (Rule §7): chuyển mã hex trong inline style sang CSS variables theo thuộc tính.
 *
 *   node scripts/migrate-inline-theme-colors.mjs --dry-run   # chỉ thống kê
 *   node scripts/migrate-inline-theme-colors.mjs             # ghi file
 *
 * Phạm vi an toàn (AST, TypeScript compiler API):
 *  - Chỉ object literal nằm trong JSX `style={{ ... }}` hoặc object có kiểu `CSSProperties`
 *    (annotation `: React.CSSProperties` / `as CSSProperties` / `satisfies CSSProperties`).
 *  - KHÔNG chạm: pathOptions Leaflet, ctx.fillStyle canvas, thuộc tính JSX `color="#..."`, boxShadow.
 *  - Chỉ thay khi (thuộc tính, hex) có biến tối tương ứng → chế độ Sáng giữ nguyên từng pixel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { buildThemeTokens } from '../theme/themeTokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../src');
const DRY = process.argv.includes('--dry-run');

const { varIndex } = buildThemeTokens();

const PROP_KIND = {
  background: 'bg', backgroundColor: 'bg', backgroundImage: 'bg',
  color: 'text', caretColor: 'text',
  border: 'border', borderColor: 'border',
  borderTop: 'border', borderBottom: 'border', borderLeft: 'border', borderRight: 'border',
  borderTopColor: 'border', borderBottomColor: 'border', borderLeftColor: 'border', borderRightColor: 'border',
  outline: 'border', outlineColor: 'border',
};

/** File vẽ canvas / watermark — không áp codemod. */
const EXCLUDE = [/utils[\\/]watermarkEngine\.ts$/];

const HEX_RE = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

const normalizeHex = (h) => {
  let x = h.slice(1).toLowerCase();
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  return '#' + x;
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const isCssPropsType = (typeNode) =>
  !!typeNode && /\bCSSProperties\b/.test(typeNode.getText());

function isStyleObject(node) {
  const parent = node.parent;
  if (!parent) return false;
  // style={{ ... }}
  if (ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent)) {
    return parent.parent.name.getText() === 'style';
  }
  // const s: React.CSSProperties = { ... }
  if (ts.isVariableDeclaration(parent) && isCssPropsType(parent.type)) return true;
  // { ... } as CSSProperties / satisfies CSSProperties
  if ((ts.isAsExpression(parent) || ts.isSatisfiesExpression?.(parent)) && isCssPropsType(parent.type)) return true;
  // Hàm trả về CSSProperties: (): React.CSSProperties => ({ ... })
  if (ts.isParenthesizedExpression(parent)) {
    const fn = parent.parent;
    if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && isCssPropsType(fn.type)) return true;
  }
  if (ts.isReturnStatement(parent)) {
    let fn = parent.parent;
    while (fn && !ts.isFunctionLike(fn)) fn = fn.parent;
    if (fn && isCssPropsType(fn.type)) return true;
  }
  // Spread trong style: style={{ ...base, x }} đã được bắt ở trên; object con của ternary trong style
  if (ts.isConditionalExpression(parent) || ts.isParenthesizedExpression(parent)) {
    let p = parent;
    while (p && (ts.isConditionalExpression(p) || ts.isParenthesizedExpression(p))) p = p.parent;
    if (p && ts.isJsxExpression(p) && p.parent && ts.isJsxAttribute(p.parent)) return p.parent.name.getText() === 'style';
  }
  return false;
}

const stats = { files: 0, replacements: 0, unmatched: new Map(), perFile: [] };

function replaceInText(text, kind) {
  let count = 0;
  const unmatched = [];
  const replaced = text.replace(HEX_RE, (m) => {
    const hex = normalizeHex(m);
    const name = varIndex[kind][hex];
    if (!name) {
      unmatched.push(hex);
      return m;
    }
    count++;
    return `rgb(var(${name}))`;
  });
  return { replaced, count, unmatched };
}

for (const file of walk(SRC)) {
  if (EXCLUDE.some((re) => re.test(file))) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (!HEX_RE.test(source) && !/'white'/.test(source)) continue;
  HEX_RE.lastIndex = 0;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  /** @type {{start:number,end:number,text:string}[]} */
  const edits = [];
  let fileCount = 0;

  const visitInitializer = (node, kind) => {
    const handleLiteral = (lit, innerStart, innerEnd) => {
      const raw = source.slice(innerStart, innerEnd);
      if (kind === 'bg' && raw === 'white') {
        edits.push({ start: innerStart, end: innerEnd, text: `rgb(var(${varIndex.bg['#ffffff']}))` });
        fileCount++;
        return;
      }
      const { replaced, count, unmatched } = replaceInText(raw, kind);
      unmatched.forEach((h) => stats.unmatched.set(`${kind}:${h}`, (stats.unmatched.get(`${kind}:${h}`) || 0) + 1));
      if (count > 0) {
        edits.push({ start: innerStart, end: innerEnd, text: replaced });
        fileCount += count;
      }
    };
    const visit = (n) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        handleLiteral(n, n.getStart(sf) + 1, n.getEnd() - 1);
        return;
      }
      if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
        // Head: `...${  Middle: }...${  Tail: }...`
        const start = n.getStart(sf) + 1;
        const end = n.getEnd() - (ts.isTemplateTail(n) ? 1 : 2);
        handleLiteral(n, start, end);
        return;
      }
      // Không đi vào object lồng (sẽ được xử lý riêng nếu là style object)
      if (ts.isObjectLiteralExpression(n)) return;
      ts.forEachChild(n, visit);
    };
    visit(node);
  };

  const visitor = (node) => {
    if (ts.isObjectLiteralExpression(node) && isStyleObject(node)) {
      for (const prop of node.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const key = prop.name.getText(sf).replace(/['"]/g, '');
        const kind = PROP_KIND[key];
        if (kind) visitInitializer(prop.initializer, kind);
      }
    }
    ts.forEachChild(node, visitor);
  };
  visitor(sf);

  if (edits.length === 0) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  stats.files++;
  stats.replacements += fileCount;
  stats.perFile.push([path.relative(SRC, file), fileCount]);
  if (!DRY) fs.writeFileSync(file, out);
}

stats.perFile.sort((a, b) => b[1] - a[1]);
console.log(`${DRY ? '[DRY-RUN] ' : ''}Files changed: ${stats.files}, replacements: ${stats.replacements}`);
for (const [f, c] of stats.perFile) console.log(`  ${String(c).padStart(4)}  ${f}`);
const um = [...stats.unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('\nHex giữ nguyên (không có biến tối cho thuộc tính đó — đa phần là màu nhấn/nút, đúng thiết kế):');
for (const [k, c] of um) console.log(`  ${String(c).padStart(4)}  ${k}`);
