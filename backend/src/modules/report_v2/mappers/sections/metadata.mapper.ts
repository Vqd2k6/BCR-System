/**
 * ============================================================================
 * METADATA & 3-PARTY SIGNATURES MAPPER
 * Chuẩn hóa 7 chỉ số định danh công trình, ảnh mặt tiền bìa và chữ ký 3 bên
 * ============================================================================
 */

import { ReportV2Metadata, ApprovalSignatureItem } from '../../report-v2.types';
import { CadastralInfoMapper } from '../cadastral-info.mapper';
import { ReportImageResolver } from '../../services/report-image-resolver.service';
import { LOGO_THACO_REC_BASE64 } from '../../assets/report-logos';
import { isPhotoAlreadyWatermarked } from '../floor-defect.mapper';
import { formatDateVi, extractPhotoDateTime } from '../formatters.mapper';

export interface MetadataMappingResult {
  metadata: ReportV2Metadata;
  signatures3Party: ApprovalSignatureItem[];
  buildingId: string;
  surveyId: string;
  reportNo: string;
  filingNo: string;
  cadastralCode: string;
  surveyorName: string;
  zoneAdminName: string;
  superAdminName: string;
}

export class MetadataMapper {
  public static map(
    rawReport: any,
    json: any,
    identPhotos: any[],
    overrides: any,
    surveyDateFormatted: string,
    watermarkDateTime: string,
    rawSurveyDate: any
  ): MetadataMappingResult {
    // 1. Chuẩn hóa 7 chỉ số định danh
    const rawParcelCode = rawReport.project_parcel_code || json.projectParcelCode || '';
    const buildingId = overrides?.buildingId || (rawParcelCode ? CadastralInfoMapper.formatBuildingId(
      rawParcelCode,
      rawReport.zone_id || 'ZONE_09',
      rawReport.segment_type || 'C&C'
    ) : 'CHƯA_ĐỊNH_DANH');
    const surveyId = rawReport.id ? `P-${rawReport.id.substring(0, 4).toUpperCase()}` : (json.surveyId || '');
    const revision = overrides?.revision || rawReport.revision || '00';
    const reportNo = overrides?.reportNo || (rawParcelCode ? CadastralInfoMapper.formatReportNo(
      buildingId,
      rawParcelCode,
      rawReport.segment_type,
      rawReport.zone_id,
      revision
    ) : 'BC-CHƯA_SỐ');
    const filingNo = overrides?.filingNo || CadastralInfoMapper.formatFilingNo(buildingId);
    const cadastralCode = rawReport.official_cadastral_code || json.officialCadastralCode || '';

    // Ảnh mặt tiền chính cho trang bìa (P-02) có cơ chế fallback thông minh:
    const p02Item = identPhotos.find((p: any) =>
      p.photo_type === 'P02_MAIN_FACADE' ||
      p.photo_code?.includes('P02') ||
      p.photo_code?.includes('P-02') ||
      p.photo_type === 'P02'
    );
    const p01Item = identPhotos.find((p: any) =>
      p.photo_type === 'P01_HOUSE_NUMBER' ||
      p.photo_code?.includes('P01') ||
      p.photo_code?.includes('P-01')
    );

    let coverPhotoUrl =
      json.photoP02?.url ||
      (typeof json.photoP02 === 'string' ? json.photoP02 : undefined) ||
      json.photos?.p02 ||
      json.step1Photos?.p02MainFacadeUrl ||
      p02Item?.raw_photo_url ||
      p02Item?.annotated_photo_url ||
      '';
    // Fallback 1: Dùng P-01 nếu không có P-02 (ví dụ hẻm hẹp)
    if (!coverPhotoUrl) {
      coverPhotoUrl =
        json.photoP01?.url ||
        (typeof json.photoP01 === 'string' ? json.photoP01 : undefined) ||
        json.photos?.p01 ||
        json.step1Photos?.p01HouseNumberUrl ||
        p01Item?.raw_photo_url ||
        p01Item?.annotated_photo_url ||
        '';
    }
    // Fallback 2: Dùng ảnh đất trống nếu là hồ sơ đất trống
    if (!coverPhotoUrl && Array.isArray(json.vacantLandPhotos) && json.vacantLandPhotos.length > 0) {
      coverPhotoUrl = json.vacantLandPhotos[0];
    }
    const coverPhotoBase64 = coverPhotoUrl ? ReportImageResolver.resolveToBase64(coverPhotoUrl) : undefined;
    const coverWatermarkDateTime = extractPhotoDateTime(coverPhotoUrl, p02Item?.shot_at || p02Item?.created_at, rawSurveyDate);

    // Metadata
    const metadata: ReportV2Metadata = {
      buildingId,
      surveyId,
      reportNo,
      filingNo,
      revision,
      cadastralCode,
      projectTitleVi: 'Tuyến Metro Số 2 TPHCM (Bến Thành - Tham Lương)',
      projectTitleEn: 'Ho Chi Minh City Mass Rapid Transit Line 2, Ben Thanh – Tham Luong Route',
      reportTitleVi: 'Khảo sát và Đánh giá hiện trạng tòa nhà',
      reportTitleEn: 'Building Condition Survey and Assessment',
      generatedAt: formatDateVi(new Date()),
      coverPhotoUrl,
      coverPhotoBase64,
      coverAlreadyWatermarked: isPhotoAlreadyWatermarked(coverPhotoUrl),
      headerLogoBase64: LOGO_THACO_REC_BASE64,
      surveyDateFormatted,
      watermarkDateTime,
      coverWatermarkDateTime,
    };

    // Khung ký 3 bên trang bìa: Chỉ hiển thị tên khi có dữ liệu thực tế trong DB / JSON snapshot.
    const surveyorName = rawReport.surveyor_name || json.signatures?.preparedBy?.fullName || '';
    const zoneAdminName = rawReport.zone_admin_name || json.signatures?.checkedBy?.fullName || '';
    const superAdminName = rawReport.super_admin_name || json.signatures?.approvedBy?.fullName || '';

    const surveyorSigUrl = rawReport.surveyor_signature_img || json.signatures?.preparedBy?.signatureImg;
    const zoneAdminSigUrl = rawReport.zone_admin_signature_img || json.signatures?.checkedBy?.signatureImg;
    const superAdminSigUrl = rawReport.super_admin_signature_img || json.signatures?.approvedBy?.signatureImg;

    const signatures3Party: ApprovalSignatureItem[] = [
      {
        roleVi: 'NGƯỜI LẬP',
        roleEn: 'PREPARED BY',
        fullName: surveyorName,
        titleVi: 'Trưởng nhóm khảo sát',
        titleEn: 'Survey Team Leader',
        signatureUrl: surveyorSigUrl,
        signatureBase64: surveyorSigUrl ? ReportImageResolver.resolveToBase64(surveyorSigUrl) : undefined,
        date: surveyDateFormatted,
      },
      {
        roleVi: 'NGƯỜI KIỂM TRA',
        roleEn: 'CHECKED BY',
        fullName: zoneAdminName,
        titleVi: 'Quản trị phân khu',
        titleEn: 'Zone Administrator',
        signatureUrl: zoneAdminSigUrl,
        signatureBase64: zoneAdminSigUrl ? ReportImageResolver.resolveToBase64(zoneAdminSigUrl) : undefined,
        date: surveyDateFormatted,
      },
      {
        roleVi: 'NGƯỜI PHÊ DUYỆT',
        roleEn: 'APPROVED BY',
        fullName: superAdminName,
        titleVi: 'Giám đốc dự án / Tư vấn trưởng',
        titleEn: 'Project Director / Lead Consultant',
        signatureUrl: superAdminSigUrl,
        signatureBase64: superAdminSigUrl ? ReportImageResolver.resolveToBase64(superAdminSigUrl) : undefined,
        date: surveyDateFormatted,
      },
    ];

    return {
      metadata,
      signatures3Party,
      buildingId,
      surveyId,
      reportNo,
      filingNo,
      cadastralCode,
      surveyorName,
      zoneAdminName,
      superAdminName,
    };
  }
}
