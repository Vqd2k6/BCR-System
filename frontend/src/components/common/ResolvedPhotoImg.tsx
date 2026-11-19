import type { ImgHTMLAttributes } from 'react';
import { useResolvedPhotoUrl } from '../../core/storage/useResolvedPhotoUrl';

type ResolvedPhotoImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  /** URI ảnh gốc: blob:local://…, URL Cloud (https / /uploads) hoặc data: */
  src?: string | null;
};

/**
 * <img> cho ảnh hiện trường: phân giải `blob:local://` từ IndexedDB và hiển thị bản cục bộ cho ảnh
 * do chính máy này chụp & đã upload (không tải ngược từ R2 qua 4G). Ảnh từ máy khác tải HTTPS như thường.
 */
export function ResolvedPhotoImg({ src, alt, ...imgProps }: ResolvedPhotoImgProps) {
  const { displayUrl } = useResolvedPhotoUrl(src);
  return <img {...imgProps} src={displayUrl || undefined} alt={alt} />;
}
