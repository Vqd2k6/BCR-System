import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function getAllTsxFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTsxFiles(filePath));
    } else if (file.endsWith('.tsx')) {
      results.push(filePath);
    }
  }
  return results;
}

const files = getAllTsxFiles(srcDir);
const warnings = [];
/** Hằng chuỗi `const X = '...'` của file đang quét, dùng để giải className={X} / clsx(X, ...) */
let fileStringConstants = new Map();

function checkAttributes(tagName, attributes, sourceFile, filePath, node) {
  // Chỉ soát thẻ DOM thật (chữ thường, vd button/div/motion.div). Component tự định nghĩa (<Button>, <PhotoThumbnailCell>...)
  // tự gắn con trỏ trên thẻ DOM bên trong và được kiểm tra tại chính file định nghĩa component đó.
  if (!/^[a-z]/.test(tagName)) return;
  let hasOnClick = false;
  let classNameVal = '';
  let hasDisabled = false;

  for (const prop of attributes.properties) {
    if (ts.isJsxAttribute(prop)) {
      const name = prop.name.getText();
      if (name === 'onClick') {
        hasOnClick = true;
      }
      if (name === 'disabled') {
        hasDisabled = true;
      }
      if (name === 'className') {
        if (prop.initializer) {
          if (ts.isStringLiteral(prop.initializer)) {
            classNameVal = prop.initializer.text;
          } else if (ts.isJsxExpression(prop.initializer) && prop.initializer.expression) {
            const exprText = prop.initializer.expression.getText();
            // className dùng hằng chuỗi khai báo trong cùng file (vd TOOL_BUTTON_CLASS, baseStyles): ghép giá trị hằng để soát
            const resolved = (exprText.match(/[A-Za-z_$][\w$]*/g) || [])
              .map((name) => fileStringConstants.get(name) || "")
              .join(" ");
            classNameVal = `${exprText} ${resolved}`;
          }
        }
      }
    }
  }

  // Conditions to flag:
  // 1. If tagName is 'button' and doesn't contain cursor-pointer or cursor-
  // 2. If non-button element has onClick and doesn't contain cursor-pointer
  // Vùng canvas ghim/kéo dùng con trỏ thao tác chuyên biệt (crosshair/grab/grabbing/move) thay cho pointer
  const hasCursor = /cursor-(pointer|not-allowed|default|crosshair|grab|grabbing|move)\b/.test(classNameVal);
  
  if (tagName === 'button') {
    if (!hasCursor) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      warnings.push({
        file: path.relative(srcDir, filePath),
        line: line + 1,
        col: character + 1,
        tag: '<button>',
        issue: 'Missing cursor-pointer class on <button>',
      });
    }
  } else if (hasOnClick && tagName !== 'input' && tagName !== 'select' && tagName !== 'textarea') {
    if (!hasCursor) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      warnings.push({
        file: path.relative(srcDir, filePath),
        line: line + 1,
        col: character + 1,
        tag: `<${tagName}> with onClick`,
        issue: `Missing cursor-pointer class on interactive <${tagName}> with onClick`,
      });
    }
  }
}

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  fileStringConstants = new Map();
  (function collect(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isStringLiteralLike(node.initializer)) {
      fileStringConstants.set(node.name.text, node.initializer.text);
    }
    ts.forEachChild(node, collect);
  })(sourceFile);

  function walk(node) {
    if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText();
      checkAttributes(tagName, node.openingElement.attributes, sourceFile, file, node.openingElement);
    } else if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText();
      checkAttributes(tagName, node.attributes, sourceFile, file, node);
    }
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);
}

console.log('='.repeat(60));
console.log('👆 METRO 2 BCS: UI INTERACTION & CURSOR-POINTER AUDIT');
console.log('='.repeat(60));
console.log(`📁 Scanned TSX files: ${files.length}`);
console.log(`⚠️  Potential missing cursor-pointer items: ${warnings.length}`);

if (warnings.length > 0) {
  console.log('\n📋 REPORT SUMMARY:');
  const groupedByFile = {};
  warnings.forEach((w) => {
    groupedByFile[w.file] = (groupedByFile[w.file] || 0) + 1;
  });

  const topFiles = Object.entries(groupedByFile).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('Top files with interactive elements to review:');
  topFiles.forEach(([f, count]) => console.log(`  - ${f}: ${count} elements`));

  // Mặc định in 5 mẫu; chạy "npm run check:ui -- --all" để in toàn bộ danh sách cần sửa
  const showAll = process.argv.includes('--all');
  console.log(
    showAll
      ? `\nAll warnings (${warnings.length}):`
      : `\nSample warnings (first 5 of ${warnings.length}; dùng --all để xem đủ):`
  );
  (showAll ? warnings : warnings.slice(0, 5)).forEach((w) => {
    console.log(`  [Line ${w.line}] ${w.file} -> ${w.tag}: ${w.issue}`);
  });
} else {
  console.log('\n✅ 100% CLEAN: All interactive buttons and click handlers have cursor-pointer!');
}
