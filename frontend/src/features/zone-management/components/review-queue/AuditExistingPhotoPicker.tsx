import React, { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

export interface ReportPhotoPoolItem {
  url: string;
  category: string;
  label: string;
}

interface AuditExistingPhotoPickerProps {
  photos: ReportPhotoPoolItem[];
  isLoading: boolean;
  selectedUrls: string[];
  excludedUrl?: string;
  onToggle: (url: string) => void;
}

/** Ảnh gán lại là sao chép: ô đang chứa ảnh giữ nguyên, file trên kho ảnh không đổi. */
export const AuditExistingPhotoPicker: React.FC<AuditExistingPhotoPickerProps> = ({
  photos,
  isLoading,
  selectedUrls,
  excludedUrl,
  onToggle,
}) => {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const groups = useMemo(() => {
    const byLabel = new Map<string, ReportPhotoPoolItem[]>();
    for (const photo of photos) {
      if (photo.url === excludedUrl || failedUrls.includes(photo.url)) continue;
      byLabel.set(photo.label, [...(byLabel.get(photo.label) || []), photo]);
    }
    // Nhóm "Ảnh MỚI chụp lại" luôn đứng đầu, tách khỏi ảnh cũ để không chọn nhầm.
    const isNew = (items: ReportPhotoPoolItem[]) => items[0]?.category === 'RESURVEY_NEW';
    return [...byLabel.entries()].sort((a, b) => Number(isNew(b[1])) - Number(isNew(a[1])));
  }, [photos, excludedUrl, failedUrls]);

  if (isLoading) {
    return (
      <div className="h-32 flex items-center justify-center gap-2 text-xs text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Đang tải ảnh trong hồ sơ...</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return <div className="h-32 flex items-center justify-center text-xs text-slate-500 italic">Hồ sơ chưa có ảnh nào khác để chọn.</div>;
  }

  return (
    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
      {groups.map(([label, items]) => (
        <div key={label} className="space-y-1.5">
          <span
            className={`text-[11px] font-bold block ${
              items[0]?.category === 'RESURVEY_NEW'
                ? 'w-fit px-2 py-0.5 rounded-lg border bg-amber-950 text-amber-300 border-amber-700'
                : 'text-slate-700'
            }`}
          >
            {label} ({items.length})
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {items.map((photo) => {
              const isSelected = selectedUrls.includes(photo.url);
              return (
                <button
                  key={photo.url}
                  type="button"
                  onClick={() => onToggle(photo.url)}
                  className={`relative h-20 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                    isSelected ? 'border-sky-600 ring-2 ring-sky-200' : 'border-slate-200 hover:border-sky-300'
                  }`}
                >
                  <img
                    src={photo.url}
                    alt={label}
                    loading="lazy"
                    onError={() => setFailedUrls((prev) => [...prev, photo.url])}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
