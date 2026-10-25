import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  ImageLabPreset,
  ImageEnhancementParams,
  ImageLabProcessResult,
} from '../../../../../image-lab/ForensicImageLabModal';

export interface SelectedStudioPhotoItem {
  url: string;
  originalUrl: string;
  title: string;
  photoCode?: string;
  rotation?: number;
  selectedAt: number;
}

export interface StudioCommittedPhotoInfo {
  originalUrl: string;
  previousUrl: string;
  enhancedUrl: string;
  photoCode: string;
  title: string;
  presetUsed: ImageLabPreset;
  appliedParams: ImageEnhancementParams;
  updatedAt: string;
  updatedBy?: string;
}

export interface StagedStudioAdjustment {
  photoUrl: string;
  originalUrl: string;
  photoCode?: string;
  title: string;
  result: ImageLabProcessResult;
  presetUsed: ImageLabPreset;
  appliedParams: ImageEnhancementParams;
  stagedAt: number;
}

export interface AuditStudioImgContextValue {
  reportId: string;
  isHoldingSKey: boolean;
  selectedPhotos: SelectedStudioPhotoItem[];
  isPhotoSelected: (url?: string) => boolean;
  toggleSelectPhoto: (item: {
    url: string;
    title?: string;
    photoCode?: string;
    rotation?: number;
  }) => void;
  removeSelectedPhoto: (url: string) => void;
  clearSelectedPhotos: () => void;
  stagedAdjustments: Record<string, StagedStudioAdjustment>;
  setStagedAdjustment: (url: string, adjustment: StagedStudioAdjustment) => void;
  removeStagedAdjustment: (url: string) => void;
  clearStagedAdjustments: () => void;
  committedPhotosMap: Record<string, StudioCommittedPhotoInfo>;
  committedByOriginalMap: Record<string, string>;
  resolveEffectiveStudioUrl: (url?: string) => string;
  resolveOriginalKsvUrl: (url?: string) => string;
  getStudioEnhancedInfo: (url?: string) => StudioCommittedPhotoInfo | null;
  registerCommittedPhotos: (
    items: StudioCommittedPhotoInfo[],
    enhancedMap?: Record<string, StudioCommittedPhotoInfo>,
    byOriginalMap?: Record<string, string>
  ) => void;
  isStudioModalOpen: boolean;
  setIsStudioModalOpen: (open: boolean) => void;
}

const AuditStudioImgContext = createContext<AuditStudioImgContextValue | null>(null);

export const useAuditStudioImg = (): AuditStudioImgContextValue => {
  const ctx = useContext(AuditStudioImgContext);
  if (!ctx) {
    throw new Error('useAuditStudioImg must be used within an AuditStudioImgProvider');
  }
  return ctx;
};

export const useAuditStudioImgOptional = (): AuditStudioImgContextValue | null => {
  return useContext(AuditStudioImgContext);
};

function isEditableElement(el: EventTarget | Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
}

interface ProviderProps {
  reportId: string;
  initialEnhancedPhotos?: Record<string, StudioCommittedPhotoInfo>;
  initialEnhancedByOriginal?: Record<string, string>;
  children: React.ReactNode;
}

