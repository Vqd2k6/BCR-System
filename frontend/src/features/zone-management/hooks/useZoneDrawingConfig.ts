import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/utils/errorUtils';
import { api } from '../../../services/api';

/** Cấu hình khung tên bình đồ của Zone, khớp `ZoneDrawingConfig` ở backend/src/modules/drawing_config. */
export interface ZoneDrawingTitleBlockDto {
  id: string;
  zoneCode: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  manager: string;
  projectManager: string;
  drawingNo: string;
  updatedByName: string | null;
  updatedAt: string;
}

export interface ZoneDrawingRevisionDto {
  id: string;
  revision: string;
  revisionNumber: number;
  issueDate: string;
  description: string;
  createdByName: string | null;
  createdAt: string;
}

export interface ZoneDrawingConfigDto {
  zoneCode: string;
  titleBlock: ZoneDrawingTitleBlockDto | null;
  revisions: ZoneDrawingRevisionDto[];
}

export interface TitleBlockFormValues {
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  manager: string;
  projectManager: string;
  drawingNo: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isConfig = (value: unknown): value is ZoneDrawingConfigDto =>
  isRecord(value) && typeof value.zoneCode === 'string' && Array.isArray(value.revisions);

export const useZoneDrawingConfig = (zoneCode: string) => {
  const [config, setConfig] = useState<ZoneDrawingConfigDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const load = useCallback(async (isStale: () => boolean = () => false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get(`/zones/${encodeURIComponent(zoneCode)}/drawing-title-block`);
      const data: unknown = res.data?.data;
      if (!isConfig(data)) throw new Error('Máy chủ không trả về cấu hình khung tên hợp lệ');
      if (!isStale()) setConfig(data);
    } catch (err: unknown) {
      console.error('[ZoneSvgExport:LoadTitleBlock] Failed to load drawing title block:', err);
      if (!isStale()) {
        setConfig(null);
        setError(getErrorMessage(err, 'Không tải được cấu hình khung tên, đang dùng giá trị bản vẽ mẫu.'));
      }
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  }, [zoneCode]);

  useEffect(() => {
    let stale = false;
    load(() => stale);
    return () => {
      stale = true;
    };
  }, [load]);

  /** Trả về null nếu thành công, ngược lại là thông báo lỗi để hiển thị; lỗi luôn được log. */
  const saveTitleBlock = async (values: TitleBlockFormValues): Promise<string | null> => {
    setIsSaving(true);
    try {
      await api.put(`/zones/${encodeURIComponent(zoneCode)}/drawing-title-block`, values);
      await load();
      return null;
    } catch (err: unknown) {
      console.error('[ZoneSvgExport:SaveTitleBlock] Failed to save drawing title block:', err);
      return getErrorMessage(err, 'Không lưu được khung tên.');
    } finally {
      setIsSaving(false);
    }
  };

  const issueRevision = async (issueDate: string, description: string): Promise<string | null> => {
    setIsSaving(true);
    try {
      await api.post(`/zones/${encodeURIComponent(zoneCode)}/drawing-revisions`, { issueDate, description });
      await load();
      return null;
    } catch (err: unknown) {
      console.error('[ZoneSvgExport:IssueRevision] Failed to issue drawing revision:', err);
      return getErrorMessage(err, 'Không phát hành được lần mới.');
    } finally {
      setIsSaving(false);
    }
  };

  return { config, isLoading, error, isSaving, saveTitleBlock, issueRevision };
};
