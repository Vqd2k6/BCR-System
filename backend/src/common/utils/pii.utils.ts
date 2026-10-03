/**
 * Utility che mờ thông tin cá nhân (PII Masking) cho vai trò GUEST (Chủ Đầu Tư)
 * Tuân thủ quy định bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP
 */

export function maskPii(val: string | null | undefined, visiblePrefix = 3, visibleSuffix = 3): string | null {
  if (!val) return null;
  const str = String(val).trim();
  if (str.length <= visiblePrefix + visibleSuffix) {
    return str.length > 2 ? `${str[0]}***${str[str.length - 1]}` : '***';
  }
  const prefix = str.substring(0, visiblePrefix);
  const suffix = visibleSuffix > 0 ? str.substring(str.length - visibleSuffix) : '';
  const maskedLength = Math.max(str.length - visiblePrefix - visibleSuffix, 4);
  return `${prefix}${'*'.repeat(maskedLength)}${suffix}`;
}

export function maskName(fullName: string | null | undefined): string | null {
  if (!fullName) return null;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return maskPii(fullName, 1, 1);
  return parts
    .map((part, index) => {
      if (index === 0 || index === parts.length - 1) return part;
      return `${part[0]}***`;
    })
    .join(' ');
}

export function maskParcelPii(parcel: any): any {
  if (!parcel) return parcel;
  return {
    ...parcel,
    owner_name: maskName(parcel.owner_name),
    owner_phone: maskPii(parcel.owner_phone, 3, 3),
    owner_id_card: maskPii(parcel.owner_id_card, 3, 0),
  };
}

export function maskReportPii(report: any): any {
  if (!report) return report;
  try {
    const deepCloned = JSON.parse(JSON.stringify(report));

    if (deepCloned.report) {
      if (deepCloned.report.owner_name) {
        deepCloned.report.owner_name = maskName(deepCloned.report.owner_name);
      }
      if (deepCloned.report.owner_phone) {
        deepCloned.report.owner_phone = maskPii(deepCloned.report.owner_phone, 3, 3);
      }
      if (deepCloned.report.owner_id_card) {
        deepCloned.report.owner_id_card = maskPii(deepCloned.report.owner_id_card, 3, 0);
      }
    }

    if (deepCloned.surveyData) {
      if (deepCloned.surveyData.ownerName) {
        deepCloned.surveyData.ownerName = maskName(deepCloned.surveyData.ownerName);
      }
      if (deepCloned.surveyData.ownerPhone) {
        deepCloned.surveyData.ownerPhone = maskPii(deepCloned.surveyData.ownerPhone, 3, 3);
      }
      if (deepCloned.surveyData.ownerIdNumber) {
        deepCloned.surveyData.ownerIdNumber = maskPii(deepCloned.surveyData.ownerIdNumber, 3, 0);
      }
      if (deepCloned.surveyData.interviews) {
        if (deepCloned.surveyData.interviews.intervieweeName) {
          deepCloned.surveyData.interviews.intervieweeName = maskName(deepCloned.surveyData.interviews.intervieweeName);
        }
        if (deepCloned.surveyData.interviews.contactPhone) {
          deepCloned.surveyData.interviews.contactPhone = maskPii(deepCloned.surveyData.interviews.contactPhone, 3, 3);
        }
        if (deepCloned.surveyData.interviews.idCardNumber) {
          deepCloned.surveyData.interviews.idCardNumber = maskPii(deepCloned.surveyData.interviews.idCardNumber, 3, 0);
        }
      }
    }

    return deepCloned;
  } catch (err) {
    return report;
  }
}
