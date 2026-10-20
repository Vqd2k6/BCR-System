import api from '../../../services/api';

export interface BilingualText {
  vi: string;
  en: string;
}

export interface StandardTextContent {
  recommendations: BilingualText[];
  pendingItems: BilingualText[];
  calibrationNote: BilingualText | null;
  asteriskFootnote: BilingualText | null;
}

export interface StandardTextVersion {
  id: string;
  versionNumber: number;
  content: StandardTextContent;
  changeReason: string;
  createdByUserId: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface SurveyEquipmentItem {
  id: string;
  sortOrder: number;
  nameVi: string;
  nameEn: string;
  specificationVi: string;
  specificationEn: string;
  purposeVi: string;
  purposeEn: string;
  model: string | null;
  serialNo: string | null;
  calibrationCertNo: string | null;
  calibrationValidTo: string | null;
}

export interface EquipmentInput {
  sortOrder: number;
  nameVi: string;
  nameEn?: string;
  specificationVi?: string;
  specificationEn?: string;
  purposeVi?: string;
  purposeEn?: string;
  model?: string | null;
  serialNo?: string | null;
  calibrationCertNo?: string | null;
  calibrationValidTo?: string | null;
}

export const reportConfigService = {
  async listStandardTextVersions(): Promise<StandardTextVersion[]> {
    const res = await api.get<{ success: boolean; data: StandardTextVersion[] }>(
      '/admin/report-config/standard-text'
    );
    return res.data.data;
  },

  async createStandardTextVersion(
    content: StandardTextContent,
    changeReason: string
  ): Promise<StandardTextVersion> {
    const res = await api.post<{ success: boolean; data: StandardTextVersion }>(
      '/admin/report-config/standard-text',
      { content, changeReason }
    );
    return res.data.data;
  },

  async listEquipment(): Promise<SurveyEquipmentItem[]> {
    const res = await api.get<{ success: boolean; data: SurveyEquipmentItem[] }>(
      '/admin/report-config/equipment'
    );
    return res.data.data;
  },

  async createEquipment(input: EquipmentInput): Promise<SurveyEquipmentItem> {
    const res = await api.post<{ success: boolean; data: SurveyEquipmentItem }>(
      '/admin/report-config/equipment',
      input
    );
    return res.data.data;
  },

  async updateEquipment(id: string, input: EquipmentInput): Promise<SurveyEquipmentItem> {
    const res = await api.put<{ success: boolean; data: SurveyEquipmentItem }>(
      `/admin/report-config/equipment/${id}`,
      input
    );
    return res.data.data;
  },

  async deleteEquipment(id: string, reason: string): Promise<void> {
    await api.delete(`/admin/report-config/equipment/${id}`, {
      data: { reason },
    });
  },
};
