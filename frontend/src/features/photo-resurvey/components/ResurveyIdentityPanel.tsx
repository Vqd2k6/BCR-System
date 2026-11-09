import React from 'react';
import { Compass, Lock, MapPin, ShieldAlert, TrendingDown, UserCheck } from 'lucide-react';
import type { ResurveyIdentity } from '../types';

/**
 * Thông tin Bước 1 (nhà dân) ở dạng CHỈ ĐỌC: cùng tiêu đề mục 1.1–1.4 và 1.6 như form khảo sát,
 * hiển thị bằng thẻ tĩnh (không dùng input disabled) để KSV nhận diện đúng nhà mà không sửa được hồ sơ gốc.
 */
const Field: React.FC<{ label: string; value: string | number | null | undefined; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="space-y-1 min-w-0">
    <div className="text-[11px] font-semibold text-slate-500">{label}</div>
    <div className={`px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 break-words ${mono ? 'font-mono font-bold' : ''}`}>
      {value === null || value === undefined || value === '' ? '---' : value}
    </div>
  </div>
);

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3">
    <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-800">
      {icon}
      {title}
      <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
        <Lock className="w-3 h-3" /> Chỉ đọc
      </span>
    </h3>
    {children}
  </section>
);

const OBJECT_GROUP_LABEL: Record<string, string> = {
  GENERAL: 'General (1đ) – Nhà ở thông thường',
  IMPORTANT: 'Important (2đ) – Công trình công cộng / đông người',
  CRITICAL: 'Critical (4đ) – Di sản / hạ tầng trọng yếu',
};

const levelText = (level: number | null): string | null => (level === null ? null : `Mức ${level}/4`);

export const ResurveyIdentityPanel: React.FC<{ identity: ResurveyIdentity }> = ({ identity }) => {
  const adj = identity.adjacent;
  const side = (s: { details: string | null; note: string | null }) => [s.details, s.note].filter(Boolean).join(' – ') || null;
  return (
    <div className="space-y-3">
      <Section title="1.1. Định danh công trình" icon={<UserCheck className="w-5 h-5 text-emerald-600" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Mã quản lý dự án" value={identity.projectParcelCode} mono />
          <Field label="Mã địa chính gốc" value={identity.officialCadastralCode} mono />
          <Field label="Tên công trình / biển hiệu" value={identity.buildingName} />
          <Field label="Địa chỉ hiện trường" value={identity.address} />
          <Field label="Chủ sở hữu / người sử dụng" value={identity.ownerName} />
          <Field label="Số điện thoại liên hệ" value={identity.ownerPhone} />
        </div>
      </Section>

      <Section title="1.2. Nhóm đối tượng công trình" icon={<ShieldAlert className="w-5 h-5 text-amber-600" />}>
        <Field label="Nhóm đối tượng" value={identity.objectGroup ? OBJECT_GROUP_LABEL[identity.objectGroup] || identity.objectGroup : null} />
      </Section>

      <Section title="1.3. Thông tin tuyến Metro & GIS" icon={<MapPin className="w-5 h-5 text-emerald-600" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Lý trình (Chainage)" value={identity.chainage} mono />
          <Field label="Cự ly tới tim hầm (m)" value={identity.metroOffsetDistance} />
          <Field label="Cự ly tới mép ga / tường vây (m)" value={identity.clearanceOffsetDistance} />
          <Field
            label="Toạ độ GPS (WGS84)"
            value={identity.gps ? `${identity.gps.lat.toFixed(6)}, ${identity.gps.lng.toFixed(6)}` : null}
            mono
          />
        </div>
      </Section>

      <Section title="1.4. Công trình liền kề 3 hướng" icon={<Compass className="w-5 h-5 text-emerald-600" />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Field label="Bên trái" value={side(adj.left)} />
          <Field label="Bên phải" value={side(adj.right)} />
          <Field label="Phía sau" value={side(adj.back)} />
        </div>
      </Section>

      <Section title="1.6. Lún chênh & nghiêng ngoài nhà" icon={<TrendingDown className="w-5 h-5 text-rose-600" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Lún chênh lệch" value={[levelText(identity.settlement.level), identity.settlement.position].filter(Boolean).join(' – ') || null} />
          <Field
            label="Nghiêng tổng thể (‰)"
            value={
              identity.tilt.level === null && identity.tilt.xPermille === null
                ? null
                : [levelText(identity.tilt.level), identity.tilt.xPermille !== null ? `X ${identity.tilt.xPermille}‰` : null, identity.tilt.yPermille !== null ? `Y ${identity.tilt.yPermille}‰` : null, identity.tilt.direction]
                    .filter(Boolean)
                    .join(' • ')
            }
          />
          <Field label="Ghi chú lún" value={identity.settlement.notes} />
          <Field label="Ghi chú nghiêng" value={identity.tilt.notes} />
          <Field label="Dấu hiệu bất thường ngoại quan" value={identity.abnormalNotes} />
          <Field label="Ngày khảo sát gốc" value={identity.surveyDate} />
        </div>
      </Section>
    </div>
  );
};
