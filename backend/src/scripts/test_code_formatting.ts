import assert from 'assert';

function formatShortUnitDisplay(unitCode?: string | null): string {
  if (!unitCode) return '';
  const trimmed = unitCode.trim();
  const parts = trimmed.split('.');

  if (parts.length > 1) {
    const prefix = parts[0].toUpperCase();
    const suffix = parts.slice(1).join('.');

    if (prefix.startsWith('T')) {
      return `M${suffix}`;
    }
    return suffix;
  }
  return trimmed;
}

function formatShortParcelDisplay(parcelCode?: string | null): string {
  if (!parcelCode) return '---';
  const trimmed = parcelCode.trim();

  const bMatch = trimmed.match(/(B-?\d{3,5})/i);
  if (bMatch) {
    const raw = bMatch[1].toUpperCase();
    return raw.includes('-') ? raw : `B-${raw.substring(1)}`;
  }

  const lotMatch = trimmed.match(/(LÔ\s*\d+|THỬA\s*\d+)/i);
  if (lotMatch) {
    return lotMatch[1].toUpperCase();
  }

  if (trimmed.length > 14) {
    return `${trimmed.slice(0, 12)}...`;
  }

  return trimmed;
}

function runFormattingTests() {
  console.log('🧪 [TEST] Kiểm thử tiện ích format code hiển thị cho Surveyor...');

  // 1. Căn hộ tầng bình thường
  assert.strictEqual(formatShortUnitDisplay('08.01'), '01', '08.01 -> 01');
  assert.strictEqual(formatShortUnitDisplay('08.02'), '02', '08.02 -> 02');
  assert.strictEqual(formatShortUnitDisplay('15.10'), '10', '15.10 -> 10');

  // 2. Căn hộ tầng lửng
  assert.strictEqual(formatShortUnitDisplay('MEZZ.01'), '01', 'MEZZ.01 -> 01');
  assert.strictEqual(formatShortUnitDisplay('MEZZ.05'), '05', 'MEZZ.05 -> 05');

  // 3. Khu vực dùng chung Master (có tiền tố T)
  assert.strictEqual(formatShortUnitDisplay('TB01.01'), 'M01', 'TB01.01 -> M01');
  assert.strictEqual(formatShortUnitDisplay('T08.01'), 'M01', 'T08.01 -> M01');
  assert.strictEqual(formatShortUnitDisplay('TROOF.02'), 'M02', 'TROOF.02 -> M02');

  // 4. Mã không có dấu chấm
  assert.strictEqual(formatShortUnitDisplay('402'), '402', '402 -> 402');
  assert.strictEqual(formatShortUnitDisplay(''), '', 'empty -> empty');

  // 5. Mã thửa đất rút gọn
  assert.strictEqual(formatShortParcelDisplay('C&C-05-B-0039'), 'B-0039', 'C&C-05-B-0039 -> B-0039');
  assert.strictEqual(formatShortParcelDisplay('CRLG_METRO2_Z01_B0039'), 'B-0039', 'B0039 -> B-0039');
  assert.strictEqual(formatShortParcelDisplay('B-0039'), 'B-0039', 'B-0039 -> B-0039');
  assert.strictEqual(formatShortParcelDisplay('Thửa 125'), 'THỬA 125', 'Thửa 125 -> THỬA 125');

  console.log('✅ [PASSED] Tất cả 13 test cases định dạng hiển thị đều đạt chuẩn 100%!');
}

runFormattingTests();
