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

    // 1. Root-level properties (Direct SQL columns on base_survey_reports / parcels)
    if (deepCloned.owner_name) {
      deepCloned.owner_name = maskName(deepCloned.owner_name);
    }
    if (deepCloned.owner_phone) {
      deepCloned.owner_phone = maskPii(deepCloned.owner_phone, 3, 3);
    }
    if (deepCloned.owner_id_card) {
      deepCloned.owner_id_card = maskPii(deepCloned.owner_id_card, 3, 0);
    }
    if (deepCloned.owner_signature_url) {
      deepCloned.owner_signature_url = null;
    }
    if (deepCloned.owner_signature_img) {
      deepCloned.owner_signature_img = null;
    }

    // 2. Nested report object (if wrapped as { report: ... })
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
      if (deepCloned.report.owner_signature_url) {
        deepCloned.report.owner_signature_url = null;
      }
      if (deepCloned.report.owner_signature_img) {
        deepCloned.report.owner_signature_img = null;
      }
    }

    // 3. survey_data_json / surveyData JSON payload
    const sData = deepCloned.survey_data_json || deepCloned.surveyData;
    if (sData) {
      if (sData.ownerName) {
        sData.ownerName = maskName(sData.ownerName);
      }
      if (sData.ownerPhone) {
        sData.ownerPhone = maskPii(sData.ownerPhone, 3, 3);
      }
      if (sData.ownerIdNumber) {
        sData.ownerIdNumber = maskPii(sData.ownerIdNumber, 3, 0);
      }
      if (sData.signatures?.ownerRepresentative) {
        if (sData.signatures.ownerRepresentative.fullName) {
          sData.signatures.ownerRepresentative.fullName = maskName(sData.signatures.ownerRepresentative.fullName);
        }
        if (sData.signatures.ownerRepresentative.phone) {
          sData.signatures.ownerRepresentative.phone = maskPii(sData.signatures.ownerRepresentative.phone, 3, 3);
        }
        if (sData.signatures.ownerRepresentative.signatureImg) {
          sData.signatures.ownerRepresentative.signatureImg = null;
        }
        if (sData.signatures.ownerRepresentative.signatureImageUrl) {
          sData.signatures.ownerRepresentative.signatureImageUrl = null;
        }
      }
      if (sData.interviews) {
        if (sData.interviews.intervieweeName) {
          sData.interviews.intervieweeName = maskName(sData.interviews.intervieweeName);
        }
        if (sData.interviews.contactPhone) {
          sData.interviews.contactPhone = maskPii(sData.interviews.contactPhone, 3, 3);
        }
        if (sData.interviews.idCardNumber) {
          sData.interviews.idCardNumber = maskPii(sData.interviews.idCardNumber, 3, 0);
        }
      }
    }

    deepCloned.isPiiMasked = true;
    return deepCloned;
  } catch (err) {
    return report;
  }
}
