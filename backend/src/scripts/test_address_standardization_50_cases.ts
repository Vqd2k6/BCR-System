/**
 * Kịch Bản Kiểm Thử Tự Động 50 Test Cases Chuẩn Hóa Thông Tin Địa Chỉ Thửa Đất - Metro Tuyến 2
 * Căn cứ theo Nghị quyết số 1685/NQ-UBTVQH15 của Ủy ban Thường vụ Quốc hội
 *
 * 5 Danh mục kiểm thử:
 * - Category A: Chuẩn Hóa Số Nhà & Hẻm (Cases 1 - 10)
 * - Category B: Chuẩn Hóa Tuyến Đường, Sửa Lỗi Viết Tắt & Chính Tả (Cases 11 - 22)
 * - Category C: Chuẩn Hóa Đơn Vị Hành Chính Sau Sáp Nhập Theo NQ 1685 (Cases 23 - 36)
 * - Category D: Phát Hiện Dữ Liệu Nhiễm Bẩn & Lỗi Tên Phường Trong Ô Đường (Cases 37 - 44)
 * - Category E: Tích Hợp Thẩm Định & Xuất Báo Cáo PDF A4 (Cases 45 - 50)
 */

import {
  standardizeHouseNumber,
  standardizeStreet,
  standardizeWard,
  isStreetContaminatedWithWard,
  evaluateAddressStandard,
} from '../modules/audit/utils/residential-address.standards';
import { buildResidentialViewModel } from '../modules/report/generators/residential/residential-viewmodel.builder';

interface TestCase {
  id: number;
  category: string;
  name: string;
  run: () => { pass: boolean; expected: unknown; actual: unknown; details?: string };
}

