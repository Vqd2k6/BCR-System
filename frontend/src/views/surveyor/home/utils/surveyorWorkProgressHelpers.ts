import type { GisParcel } from '../../../../components/gis/LeafletSweepMap';
import type { User } from '../../../../core/types/domain.types';
import { getStatus } from './surveyorHomeHelpers';

export interface WorkProgressItem {
  parcel: GisParcel;
  status: string;
  updatedAt: Date | null;
  formattedTime: string;
  surveyorId?: string;
  surveyorName?: string;
  surveyorCode?: string;
  isCurrentUser: boolean;
}

/**
 * Kiểm tra xem một thời điểm có nằm trong ngày hôm nay không (Local time)
 */
export const isToday = (dateInput: string | Date | number | null | undefined): boolean => {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

/**
 * Kiểm tra xem một thời điểm có nằm trong tuần hiện tại (tính từ 00:00 Thứ 2) không
 */
export const isThisWeek = (dateInput: string | Date | number | null | undefined): boolean => {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const now = new Date();

  // Tìm Thứ Hai đầu tuần của tuần hiện tại (0: Chủ Nhật, 1: Thứ Hai, ...)
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return d >= startOfWeek && d < endOfWeek;
};

/**
 * Định dạng thời gian cập nhật gần nhất thân thiện, dễ đọc cho khảo sát viên
 */
export const formatRelativeUpdateTime = (dateInput: string | Date | number | null | undefined): string => {
  if (!dateInput) return 'Chưa cập nhật';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Chưa cập nhật';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  // Nếu chênh lệch âm (đồng hồ máy trôi nhanh) hoặc vừa xong dưới 1 phút
  if (diffMs < 60000 && diffMs >= -5000) {
    return 'Vừa cập nhật';
  }

  // Dưới 60 phút
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes >= 1 && diffMinutes < 60) {
    return `${diffMinutes} phút trước`;
  }

  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Trong ngày hôm nay
  if (isToday(d)) {
    return `${timeStr} hôm nay`;
  }

  // Trong tuần này
  if (isThisWeek(d)) {
    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const dayName = dayNames[d.getDay()];
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    return `${dayName}, ${dateStr} (${timeStr})`;
  }

  // Khác tuần
  const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  return `${dateStr} ${timeStr}`;
};

/**
 * Trích xuất thời điểm cập nhật chính xác nhất từ Parcel (kết hợp CSDL và LocalStorage draft)
 */
export const getEffectiveUpdatedAt = (parcel: GisParcel): Date | null => {
  const rawUpdated = parcel.updatedAt || parcel.updated_at || null;
  let effectiveDateStr: string | null = rawUpdated instanceof Date ? rawUpdated.toISOString() : (rawUpdated ? String(rawUpdated) : null);

  // Kiểm tra override hoặc draft trong LocalStorage nếu có
  if (parcel.id) {
    try {
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      if (overridesStr) {
        const overrides = JSON.parse(overridesStr);
        if (overrides[parcel.id]?.updatedAt) {
          effectiveDateStr = overrides[parcel.id].updatedAt;
        }
      }
    } catch (_e) {}

    try {
      const draft = localStorage.getItem(`metro2_phase1_draft_${parcel.id}`);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.lastSavedAt || parsed.updatedAt) {
          const draftDate = new Date(parsed.lastSavedAt || parsed.updatedAt);
          if (!isNaN(draftDate.getTime())) {
            // Nếu draft mới hơn ngày hiện tại của parcel thì ưu tiên draft
            if (!effectiveDateStr || draftDate > new Date(effectiveDateStr)) {
              effectiveDateStr = parsed.lastSavedAt || parsed.updatedAt;
            }
          }
        }
      }
    } catch (_e) {}
  }

  if (!effectiveDateStr) return null;
  const d = new Date(effectiveDateStr);
  return isNaN(d.getTime()) ? null : d;
};

export interface FilteredWorkProgress {
  inProgressToday: WorkProgressItem[];
  inProgressThisWeek: WorkProgressItem[];
  completedToday: WorkProgressItem[];
  completedThisWeek: WorkProgressItem[];
}

/**
 * Phân loại danh sách thửa đất theo 3 nhóm tiến độ công việc thực tế
 */