export const AuditStudioImgProvider: React.FC<ProviderProps> = ({
  reportId,
  initialEnhancedPhotos,
  initialEnhancedByOriginal,
  children,
}) => {
  const [isHoldingSKey, setIsHoldingSKey] = useState<boolean>(false);
  const isHoldingSKeyRef = useRef<boolean>(false);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedStudioPhotoItem[]>([]);
  const [stagedAdjustments, setStagedAdjustments] = useState<Record<string, StagedStudioAdjustment>>({});
  const [isStudioModalOpen, setIsStudioModalOpen] = useState<boolean>(false);

  const [committedPhotosMap, setCommittedPhotosMap] = useState<Record<string, StudioCommittedPhotoInfo>>(
    () => initialEnhancedPhotos || {}
  );
  const [committedByOriginalMap, setCommittedByOriginalMap] = useState<Record<string, string>>(
    () => initialEnhancedByOriginal || {}
  );

  // Đồng bộ dữ liệu đã lưu từ Server khi tải lại hồ sơ
  useEffect(() => {
    if (initialEnhancedPhotos && Object.keys(initialEnhancedPhotos).length > 0) {
      setCommittedPhotosMap((prev) => ({ ...prev, ...initialEnhancedPhotos }));
    }
  }, [initialEnhancedPhotos]);

  useEffect(() => {
    if (initialEnhancedByOriginal && Object.keys(initialEnhancedByOriginal).length > 0) {
      setCommittedByOriginalMap((prev) => ({ ...prev, ...initialEnhancedByOriginal }));
    }
  }, [initialEnhancedByOriginal]);

  // Lắng nghe phím giữ S toàn cục để chọn ảnh bằng S + Click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isStudioModalOpen) return;
      if (isEditableElement(e.target) || isEditableElement(document.activeElement)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
        if (!isHoldingSKeyRef.current) {
          isHoldingSKeyRef.current = true;
          setIsHoldingSKey(true);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
        if (isHoldingSKeyRef.current) {
          isHoldingSKeyRef.current = false;
          setIsHoldingSKey(false);
        }
      }
    };

    const handleWindowBlur = () => {
      if (isHoldingSKeyRef.current) {
        isHoldingSKeyRef.current = false;
        setIsHoldingSKey(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isStudioModalOpen]);

  const resolveEffectiveStudioUrl = useCallback(
    (url?: string): string => {
      if (!url || typeof url !== 'string') return '';
      const trimmed = url.trim();
      return committedByOriginalMap[trimmed] || committedByOriginalMap[url] || trimmed;
    },
    [committedByOriginalMap]
  );

  const resolveOriginalKsvUrl = useCallback(
    (url?: string): string => {
      if (!url || typeof url !== 'string') return '';
      const trimmed = url.trim();
      const info = committedPhotosMap[trimmed] || committedPhotosMap[resolveEffectiveStudioUrl(trimmed)];
      return info?.originalUrl || trimmed;
    },
    [committedPhotosMap, resolveEffectiveStudioUrl]
  );

  const getStudioEnhancedInfo = useCallback(
    (url?: string): StudioCommittedPhotoInfo | null => {
      if (!url || typeof url !== 'string') return null;
      const trimmed = url.trim();
      if (!trimmed) return null;
      const effective = resolveEffectiveStudioUrl(trimmed);
      if (committedPhotosMap[effective]) {
        return committedPhotosMap[effective];
      }
      if (committedPhotosMap[trimmed]) {
        return committedPhotosMap[trimmed];
      }
      if (effective.includes('/studio-img/') || effective.includes('studio_')) {
        return {
          originalUrl: trimmed,
          previousUrl: trimmed,
          enhancedUrl: effective,
          photoCode: 'STUDIO_IMG',
          title: 'Ảnh đã hiệu chỉnh qua Studio Img',
          presetUsed: 'AUTO_SMART',
          appliedParams: {
            enableClahe: true,
            claheTileSize: 160,
            claheMaxSlope: 2,
            gamma: 1.45,
            brightness: 1.05,
            saturation: 0.98,
            crackValleyBoost: 0,
            medianSize: 0,
            sharpenSigma: 1.15,
            sharpenFlatM1: 0,
            sharpenJaggedM2: 2.4,
            normalizeHistogram: true,
            invertNegative: false,
          },
          updatedAt: new Date().toISOString(),
        };
      }
      return null;
    },
    [committedPhotosMap, resolveEffectiveStudioUrl]
  );

  const isPhotoSelected = useCallback(
    (url?: string): boolean => {
      if (!url || typeof url !== 'string') return false;
      const trimmed = url.trim();
      const effective = resolveEffectiveStudioUrl(trimmed);
      const orig = resolveOriginalKsvUrl(trimmed);
      return selectedPhotos.some(
        (item) =>
          item.url === trimmed ||
          item.url === effective ||
          item.originalUrl === orig ||
          item.originalUrl === trimmed
      );
    },
    [selectedPhotos, resolveEffectiveStudioUrl, resolveOriginalKsvUrl]
  );

  const toggleSelectPhoto = useCallback(
    (item: { url: string; title?: string; photoCode?: string; rotation?: number }) => {
      const rawUrl = (item.url || '').trim();
      if (!rawUrl || rawUrl.startsWith('blob:')) return;
      const effectiveUrl = resolveEffectiveStudioUrl(rawUrl);
      const origUrl = resolveOriginalKsvUrl(rawUrl);

      setSelectedPhotos((prev) => {
        const exists = prev.some(
          (p) =>
            p.url === rawUrl ||
            p.url === effectiveUrl ||
            p.originalUrl === origUrl ||
            p.originalUrl === rawUrl
        );
        if (exists) {
          return prev.filter(
            (p) =>
              p.url !== rawUrl &&
              p.url !== effectiveUrl &&
              p.originalUrl !== origUrl &&
              p.originalUrl !== rawUrl
          );
        }
        return [
          ...prev,
          {
            url: effectiveUrl,
            originalUrl: origUrl,
            title: item.title || item.photoCode || 'Ảnh hiện trường',
            photoCode: item.photoCode,
            rotation: item.rotation ?? 0,
            selectedAt: Date.now(),
          },
        ];
      });
    },
    [resolveEffectiveStudioUrl, resolveOriginalKsvUrl]
  );

  const removeSelectedPhoto = useCallback((url: string) => {
    const trimmed = url.trim();
    setSelectedPhotos((prev) =>
      prev.filter((p) => p.url !== trimmed && p.originalUrl !== trimmed)
    );
    setStagedAdjustments((prev) => {
      const next = { ...prev };
      delete next[trimmed];
      return next;
    });
  }, []);

  const clearSelectedPhotos = useCallback(() => {
    setSelectedPhotos([]);
    setStagedAdjustments({});
  }, []);

  const setStagedAdjustment = useCallback((url: string, adjustment: StagedStudioAdjustment) => {
    setStagedAdjustments((prev) => ({
      ...prev,
      [url.trim()]: adjustment,
    }));
  }, []);

  const removeStagedAdjustment = useCallback((url: string) => {
    setStagedAdjustments((prev) => {
      const next = { ...prev };
      delete next[url.trim()];
      return next;
    });
  }, []);

  const clearStagedAdjustments = useCallback(() => {
    setStagedAdjustments({});
  }, []);

  const registerCommittedPhotos = useCallback(
    (
      items: StudioCommittedPhotoInfo[],
      enhancedMap?: Record<string, StudioCommittedPhotoInfo>,
      byOriginalMap?: Record<string, string>
    ) => {
      setCommittedPhotosMap((prev) => {
        const next = { ...prev, ...(enhancedMap || {}) };
        for (const item of items) {
          next[item.enhancedUrl] = item;
        }
        return next;
      });

      setCommittedByOriginalMap((prev) => {
        const next = { ...prev, ...(byOriginalMap || {}) };
        for (const item of items) {
          next[item.originalUrl] = item.enhancedUrl;
          next[item.previousUrl] = item.enhancedUrl;
        }
        return next;
      });

      // Cập nhật danh sách ảnh đang chọn sang URL mới và xóa trạng thái chờ lưu của các ảnh đã lưu
      setSelectedPhotos((prev) =>
        prev.map((sel) => {
          const matched = items.find(
            (c) =>
              c.originalUrl === sel.originalUrl ||
              c.previousUrl === sel.url ||
              c.originalUrl === sel.url
          );
          if (matched) {
            return {
              ...sel,
              url: matched.enhancedUrl,
              originalUrl: matched.originalUrl,
            };
          }
          return sel;
        })
      );

      setStagedAdjustments((prev) => {
        const next = { ...prev };
        for (const item of items) {
          delete next[item.originalUrl];
          delete next[item.previousUrl];
          delete next[item.enhancedUrl];
        }
        return next;
      });
    },
    []
  );

  const contextValue = useMemo<AuditStudioImgContextValue>(
    () => ({
      reportId,
      isHoldingSKey,
      selectedPhotos,
      isPhotoSelected,
      toggleSelectPhoto,
      removeSelectedPhoto,
      clearSelectedPhotos,
      stagedAdjustments,
      setStagedAdjustment,
      removeStagedAdjustment,
      clearStagedAdjustments,
      committedPhotosMap,
      committedByOriginalMap,
      resolveEffectiveStudioUrl,
      resolveOriginalKsvUrl,
      getStudioEnhancedInfo,
      registerCommittedPhotos,
      isStudioModalOpen,
      setIsStudioModalOpen,
    }),
    [
      reportId,
      isHoldingSKey,
      selectedPhotos,
      isPhotoSelected,
      toggleSelectPhoto,
      removeSelectedPhoto,
      clearSelectedPhotos,
      stagedAdjustments,
      setStagedAdjustment,
      removeStagedAdjustment,
      clearStagedAdjustments,
      committedPhotosMap,
      committedByOriginalMap,
      resolveEffectiveStudioUrl,
      resolveOriginalKsvUrl,
      getStudioEnhancedInfo,
      registerCommittedPhotos,
      isStudioModalOpen,
    ]
  );

  return (
    <AuditStudioImgContext.Provider value={contextValue}>
      {children}
    </AuditStudioImgContext.Provider>
  );
};

