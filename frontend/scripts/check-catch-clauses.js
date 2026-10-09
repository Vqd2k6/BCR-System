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
let totalCatch = 0;
const emptyCatches = [];
const swallowedCatches = [];
const validCatches = [];

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

  function walk(node) {
    if (ts.isCatchClause(node)) {
      totalCatch++;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const relPath = path.relative(srcDir, file);
      const locStr = `${relPath}:${line + 1}:${character + 1}`;

      const statements = node.block.statements;
      if (statements.length === 0) {
        emptyCatches.push({ loc: locStr, file: relPath, line: line + 1 });
      } else {
        const bodyText = node.block.getText();
        const hasErrorLog =
          bodyText.includes('console.error') ||
          bodyText.includes('console.warn') ||
          bodyText.includes('reportDevError') ||
          bodyText.includes('__reportDevError');
        const hasThrow = /\bthrow\s+/.test(bodyText);

        if (!hasErrorLog && !hasThrow) {
          swallowedCatches.push({ loc: locStr, file: relPath, line: line + 1 });
        } else {
          validCatches.push({ loc: locStr, file: relPath, line: line + 1 });
        }
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);
}

console.log('='.repeat(65));
console.log('🛡️  METRO 2 BCS: CATCH CLAUSE & ERROR OBSERVABILITY AUDIT');
console.log('='.repeat(65));
console.log(`📁 Scanned source files: ${files.length}`);
console.log(`🔍 Total catch clauses detected: ${totalCatch}`);
console.log(`✅ Compliant catch clauses (Logged or Rethrown): ${validCatches.length}`);
console.log(`❌ Empty catch clauses (Total silence): ${emptyCatches.length}`);
console.log(`⚠️  Swallowed catch clauses (No error log / throw): ${swallowedCatches.length}`);

if (emptyCatches.length > 0) {
  console.log('\n🚨 Top 15 Empty Catch Clauses to remediate:');
  emptyCatches.slice(0, 15).forEach((c) => {
    console.log(`  [EMPTY CATCH] ${c.loc}`);
  });
}

if (swallowedCatches.length > 0) {
  console.log('\n⚠️  Top 15 Swallowed Catch Clauses to remediate:');
  swallowedCatches.slice(0, 15).forEach((c) => {
    console.log(`  [NO LOG/THROW] ${c.loc}`);
  });
}

console.log('='.repeat(65));
console.log('📌 MANDATE REMINDER:');
console.log('  1. Catch blocks MUST NEVER be empty.');
console.log('  2. Every caught error must be logged with context: console.error("[ModuleName:Action] ...", err)');
console.log('  3. In service/repo layers, rethrow with context: throw err;');
console.log('='.repeat(65));
