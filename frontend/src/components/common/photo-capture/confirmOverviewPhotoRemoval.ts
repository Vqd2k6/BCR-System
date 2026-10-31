import { extractLocalIdFromUri, getOfflinePhoto, isPersistedPhotoUrl } from '../../../core/storage/offlinePhotoStorage';
import { planOverviewPhotoRemoval } from './domain/photoCollectionMutator';

/**
 * Kiểm tra và xin xác nhận trước khi xóa ảnh tổng quan.
 * Trả về danh sách mới, hoặc null nếu không được xóa / người dùng hủy.
 */
export async function confirmOverviewPhotoRemoval(params: {
  overviewPhotos: readonly string[] | undefined | null;
  ctxPhotoUrl: string | undefined | null;
  defectCount: number;
  index: number;
  ownerCode: string;
}): Promise<{ overviewPhotos: string[]; ctxPhotoUrl: string } | null> {
  const { ownerCode, ...removal } = params;
  const plan = planOverviewPhotoRemoval(removal);

  if (plan.blocked) {
    alert(
      `Không thể xóa: đây là ảnh bối cảnh (CTX) của ${ownerCode} đang mang ${params.defectCount} ghim khuyết tật D-xx. Vui lòng xử lý các ghim trước khi xóa ảnh.`
    );
    return null;
  }

  const photoUri = params.overviewPhotos?.[params.index] || '';
  if (photoUri.startsWith('blob:local://') && !isPersistedPhotoUrl(photoUri)) {
    const record = await getOfflinePhoto(extractLocalIdFromUri(photoUri));
    if (!record?.blob) {
      alert(
        'Không thể xóa: ảnh gốc không có trên thiết bị này và hệ thống đang cần tìm lại trên kho lưu trữ. Xóa lúc này sẽ mất liên kết tới ảnh vĩnh viễn. Vui lòng liên hệ Zone Admin.'
      );
      return null;
    }
  }

  if (!confirm(`Xóa ảnh #${params.index + 1} của ${ownerCode}? Thao tác này không thể hoàn tác.`)) {
    return null;
  }
  return { overviewPhotos: plan.overviewPhotos, ctxPhotoUrl: plan.ctxPhotoUrl };
}