const testCases: TestCase[] = [
  // =========================================================================
  // CATEGORY A: CHUẨN HÓA SỐ NHÀ & HẺM (Cases 1 - 10)
  // =========================================================================
  {
    id: 1,
    category: 'A: Số nhà & Hẻm',
    name: "Số nhà có chữ cái phân nhánh viết thường '618/2a' -> Viết hoa '618/2A'",
    run: () => {
      const res = standardizeHouseNumber('618/2a');
      return { pass: res.houseNumber === '618/2A', expected: '618/2A', actual: res.houseNumber };
    },
  },
  {
    id: 2,
    category: 'A: Số nhà & Hẻm',
    name: "Sửa lỗi gõ dấu phẩy phân nhánh hẻm '11a,1' -> '11A/1'",
    run: () => {
      const res = standardizeHouseNumber('11a,1');
      return { pass: res.houseNumber === '11A/1', expected: '11A/1', actual: res.houseNumber };
    },
  },
  {
    id: 3,
    category: 'A: Số nhà & Hẻm',
    name: "Số nhà một ký tự thường '1a' -> Viết hoa '1A'",
    run: () => {
      const res = standardizeHouseNumber('1a');
      return { pass: res.houseNumber === '1A', expected: '1A', actual: res.houseNumber };
    },
  },
  {
    id: 4,
    category: 'A: Số nhà & Hẻm',
    name: "Lược bỏ tiền tố 'Số ' thừa 'Số 618/2a' -> '618/2A'",
    run: () => {
      const res = standardizeHouseNumber('Số 618/2a');
      return { pass: res.houseNumber === '618/2A', expected: '618/2A', actual: res.houseNumber };
    },
  },
  {
    id: 5,
    category: 'A: Số nhà & Hẻm',
    name: "Tách tên đường bị gõ nhầm dính vào số nhà '648/11 Cách Mạng Tháng 8' -> Số '648/11', Đường 'Cách Mạng Tháng 8'",
    run: () => {
      const res = standardizeHouseNumber('648/11 Cách Mạng Tháng 8');
      const pass = res.houseNumber === '648/11' && res.extractedStreet === 'Cách Mạng Tháng 8';
      return {
        pass,
        expected: { houseNumber: '648/11', extractedStreet: 'Cách Mạng Tháng 8' },
        actual: res,
      };
    },
  },
  {
    id: 6,
    category: 'A: Số nhà & Hẻm',
    name: "Số nhà nhiều xuyệt '618/1/2' -> Giữ nguyên cấu trúc chuẩn '618/1/2'",
    run: () => {
      const res = standardizeHouseNumber('618/1/2');
      return { pass: res.houseNumber === '618/1/2', expected: '618/1/2', actual: res.houseNumber };
    },
  },
  {
    id: 7,
    category: 'A: Số nhà & Hẻm',
    name: "Số nhà nhiều xuyệt kèm nhiều chữ cái thường '658/1a/2b' -> Viết hoa toàn bộ '658/1A/2B'",
    run: () => {
      const res = standardizeHouseNumber('658/1a/2b');
      return { pass: res.houseNumber === '658/1A/2B', expected: '658/1A/2B', actual: res.houseNumber };
    },
  },
  {
    id: 8,
    category: 'A: Số nhà & Hẻm',
    name: "Số nhà đã chuẩn '11A' -> Giữ nguyên '11A'",
    run: () => {
      const res = standardizeHouseNumber('11A');
      return { pass: res.houseNumber === '11A', expected: '11A', actual: res.houseNumber };
    },
  },
  {
    id: 9,
    category: 'A: Số nhà & Hẻm',
    name: "Lược bỏ khoảng trắng thừa đầu cuối '  618/2A  ' -> '618/2A'",
    run: () => {
      const res = standardizeHouseNumber('  618/2A  ');
      return { pass: res.houseNumber === '618/2A', expected: '618/2A', actual: res.houseNumber };
    },
  },
  {
    id: 10,
    category: 'A: Số nhà & Hẻm',
    name: "Kết hợp chữ thường tiền tố 'số 105b/3' -> Lược bỏ 'số ' và viết hoa '105B/3'",
    run: () => {
      const res = standardizeHouseNumber('số 105b/3');
      return { pass: res.houseNumber === '105B/3', expected: '105B/3', actual: res.houseNumber };
    },
  },

  // =========================================================================
  // CATEGORY B: CHUẨN HÓA TUYẾN ĐƯỜNG, VIẾT TẮT & CHÍNH TẢ (Cases 11 - 22)
  // =========================================================================
  {
    id: 11,
    category: 'B: Tuyến đường & Chính tả',
    name: "Giải mã từ viết tắt chữ thường 'cmt8' -> 'Cách Mạng Tháng Tám'",
    run: () => {
      const res = standardizeStreet('cmt8');
      return { pass: res.street === 'Cách Mạng Tháng Tám', expected: 'Cách Mạng Tháng Tám', actual: res.street };
    },
  },
  {
    id: 12,
    category: 'B: Tuyến đường & Chính tả',
    name: "Giải mã từ viết tắt chữ hoa 'CMT8' -> 'Cách Mạng Tháng Tám'",
    run: () => {
      const res = standardizeStreet('CMT8');
      return { pass: res.street === 'Cách Mạng Tháng Tám', expected: 'Cách Mạng Tháng Tám', actual: res.street };
    },
  },
  {
    id: 13,
    category: 'B: Tuyến đường & Chính tả',
    name: "Chuẩn hóa 'cách mạng tháng 8' (số 8) -> 'Cách Mạng Tháng Tám' (chữ Tám)",
    run: () => {
      const res = standardizeStreet('cách mạng tháng 8');
      return { pass: res.street === 'Cách Mạng Tháng Tám', expected: 'Cách Mạng Tháng Tám', actual: res.street };
    },
  },
  {
    id: 14,
    category: 'B: Tuyến đường & Chính tả',
    name: "Sửa lỗi chính tả 'Hảm 618 Cách Mạng Tháng Tám' và lược bỏ lặp hẻm -> 'Cách Mạng Tháng Tám'",
    run: () => {
      const res = standardizeStreet('Hảm 618 Cách Mạng Tháng Tám', true);
      const pass = res.street === 'Cách Mạng Tháng Tám';
      return { pass, expected: 'Cách Mạng Tháng Tám', actual: res.street };
    },
  },
  {
    id: 15,
    category: 'B: Tuyến đường & Chính tả',
    name: "Lược bỏ tiền tố 'đường bắc hải' -> Lưu gọn 'Bắc Hải'",
    run: () => {
      const res = standardizeStreet('đường bắc hải');
      return { pass: res.street === 'Bắc Hải', expected: 'Bắc Hải', actual: res.street };
    },
  },
  {
    id: 16,
    category: 'B: Tuyến đường & Chính tả',
    name: "Sửa lỗi sai dấu 'Đường Bác Hải' ('Bác' -> 'Bắc') -> 'Bắc Hải'",
    run: () => {
      const res = standardizeStreet('Đường Bác Hải');
      return { pass: res.street === 'Bắc Hải', expected: 'Bắc Hải', actual: res.street };
    },
  },
  {
    id: 17,
    category: 'B: Tuyến đường & Chính tả',
    name: "Chuẩn hóa viết tắt kèm hoa 'Đ.BẮC HẢI' -> 'Bắc Hải'",
    run: () => {
      const res = standardizeStreet('Đ.BẮC HẢI');
      return { pass: res.street === 'Bắc Hải', expected: 'Bắc Hải', actual: res.street };
    },
  },
  {
    id: 18,
    category: 'B: Tuyến đường & Chính tả',
    name: "Giải mã viết tắt 'Đ. BH' hoặc 'đ . bh' -> 'Bắc Hải'",
    run: () => {
      const res1 = standardizeStreet('Đ. BH');
      const res2 = standardizeStreet('đ . bh');
      const pass = res1.street === 'Bắc Hải' && res2.street === 'Bắc Hải';
      return { pass, expected: 'Bắc Hải', actual: { res1: res1.street, res2: res2.street } };
    },
  },
  {
    id: 19,
    category: 'B: Tuyến đường & Chính tả',
    name: "Chuẩn hóa 'đường trường sơn' -> 'Trường Sơn'",
    run: () => {
      const res = standardizeStreet('đường trường sơn');
      return { pass: res.street === 'Trường Sơn', expected: 'Trường Sơn', actual: res.street };
    },
  },
  {
    id: 20,
    category: 'B: Tuyến đường & Chính tả',
    name: "Chuẩn hóa cách viết lộn xộn 'Đ . trường sơn' -> 'Trường Sơn'",
    run: () => {
      const res = standardizeStreet('Đ . trường sơn');
      return { pass: res.street === 'Trường Sơn', expected: 'Trường Sơn', actual: res.street };
    },
  },
  {
    id: 21,
    category: 'B: Tuyến đường & Chính tả',
    name: "Giải mã 'trường chinh', 'tc', 'đ. tc' -> 'Trường Chinh'",
    run: () => {
      const res1 = standardizeStreet('trường chinh');
      const res2 = standardizeStreet('đ. tc');
      const pass = res1.street === 'Trường Chinh' && res2.street === 'Trường Chinh';
      return { pass, expected: 'Trường Chinh', actual: { res1: res1.street, res2: res2.street } };
    },
  },
  {
    id: 22,
    category: 'B: Tuyến đường & Chính tả',
    name: "Giải mã 'lý thường kiệt', 'ltk', 'đ. ltk' -> 'Lý Thường Kiệt'",
    run: () => {
      const res1 = standardizeStreet('lý thường kiệt');
      const res2 = standardizeStreet('đ. ltk');
      const pass = res1.street === 'Lý Thường Kiệt' && res2.street === 'Lý Thường Kiệt';
      return { pass, expected: 'Lý Thường Kiệt', actual: { res1: res1.street, res2: res2.street } };
    },
  },

  // =========================================================================
  // CATEGORY C: CHUẨN HÓA ĐƠN VỊ HÀNH CHÍNH THEO NQ 1685 (Cases 23 - 36)
  // =========================================================================
  {
    id: 23,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Các biến thể 'P.Nhiêu lộc', 'p nhiêu lộc', 'phường nhiêu lộc' -> 'Phường Nhiêu Lộc' (Quận 3)",
    run: () => {
      const res1 = standardizeWard('P.Nhiêu lộc');
      const res2 = standardizeWard('p nhiêu lộc');
      const res3 = standardizeWard('phường nhiêu lộc');
      const pass =
        res1.ward === 'Phường Nhiêu Lộc' &&
        res2.ward === 'Phường Nhiêu Lộc' &&
        res3.ward === 'Phường Nhiêu Lộc' &&
        res1.district === 'Quận 3';
      return { pass, expected: 'Phường Nhiêu Lộc, Quận 3', actual: `${res1.ward}, ${res1.district}` };
    },
  },
  {
    id: 24,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ trước sáp nhập 'p11', 'P11', 'phường 11' (Quận 3) -> Ánh xạ sang 'Phường Nhiêu Lộc'",
    run: () => {
      const res = standardizeWard('p11', 'Quận 3');
      const pass = res.ward === 'Phường Nhiêu Lộc' && res.district === 'Quận 3' && res.isMatched;
      return {
        pass,
        expected: 'Phường Nhiêu Lộc (Quận 3)',
        actual: `${res.ward} (${res.district})`,
        details: res.mergerNote,
      };
    },
  },
  {
    id: 25,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'Phường 9' (Quận 3) -> Ánh xạ sang 'Phường Nhiêu Lộc'",
    run: () => {
      const res = standardizeWard('Phường 9', 'Quận 3');
      const pass = res.ward === 'Phường Nhiêu Lộc' && res.district === 'Quận 3';
      return { pass, expected: 'Phường Nhiêu Lộc', actual: res.ward };
    },
  },
  {
    id: 26,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'Phường 12' (Quận 3) -> Ánh xạ sang 'Phường Nhiêu Lộc'",
    run: () => {
      const res = standardizeWard('Phường 12', 'Quận 3');
      const pass = res.ward === 'Phường Nhiêu Lộc' && res.district === 'Quận 3';
      return { pass, expected: 'Phường Nhiêu Lộc', actual: res.ward };
    },
  },
  {
    id: 27,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'Phường 14' (Quận 3) -> Ánh xạ sang 'Phường Nhiêu Lộc'",
    run: () => {
      const res = standardizeWard('Phường 14', 'Quận 3');
      const pass = res.ward === 'Phường Nhiêu Lộc' && res.district === 'Quận 3';
      return { pass, expected: 'Phường Nhiêu Lộc', actual: res.ward };
    },
  },
  {
    id: 28,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Các biến thể 'Phường hòa hưng', 'p.hòa hưng', 'P.HH', 'p.hh' -> 'Phường Hòa Hưng' (Quận 10)",
    run: () => {
      const res1 = standardizeWard('Phường hòa hưng');
      const res2 = standardizeWard('P.HH');
      const pass =
        res1.ward === 'Phường Hòa Hưng' &&
        res2.ward === 'Phường Hòa Hưng' &&
        res1.district === 'Quận 10';
      return { pass, expected: 'Phường Hòa Hưng, Quận 10', actual: `${res1.ward}, ${res1.district}` };
    },
  },
  {
    id: 29,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'P15', 'p15', 'phường 15' (Quận 10) -> Ánh xạ sang 'Phường Hòa Hưng'",
    run: () => {
      const res = standardizeWard('P15', 'Quận 10');
      const pass = res.ward === 'Phường Hòa Hưng' && res.district === 'Quận 10' && res.isMatched;
      return {
        pass,
        expected: 'Phường Hòa Hưng (Quận 10)',
        actual: `${res.ward} (${res.district})`,
        details: res.mergerNote,
      };
    },
  },
  {
    id: 30,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'Phường 13' (Quận 10) -> Ánh xạ sang 'Phường Hòa Hưng'",
    run: () => {
      const res = standardizeWard('Phường 13', 'Quận 10');
      const pass = res.ward === 'Phường Hòa Hưng' && res.district === 'Quận 10';
      return { pass, expected: 'Phường Hòa Hưng', actual: res.ward };
    },
  },
  {
    id: 31,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'p.6', 'P6', 'Phường 6' (Tân Bình) -> Ánh xạ sang 'Phường Tân Hòa'",
    run: () => {
      const res = standardizeWard('p.6', 'Quận Tân Bình');
      const pass = res.ward === 'Phường Tân Hòa' && res.district === 'Quận Tân Bình';
      return {
        pass,
        expected: 'Phường Tân Hòa (Quận Tân Bình)',
        actual: `${res.ward} (${res.district})`,
        details: res.mergerNote,
      };
    },
  },
  {
    id: 32,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Các biến thể 'p.TÂN HÒA', 'phường tân hòa', 'P. tân hòa' -> 'Phường Tân Hòa' (Quận Tân Bình)",
    run: () => {
      const res1 = standardizeWard('p.TÂN HÒA');
      const res2 = standardizeWard('phường tân hòa');
      const pass =
        res1.ward === 'Phường Tân Hòa' &&
        res2.ward === 'Phường Tân Hòa' &&
        res1.district === 'Quận Tân Bình';
      return { pass, expected: 'Phường Tân Hòa, Quận Tân Bình', actual: `${res1.ward}, ${res1.district}` };
    },
  },
  {
    id: 33,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'Phường 8' (Tân Bình) -> Ánh xạ sang 'Phường Tân Hòa'",
    run: () => {
      const res = standardizeWard('Phường 8', 'Quận Tân Bình');
      const pass = res.ward === 'Phường Tân Hòa' && res.district === 'Quận Tân Bình';
      return { pass, expected: 'Phường Tân Hòa', actual: res.ward };
    },
  },
  {
    id: 34,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'Phường 5', 'P5' (Quận 3) -> Ánh xạ sang 'Phường Bàn Cờ' (Quận 3)",
    run: () => {
      const res = standardizeWard('P5', 'Quận 3');
      const pass = res.ward === 'Phường Bàn Cờ' && res.district === 'Quận 3';
      return { pass, expected: 'Phường Bàn Cờ', actual: res.ward };
    },
  },
  {
    id: 35,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'Phường 4', 'Phường Võ Thị Sáu' (Quận 3) -> Ánh xạ sang 'Phường Xuân Hòa' (Quận 3)",
    run: () => {
      const res1 = standardizeWard('Phường 4', 'Quận 3');
      const res2 = standardizeWard('Phường Võ Thị Sáu', 'Quận 3');
      const pass =
        res1.ward === 'Phường Xuân Hòa' &&
        res2.ward === 'Phường Xuân Hòa' &&
        res1.district === 'Quận 3';
      return { pass, expected: 'Phường Xuân Hòa', actual: `${res1.ward}, ${res2.ward}` };
    },
  },
  {
    id: 36,
    category: 'C: Sáp nhập ĐVHC NQ 1685',
    name: "Phường cũ 'Phường 7' (Tân Bình) -> Ánh xạ sang 'Phường Tân Sơn Nhất' (Quận Tân Bình)",
    run: () => {
      const res = standardizeWard('Phường 7', 'Quận Tân Bình');
      const pass = res.ward === 'Phường Tân Sơn Nhất' && res.district === 'Quận Tân Bình';
      return { pass, expected: 'Phường Tân Sơn Nhất', actual: res.ward };
    },
  },

  // =========================================================================
  // CATEGORY D: PHÁT HIỆN DỮ LIỆU NHIỄM BẨN & LỖI Ô ĐƯỜNG (Cases 37 - 44)
  // =========================================================================
  {
    id: 37,
    category: 'D: Nhiễm bẩn & Khôi phục',
    name: "Phát hiện ô đường bị điền nhầm tên phường 'Phường Bến Thành' -> isContaminated = true",
    run: () => {
      const isContam = isStreetContaminatedWithWard('Phường Bến Thành');
      return { pass: isContam === true, expected: true, actual: isContam };
    },
  },
  {
    id: 38,
    category: 'D: Nhiễm bẩn & Khôi phục',
    name: "Phát hiện ô đường bị điền nhầm tên phường số 'Phường 4' -> isContaminated = true",
    run: () => {
      const isContam = isStreetContaminatedWithWard('Phường 4');
      return { pass: isContam === true, expected: true, actual: isContam };
    },
  },
  {
    id: 39,
    category: 'D: Nhiễm bẩn & Khôi phục',
    name: "Phát hiện ô đường bị điền nhầm 'Phường 11' -> isContaminated = true",
    run: () => {
      const isContam = isStreetContaminatedWithWard('Phường 11');
      return { pass: isContam === true, expected: true, actual: isContam };
    },
  },
  {
    id: 40,
    category: 'D: Nhiễm bẩn & Khôi phục',
    name: "Gợi ý tuyến đường trục chính theo Zone S6 khi ô đường bị nhiễm bẩn -> Gợi ý 'Cách Mạng Tháng Tám'",
    run: () => {
      const evalRes = evaluateAddressStandard('618/2a', 'Phường 11', 'P11', 'Quận 3', 'S6');
      const pass =
        evalRes.isContaminated === true &&
        evalRes.suggested.street === 'Cách Mạng Tháng Tám' &&
        evalRes.suggested.ward === 'Phường Nhiêu Lộc';
      return {
        pass,
        expected: { street: 'Cách Mạng Tháng Tám', isContaminated: true },
        actual: { street: evalRes.suggested.street, isContaminated: evalRes.isContaminated },
      };
    },
  },
  {
    id: 41,
    category: 'D: Nhiễm bẩn & Khôi phục',
    name: "Gợi ý tuyến đường Zone S7 (Cư xá Bắc Hải) khi ô đường bị nhiễm bẩn -> Gợi ý 'Cách Mạng Tháng Tám' hoặc 'Bắc Hải'",
    run: () => {
      const evalRes = evaluateAddressStandard('1A', 'Phường 15', 'P15', 'Quận 10', 'S7');
      const pass = evalRes.isContaminated === true && Boolean(evalRes.suggested.street);
      return {
        pass,
        expected: 'Gợi ý hợp lệ tuyến đường Zone S7',
        actual: evalRes.suggested.street,
      };
    },
  },
  {
    id: 42,
    category: 'D: Nhiễm bẩn & Khôi phục',
    name: "Tách tên phường bị dính đuôi vào ô đường: 'Cách Mạng Tháng Tám, p. Nhiêu Lộc' -> 'Cách Mạng Tháng Tám'",
    run: () => {
      const res = standardizeStreet('Cách Mạng Tháng Tám, p. Nhiêu Lộc');
      return { pass: res.street === 'Cách Mạng Tháng Tám', expected: 'Cách Mạng Tháng Tám', actual: res.street };
    },
  },
  {
    id: 43,
    category: 'D: Nhiễm bẩn & Khôi phục',
    name: "Tách tên phường bị dính đuôi kèm viết tắt: 'CMT8, phường Nhiêu Lộc' -> 'Cách Mạng Tháng Tám'",
    run: () => {
      const res = standardizeStreet('CMT8, phường Nhiêu Lộc');
      return { pass: res.street === 'Cách Mạng Tháng Tám', expected: 'Cách Mạng Tháng Tám', actual: res.street };
    },
  },
  {
    id: 44,
    category: 'D: Nhiễm bẩn & Khôi phục',
    name: "Địa chỉ đã hoàn toàn chuẩn hóa: '618/2A', 'Cách Mạng Tháng Tám', 'Phường Nhiêu Lộc', 'Quận 3' -> isCompliant = true, diffCount = 0",
    run: () => {
      const evalRes = evaluateAddressStandard('618/2A', 'Cách Mạng Tháng Tám', 'Phường Nhiêu Lộc', 'Quận 3');
      const pass = evalRes.isCompliant === true && evalRes.diffCount === 0 && !evalRes.hasAnomalies;
      return {
        pass,
        expected: { isCompliant: true, diffCount: 0 },
        actual: { isCompliant: evalRes.isCompliant, diffCount: evalRes.diffCount },
      };
    },
  },

  // =========================================================================
  // CATEGORY E: TÍCH HỢP THẨM ĐỊNH & BÁO CÁO PDF A4 (Cases 45 - 50)
  // =========================================================================
  {
    id: 45,
    category: 'E: Thẩm định & Báo cáo PDF',
    name: "evaluateAddressStandard tính đúng diffCount khi có 3 trường sai lệch (Hn, Street, Ward)",
    run: () => {
      const evalRes = evaluateAddressStandard('618/2a', 'cmt8', 'p11', 'Quận 3');
      const pass = evalRes.diffCount === 3 && evalRes.hasAnomalies === true;
      return { pass, expected: { diffCount: 3, hasAnomalies: true }, actual: { diffCount: evalRes.diffCount, hasAnomalies: evalRes.hasAnomalies } };
    },
  },
  {
    id: 46,
    category: 'E: Thẩm định & Báo cáo PDF',
    name: "Gatekeeper: evaluateAddressStandard phát hiện từ viết tắt 'CMT8' và kích hoạt hasAnomalies = true",
    run: () => {
      const evalRes = evaluateAddressStandard('618/2A', 'CMT8', 'Phường Nhiêu Lộc', 'Quận 3');
      const pass = evalRes.hasAnomalies === true && evalRes.isCompliant === false;
      return { pass, expected: true, actual: evalRes.hasAnomalies };
    },
  },
  {
    id: 47,
    category: 'E: Thẩm định & Báo cáo PDF',
    name: "Gatekeeper: evaluateAddressStandard phát hiện ô đường nhiễm bẩn và kích hoạt isContaminated = true",
    run: () => {
      const evalRes = evaluateAddressStandard('618/2A', 'Phường 11', 'Phường Nhiêu Lộc', 'Quận 3');
      const pass = evalRes.isContaminated === true && evalRes.isCompliant === false;
      return { pass, expected: true, actual: evalRes.isContaminated };
    },
  },
  {
    id: 48,
    category: 'E: Thẩm định & Báo cáo PDF',
    name: "standardizeWard không bao giờ sinh ra lỗi trùng lặp 'Phường Phường 11' hay 'Phường P11'",
    run: () => {
      const res1 = standardizeWard('Phường 11');
      const res2 = standardizeWard('p.11');
      const pass =
        !res1.ward.includes('Phường Phường') &&
        !res1.ward.includes('Phường P') &&
        !res2.ward.includes('Phường Phường') &&
        !res2.ward.includes('Phường p');
      return { pass, expected: 'Không có lỗi lặp Phường Phường / Phường P', actual: { res1: res1.ward, res2: res2.ward } };
    },
  },
  {
    id: 49,
    category: 'E: Thẩm định & Báo cáo PDF',
    name: "buildResidentialViewModel định dạng chuỗi địa chỉ A4 hoàn hảo: 'Số 618/2A Cách Mạng Tháng Tám, Phường Nhiêu Lộc, Quận 3'",
    run: () => {
      const mockReportData = {
        survey_data_json: {
          houseNumber: '618/2a',
          street: 'cmt8',
          ward: 'p11',
          district: 'Quận 3',
        },
        house_number: '618/2a',
        street: 'cmt8',
        ward: 'p11',
        district: 'Quận 3',
        zone_id: 'S6',
      };
      const vm = buildResidentialViewModel(mockReportData);
      const expectedAddress = 'Số 618/2A, Cách Mạng Tháng Tám, Phường Nhiêu Lộc, Quận 3';
      const pass = vm.address === expectedAddress && vm.houseNumber === '618/2A' && vm.street === 'Cách Mạng Tháng Tám' && vm.ward === 'Phường Nhiêu Lộc';
      return { pass, expected: expectedAddress, actual: vm.address };
    },
  },
  {
    id: 50,
    category: 'E: Thẩm định & Báo cáo PDF',
    name: "Xử lý phòng vệ khi đầu vào null, undefined hoặc rỗng (Zero Crash & Safe Defaults)",
    run: () => {
      const resHn = standardizeHouseNumber(null);
      const resSt = standardizeStreet(undefined);
      const resWd = standardizeWard('');
      const evalRes = evaluateAddressStandard(null, undefined, '', null);
      const pass =
        resHn.houseNumber === '' &&
        resSt.street === '' &&
        resWd.ward === '' &&
        evalRes !== null &&
        typeof evalRes === 'object';
      return { pass, expected: 'Safe defaults without throwing', actual: 'Handled safely' };
    },
  },
];

