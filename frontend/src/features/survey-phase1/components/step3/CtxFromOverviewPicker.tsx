import React, { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useResolvedPhotoUrl } from '../../../../core/storage/useResolvedPhotoUrl';
import { confirmCtxReplace, keepCtxLink } from './confirmCtxReplace';

interface CtxFromOverviewPickerProps {
  overviewPhotos?: string[];
  ctxPhotoUrl?: string;
  defectCount: number;
  readOnly?: boolean;
  onSelect: (url: string, overviewPhotos: string[]) => void;
}

// Ảnh không có trên thiết bị / link hỏng thì không đưa vào danh sách chọn, tránh thay ảnh lỗi bằng ảnh lỗi khác
const OverviewOption: React.FC<{ url: string; index: number; onSelect: (url: string) => void }> = ({
  url,
  index,
  onSelect,
}) => {
  const { displayUrl, isResolving } = useResolvedPhotoUrl(url);
  const [hasFailed, setHasFailed] = useState<boolean>(false);

  useEffect(() => {
    setHasFailed(false);
  }, [displayUrl]);

  if (isResolving || !displayUrl || hasFailed) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(url)}
      className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-300 hover:ring-2 hover:ring-emerald-500 transition-all cursor-pointer"
      title={`Dùng ảnh tổng quan #${index + 1} làm ảnh bối cảnh`}
    >
      <img
        src={displayUrl}
        alt={`Ảnh tổng quan #${index + 1}`}
        onError={() => setHasFailed(true)}
        className="w-full h-full object-cover"
      />
      <span className="absolute top-0.5 left-0.5 px-1 rounded bg-slate-900/80 text-white text-[10px] font-bold">
        #{index + 1}
      </span>
    </button>
  );
};

export const CtxFromOverviewPicker: React.FC<CtxFromOverviewPickerProps> = ({
  overviewPhotos,
  ctxPhotoUrl,
  defectCount,
  readOnly,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const candidates = (overviewPhotos || []).filter((url) => url && url !== ctxPhotoUrl);

  if (readOnly || candidates.length === 0) return null;

  const handleSelect = (url: string) => {
    if (!confirmCtxReplace({ defectCount, ctxPhotoUrl, overviewPhotos, keepsOldPhotoLink: true })) return;
    onSelect(url, keepCtxLink(ctxPhotoUrl, overviewPhotos));
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
      >
        <ImagePlus className="w-3.5 h-3.5 text-slate-500" />
        <span>Dùng ảnh tổng quan làm CTX</span>
      </button>

      {isOpen && (
        <div className="flex flex-wrap gap-2">
          {overviewPhotos?.map((url, index) =>
            url && url !== ctxPhotoUrl ? (
              <OverviewOption key={url} url={url} index={index} onSelect={handleSelect} />
            ) : null
          )}
        </div>
      )}
    </div>
  );
};
