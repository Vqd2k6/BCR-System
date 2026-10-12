import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '../src');

/**
 * Script kiểm tra kỷ luật Theme (Rule §7):
 * Ngăn chặn việc viết hardcode mã màu hex trung tính trong style={{ ... }}
 * thay vì sử dụng CSS variables (rgb(var(--bg-*)), rgb(var(--text-*)), rgb(var(--border-*)))
 * hoặc class Tailwind.
 */

// Danh sách mã màu hex trung tính sáng/tối cần được thay bằng CSS variables
const FORBIDDEN_NEUTRAL_HEXES = new Set([
  '#fff',
  '#ffffff',
  '#f8fafc',
  '#f1f5f9',
  '#e2e8f0',
  '#cbd5e1',
  '#0f172a',
  '#1e293b',
  '#334155',
  '#475569',
  '#64748b',
]);

// Danh sách các file hoặc vùng ngoại lệ kỹ thuật hợp lệ
const ALLOWLISTED_FILES = [
  'src/utils/watermarkEngine.ts', // Canvas watermark trên backend/stream
  'src/components/canvas/SignaturePad.tsx', // Vùng ký tên chuẩn giấy trắng
  'src/components/common/photo-capture/components/PhotoLightboxModal.tsx', // Viewfinder kính ngắm camera
  'src/components/common/photo-capture/components/LiveCameraModal.tsx', // Viewfinder camera
  'src/components/common/photo-capture/components/PhotoWatermarkOverlay.tsx', // Lớp phủ watermark trên ảnh
  'src/components/attendance/companion/components/CompanionCheckInForm.tsx', // Video viewfinder
  'src/views/surveyor/timekeeping/components/CheckInForm.tsx', // Video viewfinder
  'src/components/common/photo-capture/components/PhotoPreviewCard.tsx', // Dark photo frame
  'src/main.tsx', // Dev error boundary khẩn cấp
];

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
const violations = [];

for (const file of files) {
  const relPath = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
  if (ALLOWLISTED_FILES.some((allowed) => relPath.endsWith(allowed) || relPath === allowed)) {
    continue;
  }

  const code = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

  function checkProperty(prop, lineNum) {
    if (!ts.isPropertyAssignment(prop)) return;
    const name = prop.name.getText(sourceFile);
    const initText = prop.initializer.getText(sourceFile);

    // Kiểm tra các thuộc tính nhạy cảm với theme: background, color, border
    const isThemeProp = /^(background|backgroundColor|color|borderColor|border|borderTop|borderBottom|borderLeft|borderRight)$/i.test(name);
    if (!isThemeProp) return;

    // Ngoại lệ: chữ trắng trên nền nút màu đậm (VD: button background màu primary/brand/danger với color: '#ffffff')
    if (name === 'color' && (initText.includes('#ffffff') || initText.includes('#f8fafc') || initText.includes('#fff'))) {
      // Bỏ qua nếu là chữ trắng (được dùng trên badge/button màu tối hoặc màu nhấn)
      return;
    }

    for (const hex of FORBIDDEN_NEUTRAL_HEXES) {
      const regex = new RegExp(`['"\`][^'"\`]*${hex}\\b`, 'i');
      if (regex.test(initText)) {
        violations.push({
          file: relPath,
          line: lineNum,
          property: name,
          value: initText,
          hex,
        });
      }
    }
  }

  function walk(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'style') {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const expr = node.initializer.expression;
        if (ts.isObjectLiteralExpression(expr)) {
          for (const prop of expr.properties) {
            checkProperty(prop, line + 1);
          }
        }
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
}

console.log('='.repeat(70));
console.log('🔍 KIỂM TRA KỶ LUẬT CHẾ ĐỘ NỀN TỐI (RULE §7 - THEME COMPLIANCE AUDIT)');
console.log('='.repeat(70));

if (violations.length > 0) {
  console.error(`\n❌ Phát hiện ${violations.length} vị trí vi phạm dùng mã màu hex trung tính trong style={{}}:\n`);
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> ${v.property}: ${v.value} (chứa ${v.hex})`);
  }
  console.error('\n💡 Hướng dẫn sửa:');
  console.error('  1. Dùng class Tailwind tương ứng (VD: bg-white, text-slate-800, border-slate-200)');
  console.error('  2. Hoặc dùng CSS variable: rgb(var(--bg-*)), rgb(var(--text-*)), rgb(var(--border-*))');
  console.error('  3. Xem hướng dẫn tại Rule §7 trong .agents/rules/architectural_standards_and_system_rules.md\n');
  process.exit(1);
} else {
  console.log('\n✅ 100% mã nguồn tuân thủ kỷ luật Dark Mode: Không phát sinh hex trung tính trong style={{}}!\n');
  process.exit(0);
}