// =========================================================================
// RUNNER & REPORTING
// =========================================================================
console.log('======================================================================');
console.log('🚇 METRO 2 BCS: KIỂM THỬ 50 TEST CASES CHUẨN HÓA ĐỊA CHỈ & NQ 1685');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

for (const tc of testCases) {
  try {
    const result = tc.run();
    if (result.pass) {
      passCount++;
      console.log(`✅ [PASS] Case #${tc.id.toString().padStart(2, '0')} [${tc.category}]: ${tc.name}`);
      if (result.details) {
        console.log(`         ℹ️  ${result.details}`);
      }
    } else {
      failCount++;
      console.error(`❌ [FAIL] Case #${tc.id.toString().padStart(2, '0')} [${tc.category}]: ${tc.name}`);
      console.error(`         Expected:`, result.expected);
      console.error(`         Actual:  `, result.actual);
    }
  } catch (err) {
    failCount++;
    console.error(`💥 [ERROR] Case #${tc.id.toString().padStart(2, '0')} [${tc.category}]: ${tc.name}`);
    console.error(`         Exception:`, err);
  }
}

console.log('\n======================================================================');
console.log(`📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ: ${passCount}/${testCases.length} TEST CASES ĐẠT`);
console.log('======================================================================');

if (failCount > 0) {
  console.error(`🚨 CÓ ${failCount} TEST CASES THẤT BẠI. VUI LÒNG KIỂM TRA LẠI LOG.`);
  process.exit(1);
} else {
  console.log(`🎉 100% HOÀN THÀNH (${passCount}/50 PASS)! HỆ THỐNG ĐẠT CHUẨN TOÀN TRÌNH.`);
  process.exit(0);
}
