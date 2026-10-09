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

function checkAttributes(tagName, attributes, sourceFile, filePath, node) {
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
            classNameVal = prop.initializer.expression.getText();
          }
        }
      }
    }
  }

  // Conditions to flag:
  // 1. If tagName is 'button' and doesn't contain cursor-pointer or cursor-
  // 2. If non-button element has onClick and doesn't contain cursor-pointer
  const hasCursor = /cursor-(pointer|not-allowed|default)/.test(classNameVal) || classNameVal.includes('cursor-pointer');
  
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

  console.log(`\nSample warnings (first 5 of ${warnings.length}):`);
  warnings.slice(0, 5).forEach((w) => {
    console.log(`  [Line ${w.line}] ${w.file} -> ${w.tag}: ${w.issue}`);
  });
} else {
  console.log('\n✅ 100% CLEAN: All interactive buttons and click handlers have cursor-pointer!');
}
