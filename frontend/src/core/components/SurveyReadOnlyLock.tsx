import React from 'react';
import { SurveyReadOnlyProvider } from '../context/SurveyReadOnlyContext';

export interface SurveyReadOnlyLockProps {
  readOnly: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * Component bọc bảo vệ chế độ Chỉ-Đọc (Triple-Lock UI Protection):
 * 1. Cung cấp SurveyReadOnlyContext cho các component con (PhotoCaptureInput, Canvas, Badges).
 * 2. Gắn attribute data-survey-readonly="true" và inject style chặn pointer-events,
 *    chuyển màu nền xám mờ chuẩn ISO cho toàn bộ input, textarea, select, checkbox, radio.
 */
export const SurveyReadOnlyLock: React.FC<SurveyReadOnlyLockProps> = ({
  readOnly,
  children,
  className,
  id,
}) => {
  return (
    <SurveyReadOnlyProvider value={readOnly}>
      <div
        id={id}
        data-survey-readonly={readOnly ? 'true' : undefined}
        className={className}
      >
        {readOnly && (
          <style>{`
            [data-survey-readonly="true"] input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),
            [data-survey-readonly="true"] textarea,
            [data-survey-readonly="true"] select {
              pointer-events: none !important;
              background-color: #f8fafc !important;
              border-color: #cbd5e1 !important;
              color: #334155 !important;
              cursor: default !important;
              user-select: text !important;
            }
            [data-survey-readonly="true"] input[type="checkbox"],
            [data-survey-readonly="true"] input[type="radio"] {
              pointer-events: none !important;
              cursor: default !important;
            }
          `}</style>
        )}
        {children}
      </div>
    </SurveyReadOnlyProvider>
  );
};
