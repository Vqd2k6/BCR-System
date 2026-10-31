import React from 'react';
import { FileSignature, Paperclip } from 'lucide-react';
import { AuditSignatureCard } from '../../stepwise/ui/AuditSignatureCard';
import { AuditSubsection } from '../../stepwise/ui/AuditStepSection';
import type { StepwiseSignatures } from '../../stepwise/types';
import { firstNonEmptyString, toRecord } from './condo-normalize.utils';
import { CondoPhotoCard } from './CondoPhotoCard';

interface CondoSignoffSectionProps {
  signatures: StepwiseSignatures;
  counterpartRole: string;
  counterpartName?: string;
  counterpartNote?: string;
  counterpartEmptyText?: string;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
}

/** Bước 09: chữ ký hiện trường và ảnh biên bản đã ký, dùng chung cho Master, M-Area và Unit. */
export const CondoSignoffSection: React.FC<CondoSignoffSectionProps> = ({
  signatures,
  counterpartRole,
  counterpartName,
  counterpartNote,
  counterpartEmptyText,
  onOpenPhotoZoom,
}) => {
  const minutesPhotos = (signatures.workingMinutesPhotos || [])
    .map((photo) => (typeof photo === 'string' ? photo : firstNonEmptyString(toRecord(photo).url, toRecord(photo).photoUrl)))
    .filter(Boolean);

  return (
    <>
      <AuditSubsection icon={FileSignature} title="9.1. Xác Nhận Tại Hiện Trường">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AuditSignatureCard
            role="Kỹ sư khảo sát"
            name={signatures.surveyorName}
            note={signatures.surveyorPhone}
            signatureUrl={signatures.surveyorSignature}
            onOpenPhotoZoom={onOpenPhotoZoom}
          />
          <AuditSignatureCard
            role={counterpartRole}
            name={counterpartName}
            note={counterpartNote}
            signatureUrl={signatures.ownerSignature}
            emptyText={counterpartEmptyText}
            onOpenPhotoZoom={onOpenPhotoZoom}
          />
        </div>
      </AuditSubsection>

      {minutesPhotos.length > 0 && (
        <AuditSubsection icon={Paperclip} title="9.2. Ảnh Biên Bản Đã Ký" hint={`${minutesPhotos.length} ảnh`}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {minutesPhotos.map((url, idx) => (
              <CondoPhotoCard
                key={url}
                isEditMode={false}
                onOpenPhotoZoom={onOpenPhotoZoom}
                url={url}
                photoCode={`BB-${String(idx + 1).padStart(2, '0')}`}
                title={`Biên bản hiện trường ${idx + 1}`}
                category="WORKING_MINUTES"
                targetPhotoType="WORKING_MINUTES"
                badgeColor="sky"
              />
            ))}
          </div>
        </AuditSubsection>
      )}
    </>
  );
};