export const filterParcelsByWorkProgress = (
  parcels: GisParcel[],
  currentUser?: User | null
): FilteredWorkProgress => {
  const inProgressToday: WorkProgressItem[] = [];
  const inProgressThisWeek: WorkProgressItem[] = [];
  const completedToday: WorkProgressItem[] = [];
  const completedThisWeek: WorkProgressItem[] = [];

  (parcels || []).forEach((p) => {
    if (!p) return;
    const status = getStatus(p);
    const updatedDate = getEffectiveUpdatedAt(p);
    const formattedTime = formatRelativeUpdateTime(updatedDate);

    // Kiểm tra quyền sở hữu công việc: Của ai nhìn thấy của người ấy
    const hasLocalDraft = typeof window !== 'undefined' && !!localStorage.getItem(`metro2_phase1_draft_${p.id}`);
    const isAssignedToCurrentUser = currentUser ? (
      (p.assignedSurveyorId && currentUser.id && p.assignedSurveyorId === currentUser.id) ||
      (p.assignedSurveyorCode && currentUser.surveyorCode && p.assignedSurveyorCode === currentUser.surveyorCode) ||
      (p.assignedSurveyorName && currentUser.fullName && p.assignedSurveyorName === currentUser.fullName)
    ) : false;

    const isMine = isAssignedToCurrentUser || hasLocalDraft;

    // Nếu người dùng đăng nhập là SURVEYOR, chỉ hiển thị bài của chính mình ("Của ai nhìn thấy của người ấy")
    if (currentUser?.role === 'SURVEYOR' && !isMine) {
      return;
    }

    const surveyorName = isMine && (!p.assignedSurveyorName || p.assignedSurveyorName === currentUser?.fullName)
      ? (currentUser?.fullName || p.assignedSurveyorName || 'Tôi')
      : (p.assignedSurveyorName || 'Khảo sát viên');

    const surveyorCode = isMine && (!p.assignedSurveyorCode || p.assignedSurveyorCode === currentUser?.surveyorCode)
      ? (currentUser?.surveyorCode || p.assignedSurveyorCode)
      : p.assignedSurveyorCode;

    const item: WorkProgressItem = {
      parcel: p,
      status,
      updatedAt: updatedDate,
      formattedTime,
      surveyorId: isMine ? (currentUser?.id || p.assignedSurveyorId) : p.assignedSurveyorId,
      surveyorName,
      surveyorCode,
      isCurrentUser: isMine,
    };

    // Nhóm 1 & 2: Đang làm dở (IN_PROGRESS)
    if (status === 'IN_PROGRESS') {
      if (isToday(updatedDate)) {
        inProgressToday.push(item);
      } else if (isThisWeek(updatedDate)) {
        inProgressThisWeek.push(item);
      } else {
        // Nếu không có ngày hoặc từ tuần trước nhưng vẫn dở dang, đưa vào dở tuần này để theo dõi xử lý
        inProgressThisWeek.push(item);
      }
    }

    // Nhóm 3: Đã hoàn tất (SUBMITTED, APPROVED, PHASE2_COMPLETED, APPROVED_PHASE2)
    const isCompleted =
      status === 'SUBMITTED' ||
      status === 'APPROVED' ||
      status === 'PHASE2_COMPLETED' ||
      status === 'APPROVED_PHASE2';

    if (isCompleted) {
      if (isToday(updatedDate)) {
        completedToday.push(item);
      }
      if (isThisWeek(updatedDate) || isToday(updatedDate)) {
        completedThisWeek.push(item);
      }
    }
  });

  // Sắp xếp theo thời gian cập nhật gần nhất lên đầu
  const sortByLatest = (a: WorkProgressItem, b: WorkProgressItem) => {
    const tA = a.updatedAt ? a.updatedAt.getTime() : 0;
    const tB = b.updatedAt ? b.updatedAt.getTime() : 0;
    return tB - tA;
  };

  inProgressToday.sort(sortByLatest);
  inProgressThisWeek.sort(sortByLatest);
  completedToday.sort(sortByLatest);
  completedThisWeek.sort(sortByLatest);

  return {
    inProgressToday,
    inProgressThisWeek,
    completedToday,
    completedThisWeek,
  };
};
