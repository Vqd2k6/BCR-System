import { StateCreator } from 'zustand';
import { Phase1SurveyStore, NavigationSlice } from '../types';
import { validateStep, validateAllSteps, MissingFieldItem } from '../../utils/stepValidator';

export const createNavigationSlice: StateCreator<
  Phase1SurveyStore,
  [],
  [],
  NavigationSlice
> = (set, get) => ({
  currentStep: 1,
  missingModal: null,

  setCurrentStep: (step: number) => {
    if (step >= 1 && step <= 8) {
      if (!get().isReadOnly) {
        get().recalculateScores();
        get().saveDraftToStorage();
        get().syncDraftToServer();
      }
      set({ currentStep: step, missingModal: null });
    }
  },

  requestStepNavigation: (targetStep: number) => {
    const { currentStep, formData, isReadOnly } = get();
    if (targetStep === currentStep) return;

    // Khi ở chế độ xem lại (Read-Only) hoặc chuyển về bước trước -> Cho phép chuyển bước tự do không block
    if (isReadOnly || targetStep < currentStep) {
      get().setCurrentStep(targetStep);
      return;
    }

    // Navigating forward -> validate current step
    const validation = validateStep(currentStep, formData);
    if (!validation.isValid) {
      set({
        missingModal: {
          isOpen: true,
          missingFields: validation.missingFields,
          targetStep,
        },
      });
      return;
    }

    get().setCurrentStep(targetStep);
  },

  nextStep: () => {
    const { currentStep, isReadOnly } = get();
    if (currentStep < 8) {
      if (isReadOnly) {
        get().setCurrentStep(currentStep + 1);
      } else {
        get().requestStepNavigation(currentStep + 1);
      }
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      get().setCurrentStep(currentStep - 1);
    }
  },

  closeMissingModal: () => {
    set({ missingModal: null });
  },

  proceedAnyway: () => {
    const { missingModal } = get();
    if (missingModal) {
      const hasBlocking = missingModal.missingFields.some((f) => f.isBlocking);
      if (hasBlocking) {
        return;
      }
      const target = missingModal.targetStep;
      get().saveDraftToStorage();
      set({ missingModal: null });
      if (target >= 1 && target <= 8) {
        get().setCurrentStep(target);
      }
    }
  },

  focusMissingField: (item: MissingFieldItem) => {
    const { currentStep } = get();
    set({ missingModal: null });

    if (item.step !== currentStep) {
      get().setCurrentStep(item.step);
    }

    // Nếu là bước 3 (Khảo sát tầng/không gian chi tiết), phát sự kiện chuyển phân cấp sâu
    if (item.step === 3) {
      window.dispatchEvent(
        new CustomEvent('ksqh-focus-step3-hierarchy', {
          detail: {
            floorIndex: item.floorIndex,
            zoneIndex: item.zoneIndex,
            elementIndex: item.elementIndex,
            subSection: item.subSection,
            fieldId: item.fieldId,
          },
        })
      );
    }

    // Nếu trường còn thiếu thuộc tầng cụ thể (floorIndex), phát sự kiện chuyển tab tầng trước (tương thích ngược)
    if (item.floorIndex !== undefined) {
      window.dispatchEvent(
        new CustomEvent('ksqh-focus-floor', {
          detail: { floorIndex: item.floorIndex },
        })
      );
    }

    setTimeout(() => {
      let el = document.getElementById(item.fieldId);
      if (!el) {
        el = document.querySelector(`[name="${item.fieldId}"]`) ||
             document.querySelector(`[data-field-id="${item.fieldId}"]`) ||
             document.querySelector(`.${item.fieldId}`) as HTMLElement | null;
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-red-400', 'bg-red-50/50', 'transition-all', 'duration-300');
        setTimeout(() => {
          el?.classList.remove('ring-4', 'ring-red-400', 'bg-red-50/50', 'transition-all', 'duration-300');
        }, 3500);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          el.focus();
        } else {
          const childInput = el.querySelector('input, select, textarea, button') as HTMLElement | null;
          if (childInput) childInput.focus();
        }
      }
    }, item.floorIndex !== undefined || item.zoneIndex !== undefined ? 450 : 250);
  },

  validateForFinalSubmit: () => {
    const { formData } = get();
    const validation = validateAllSteps(formData);
    if (!validation.isValid) {
      set({
        missingModal: {
          isOpen: true,
          missingFields: validation.missingFields,
          targetStep: 10,
        },
      });
      return false;
    }
    return true;
  },
});
