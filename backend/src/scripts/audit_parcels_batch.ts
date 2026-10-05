import { Database } from '../database/db';

const codes = [
  'C&C-05-B-0054',
  'C&C-05-B-0056',
  'C&C-05-B-0058',
  'C&C-05-B-0154',
  'C&C-05-B-0156',
  'C&C-05-B-0158'
];

async function main() {
  console.log('================================================================');
  console.log('🔍 KIỂM TRA DỮ LIỆU THỰC TẾ CHO 6 MÃ THỬA ĐẤT');
  console.log('================================================================');

  for (const code of codes) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`📌 THỬA ĐẤT: ${code}`);
    console.log(`----------------------------------------------------------------`);

    // 1. Lấy thông tin thửa
    const parcelRes = await Database.query(
      `SELECT * FROM parcels WHERE project_parcel_code = $1 OR official_cadastral_code = $1`,
      [code]
    );

    if (parcelRes.rows.length === 0) {
      console.log(`❌ Không tìm thấy thửa đất ${code} trong bảng parcels! Thử tìm theo LIKE...`);
      const likeRes = await Database.query(
        `SELECT id, project_parcel_code, official_cadastral_code FROM parcels WHERE project_parcel_code ILIKE $1 OR official_cadastral_code ILIKE $1`,
        [`%${code.split('-').pop()}%`]
      );
      console.log(`   Gợi ý kết quả gần giống:`, likeRes.rows);
      continue;
    }

    const parcel = parcelRes.rows[0];
    console.log(`✅ Đã tìm thấy thửa ID: ${parcel.id}`);
    console.log(`   - Mã thửa: ${parcel.project_parcel_code} | Mã địa chính: ${parcel.official_cadastral_code}`);
    console.log(`   - Địa chỉ: ${parcel.house_number} ${parcel.street}, ${parcel.ward}, ${parcel.district}`);
    console.log(`   - Chủ hộ: ${parcel.owner_name} | SĐT: ${parcel.owner_phone}`);
    console.log(`   - Loại nhà: ${parcel.building_type} | Zone: ${parcel.zone_id} | Trạng thái: ${parcel.status}`);

    // 2. Tìm báo cáo khảo sát
    const reportRes = await Database.query(
      `SELECT * FROM base_survey_reports WHERE parcel_id = $1 ORDER BY created_at DESC`,
      [parcel.id]
    );

    console.log(`📄 Số lượng báo cáo trong base_survey_reports: ${reportRes.rows.length}`);
    if (reportRes.rows.length === 0) {
      console.log(`⚠️ Thửa này chưa có báo cáo khảo sát nào!`);
      continue;
    }

    for (let i = 0; i < reportRes.rows.length; i++) {
      const rep = reportRes.rows[i];
      console.log(`\n  --- Báo cáo #${i + 1} (ID: ${rep.id}) ---`);
      console.log(`   • Phase: ${rep.phase} | Status: ${rep.status} | Code: ${rep.report_code}`);
      console.log(`   • Ngày khảo sát: ${rep.survey_date}`);
      console.log(`   • Từ chối/Vắng mặt: ${rep.is_refused_or_absent}`);
      console.log(`   • Kết luận KSV: ${rep.summary_conclusions || 'Chưa có'}`);
      console.log(`   • Ý kiến chủ nhà: ${rep.owner_remarks || 'Chưa có'}`);
      console.log(`   • Chữ ký KSV: ${rep.surveyor_signature_url ? 'CÓ' : 'KHÔNG'} | Chữ ký chủ nhà: ${rep.owner_signature_url ? 'CÓ' : 'KHÔNG'}`);

      // Kiểm tra các bảng liên quan: building_specifications, deformation_assessments, risk_score_cards, identification_photos
      const [specRes, deformRes, riskRes, photoRes] = await Promise.all([
        Database.query(`SELECT * FROM building_specifications WHERE report_id = $1`, [rep.id]),
        Database.query(`SELECT * FROM deformation_assessments WHERE report_id = $1`, [rep.id]),
        Database.query(`SELECT * FROM risk_score_cards WHERE report_id = $1`, [rep.id]),
        Database.query(`SELECT photo_type, photo_code, COALESCE(annotated_photo_url, raw_photo_url) as photo_url, is_not_applicable, na_reason FROM survey_identification_photos WHERE report_id = $1`, [rep.id]),
      ]);

      console.log(`   • building_specifications: ${specRes.rows.length > 0 ? 'CÓ' : 'KHÔNG'}`);
      if (specRes.rows.length > 0) {
        const s = specRes.rows[0];
        console.log(`     - Số tầng: ${s.number_of_floors} | Chiều cao: ${s.structure_height_m}m | Diện tích: ${s.footprint_area_m2}m²`);
        console.log(`     - Loại móng: ${s.foundation_type} | Độ sâu móng: ${s.foundation_depth_m}m`);
        console.log(`     - Kết cấu chính: ${s.primary_structural_system}`);
      }

      console.log(`   • deformation_assessments: ${deformRes.rows.length > 0 ? 'CÓ' : 'KHÔNG'}`);
      if (deformRes.rows.length > 0) {
        const d = deformRes.rows[0];
        console.log(`     - Góc nghiêng X: ${d.tilt_angle_x}‰, Y: ${d.tilt_angle_y}‰ | Võng dầm: ${d.beam_deflection_mm}mm`);
        console.log(`     - Lún chênh: ${d.max_settlement_diff_mm}mm | Nứt móng: ${d.foundation_crack_detected ? 'CÓ' : 'KHÔNG'}`);
      }

      console.log(`   • risk_score_cards: ${riskRes.rows.length > 0 ? 'CÓ' : 'KHÔNG'}`);
      if (riskRes.rows.length > 0) {
        const rk = riskRes.rows[0];
        console.log(`     - ECS: ${rk.total_ecs_score} (${rk.ecs_class}) | VI: ${rk.avg_vi_score} (${rk.vi_class}) | BRA: ${rk.bra_risk_class}`);
      }

      console.log(`   • identification_photos (Ảnh ngoại thất & biến dạng): ${photoRes.rows.length} ảnh`);
      photoRes.rows.forEach(p => {
        console.log(`     - [${p.photo_type}] ${p.photo_code}: ${p.photo_url?.substring(0, 80)}...`);
      });

      // Phân tích survey_data_json
      const json = rep.survey_data_json || {};
      const floors = json.floors || [];
      console.log(`   • survey_data_json.floors: ${floors.length} tầng`);
      let totalDefectsInJson = 0;
      floors.forEach((fl: any, fIdx: number) => {
        let fDefects = 0;
        (fl.zones || []).forEach((z: any) => {
          fDefects += (z.defects || []).length;
        });
        totalDefectsInJson += fDefects;
        console.log(`     [Tầng ${fIdx + 1}: ${fl.floorName || fl.floorNameVi}] CAD Kiến trúc: ${fl.cad_drawing_url ? 'CÓ' : 'KHÔNG'}, CAD Kết cấu: ${fl.cadStructuralSketchPhotoUrl ? 'CÓ' : 'KHÔNG'} | Số khuyết tật: ${fDefects}`);
      });
      console.log(`     => Tổng số khuyết tật: ${totalDefectsInJson}`);

      // Kiểm tra biên bản hiện trường trong JSON
      const minutes = json.signatures?.workingMinutesPhotos || [];
      console.log(`   • Biên bản hiện trường scan (workingMinutesPhotos): ${minutes.length} trang`);
      minutes.forEach((m: any, mIdx: number) => {
        console.log(`     - Trang ${mIdx + 1}: ${typeof m === 'string' ? m.substring(0, 80) : m.url?.substring(0, 80)}...`);
      });
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Lỗi kiểm tra batch:', err);
  process.exit(1);
});
