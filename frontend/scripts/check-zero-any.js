import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

function getAllTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTsFiles(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  }
  return results;
}

const files = getAllTsFiles(srcDir);
let anyCount = 0;
let asAnyCount = 0;
const violations = [];

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

  function walk(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      anyCount++;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push(`[AnyKeyword] ${path.relative(srcDir, file)}:${line + 1}:${character + 1}`);
    }
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);

  const asAnyRegex = /\bas\s+any\b/g;
  let match;
  while ((match = asAnyRegex.exec(code)) !== null) {
    asAnyCount++;
    const beforeLines = code.substring(0, match.index).split('\n');
    const line = beforeLines.length;
    violations.push(`[as any] ${path.relative(srcDir, file)}:${line}`);
  }
}

console.log('='.repeat(60));
console.log('🔍 METRO 2 BCS: ZERO-ANY MANDATE VERIFICATION');
console.log('='.repeat(60));
console.log(`📁 Scanned files: ${files.length}`);
console.log(`❌ AnyKeyword count: ${anyCount}`);
console.log(`❌ "as any" matches: ${asAnyCount}`);

if (violations.length > 0) {
  console.error('\n🚨 VIOLATIONS DETECTED:');
  violations.forEach((v) => console.error(`  ${v}`));
  process.exit(1);
} else {
  console.log('\n✅ 100% CLEAN: Zero "any" or "as any" detected in codebase!');
  process.exit(0);
}
