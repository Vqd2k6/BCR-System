/**
 * Kiểm thử chuẩn hóa tên người trên báo cáo: bỏ dấu thừa, không làm hỏng học hàm hay gộp nhiều người.
 * Chạy: npx ts-node src/scripts/test_format_person_name.ts
 */
import assert from 'node:assert/strict';
import { formatPersonName } from '../modules/report/mappers/formatters.mapper';

assert.equal(formatPersonName('Võ hữu thuận.'), 'Võ Hữu Thuận');
assert.equal(formatPersonName('nguyễn thị thu thảo'), 'Nguyễn Thị Thu Thảo');
assert.equal(formatPersonName('Huỳnh Châu Long.'), 'Huỳnh Châu Long');
assert.equal(formatPersonName('  Hoàng   Thị Kim Yến. '), 'Hoàng Thị Kim Yến');
assert.equal(formatPersonName('KS. Hoàng Minh Tuấn'), 'KS. Hoàng Minh Tuấn');
assert.equal(formatPersonName('A. Hùng/ Huỳnh Thị Ngọc Hạnh'), 'A. Hùng/ Huỳnh Thị Ngọc Hạnh');
assert.equal(formatPersonName('Nguyễn Văn Dũng/ c. Nga'), 'Nguyễn Văn Dũng/ C. Nga');
assert.equal(formatPersonName('UBND Phường 11'), 'UBND Phường 11');
assert.equal(formatPersonName(''), '');
assert.equal(formatPersonName(null), '');
console.log('[test_format_person_name] OK');
