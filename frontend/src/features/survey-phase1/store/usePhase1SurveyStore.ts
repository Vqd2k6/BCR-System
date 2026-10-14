import { create } from 'zustand';
import type { Phase1SurveyStore } from './types';
import { getDefaultInitialFormData } from './initialFormData';
import { createNavigationSlice } from './slices/navigationSlice';
import { createSyncSlice } from './slices/syncSlice';
import { createFormSlice } from './slices/formSlice';
import { replaceLocalUriInObject } from '../../../core/storage/offlinePhotoStorage';

export { getDefaultInitialFormData };
export type { Phase1SurveyStore };

export const usePhase1SurveyStore = create<Phase1SurveyStore>((...a) => ({
  ...createNavigationSlice(...a),
  ...createSyncSlice(...a),
  ...createFormSlice(...a),
}));

// Lắng nghe sự kiện toàn cục khi một ảnh blob:local:// được đẩy thành công lên Cloudflare R2
// Ngay lập tức thay thế chuỗi blob:local:// tương ứng trong formData bằng Cloud URL chuẩn
if (typeof window !== 'undefined') {
  window.addEventListener('metro2:photo-promoted', (e: Event) => {
    const customEvt = e as CustomEvent<{ localId: string; publicUrl: string }>;
    if (!customEvt.detail?.localId || !customEvt.detail?.publicUrl) return;
    const { localId, publicUrl } = customEvt.detail;

    usePhase1SurveyStore.setState((state) => {
      const updatedFormData = replaceLocalUriInObject(state.formData, localId, publicUrl);
      return { formData: updatedFormData };
    });
  });
}
