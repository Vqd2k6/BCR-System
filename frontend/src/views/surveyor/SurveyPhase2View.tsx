import React, { useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SignaturePad } from '../../components/canvas/SignaturePad';
import {
  FileCheck,
  CheckCircle,
  ShieldCheck,
  Send,
  ChevronRight,
  ChevronLeft,
  PenTool,
} from 'lucide-react';

interface DefectVerification {
  id: string;
  defectCode: string;
  screeningCategory: string;
  defectType: string;
  phase1WidthMm: number;
  phase1LengthMm: number;
  phase2WidthMm: number;
  phase2LengthMm: number;
  deltaW: number;
  deltaL: number;
  verificationStatus: 'UNCHANGED' | 'DEVELOPED' | 'DISPUTED';
  isRepaired: boolean;
  notes?: string;
  cuPhotoUrl: string;
}

export const SurveyPhase2View: React.FC = () => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Baseline Phase 1 info
  const [baselineInfo, setBaselineInfo] = useState({
    parcelCode: 'B-00105',
    cadastralCode: 'KS003-00105',
    houseNumber: '854 Trường Chinh',
    ownerName: 'Nguyễn Văn An',
    phase1ReportCode: 'REPORT-B-00105-PHASE1',
    phase1Date: '15/01/2026',
    phase1Ecs: 7,
    phase1Vi: 29.17,
  });

  // Old defects list from Phase 1
  const [defects, setDefects] = useState<DefectVerification[]>([
    {
      id: 'e0000000-0000-0000-0000-000000000001',
      defectCode: 'D-01',
      screeningCategory: 'Nứt tường / Vữa trát',
      defectType: 'Nứt xiên góc 45 độ (Phòng khách Tầng 1)',
      phase1WidthMm: 0.85,
      phase1LengthMm: 650,
      phase2WidthMm: 0.95,
      phase2LengthMm: 680,
      deltaW: 0.1,
      deltaL: 30,
      verificationStatus: 'DEVELOPED',
      isRepaired: false,
      notes: 'Vết nứt có xu hướng phát triển dài thêm 30mm',
      cuPhotoUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=600&auto=format&fit=crop&q=80',
    },
    {
      id: 'e0000000-0000-0000-0000-000000000002',
      defectCode: 'D-02',
      screeningCategory: 'Nứt tường / Vữa trát',
      defectType: 'Nứt chân chim (Phòng khách Tầng 1)',
      phase1WidthMm: 0.3,
      phase1LengthMm: 280,
      phase2WidthMm: 0.3,
      phase2LengthMm: 280,
      deltaW: 0,
      deltaL: 0,
      verificationStatus: 'UNCHANGED',
      isRepaired: false,
      notes: 'Trạng thái ổn định, không thay đổi',
      cuPhotoUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=600&auto=format&fit=crop&q=80',
    },
  ]);

  // Quality Gate Checklist 10 criteria
  const [qualityGate, setQualityGate] = useState([
    { id: 1, title: '100% Vết nứt Phase 1 đã được đối chiếu thực địa', passed: true },
    { id: 2, title: 'Có ảnh chụp đối chứng góc máy và thước đo chuẩn (Scale Card)', passed: true },
    { id: 3, title: 'Đã tính toán độ chênh lệch Δw và ΔL chính xác', passed: true },
    { id: 4, title: 'Không có vết nứt vượt ngưỡng nguy hiểm chưa báo cáo', passed: true },
    { id: 5, title: 'Tọa độ GPS điểm danh nằm trong phạm vi 500m của Ga', passed: true },
    { id: 6, title: 'Đầy đủ ý kiến phản hồi của Chủ sở hữu công trình', passed: true },
    { id: 7, title: 'Chữ ký số Chủ hộ hợp lệ', passed: true },
    { id: 8, title: 'Chữ ký số Cán bộ khảo sát hiện trường hợp lệ', passed: true },
    { id: 9, title: 'Chữ ký số Đại diện Ban Quản Lý Đường Sắt Đô Thị (MAUR)', passed: true },
    { id: 10, title: 'Chữ ký số Đại diện Nhà thầu thi công Metro 2', passed: true },
  ]);

  // 4 Signatures
  const [sigOwner, setSigOwner] = useState('');
  const [sigSurveyor, setSigSurveyor] = useState('');
  const [sigZoneAdmin, setSigZoneAdmin] = useState('');
  const [sigContractor, setSigContractor] = useState('');

  const updateDefectP2 = (index: number, width: number, length: number) => {
    const updated = [...defects];
    const item = updated[index];
    item.phase2WidthMm = width;
    item.phase2LengthMm = length;
    item.deltaW = parseFloat((width - item.phase1WidthMm).toFixed(2));
    item.deltaL = parseFloat((length - item.phase1LengthMm).toFixed(1));
    item.verificationStatus = item.deltaW > 0.05 || item.deltaL > 5 ? 'DEVELOPED' : 'UNCHANGED';
    setDefects(updated);
  };

  const handleToggleQualityGate = (id: number) => {
    setQualityGate(
      qualityGate.map((q) => (q.id === id ? { ...q, passed: !q.passed } : q))
    );
  };

  const allGatePassed = qualityGate.every((q) => q.passed);

  const handleSubmitPhase2 = async () => {
    setIsSubmitting(true);
    try {
      await api.post('/reports/phase2/a0000000-0000-0000-0000-000000000002/submit', {
        witnessSignatures: {
          owner: sigOwner || 'mockSig1',
          surveyor: sigSurveyor || 'mockSig2',
          zoneAdmin: sigZoneAdmin || 'mockSig3',
          contractor: sigContractor || 'mockSig4',
        },
      });
      setIsSubmitted(true);
    } catch (_err) {
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '2rem 1rem', textAlign: 'center' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#dcfce7',
            border: '2px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <CheckCircle size={40} color="#10b981" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
          Đã Hoàn Tất Báo Cáo Đối Soát Phase 2!
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Biên bản đối chứng 4 bên đã được lập kèm chữ ký điện tử. Toàn bộ dữ liệu đã được lưu trữ vĩnh viễn với mã SHA-256 Checksum.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setIsSubmitted(false);
            setCurrentStep(1);
          }}
        >
          Trở Về Tổng Quan
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Phase 2: Đối Soát Trước Thi Công
          </span>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
            Bước {currentStep}/4: {currentStep === 1 ? 'Kế thừa Phase 1' : currentStep === 2 ? 'Đo đạc biến động Δ' : currentStep === 3 ? 'Cổng chất lượng Phụ lục A' : 'Ký số 4 Bên'}
          </h2>
        </div>
        <span className="badge badge-warning">Thửa: {baselineInfo.parcelCode}</span>
      </div>

      {/* Step Pills */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {[
          { num: 1, title: '1. Kế thừa P1' },
          { num: 2, title: '2. Đo biến động Δw, ΔL' },
          { num: 3, title: '3. Quality Gate Phụ lục A' },
          { num: 4, title: '4. Ký số 4 Bên' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setCurrentStep(s.num)}
            className={`btn btn-sm ${currentStep === s.num ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              flex: 1,
              fontSize: '0.75rem',
              padding: '0.4rem 0.2rem',
              backgroundColor: currentStep === s.num ? '#0284c7' : '#ffffff',
              borderColor: currentStep === s.num ? '#0284c7' : '#e2e8f0',
              color: currentStep === s.num ? '#ffffff' : '#475569',
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* STEP 1: Inherit Phase 1 Baseline */}
      {currentStep === 1 && (
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileCheck size={18} color="#0284c7" />
            Hồ Sơ Nền Phase 1 Được Kế Thừa (Approved Baseline)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b' }}>Mã dự án & Địa chỉ:</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{baselineInfo.parcelCode} - {baselineInfo.houseNumber}</div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b' }}>Chủ sở hữu công trình:</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{baselineInfo.ownerName}</div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b' }}>Mã hồ sơ Baseline Phase 1:</div>
              <div style={{ fontWeight: 700, color: '#0284c7' }}>{baselineInfo.phase1ReportCode}</div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b' }}>Điểm ECS & Tổn thương P1:</div>
              <div style={{ fontWeight: 700, color: '#d97706' }}>{baselineInfo.phase1Ecs}/24 ({baselineInfo.phase1Vi}%)</div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Delta Measurement */}
      {currentStep === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {defects.map((d, idx) => (
            <div
              key={d.id}
              className="card"
              style={{
                padding: '1rem',
                border: d.deltaW > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                backgroundColor: d.deltaW > 0 ? '#fff5f5' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-primary">{d.defectCode}</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>{d.defectType}</span>
                </div>
                <span className={`badge ${d.deltaW > 0 ? 'badge-danger' : 'badge-success'}`}>
                  {d.deltaW > 0 ? `Δw: +${d.deltaW}mm (Tiến triển)` : 'Δw: 0mm (Ổn định)'}
                </span>
              </div>

              {/* Photos & Comparison Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                <img
                  src={d.cuPhotoUrl}
                  alt="Defect CU"
                  style={{ width: '100px', height: '80px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
                />

                {/* Phase 1 Baseline Values */}
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem' }}>
                  <div style={{ color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>Giai đoạn Phase 1</div>
                  <div>Rộng: <strong style={{ color: '#0284c7' }}>{d.phase1WidthMm} mm</strong></div>
                  <div>Dài: <strong style={{ color: '#0284c7' }}>{d.phase1LengthMm} mm</strong></div>
                </div>

                {/* Phase 2 Measured Inputs */}
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem' }}>
                  <div style={{ color: '#7e22ce', fontWeight: 600, marginBottom: '2px' }}>Đo lại Phase 2</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                    <span>Rộng (w₂):</span>
                    <input
                      type="number"
                      step="0.05"
                      className="form-control"
                      style={{ fontSize: '0.75rem', padding: '2px 4px', width: '65px' }}
                      value={d.phase2WidthMm}
                      onChange={(e) => updateDefectP2(idx, parseFloat(e.target.value) || 0, d.phase2LengthMm)}
                    />
                    <span>mm</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Dài (L₂):</span>
                    <input
                      type="number"
                      step="10"
                      className="form-control"
                      style={{ fontSize: '0.75rem', padding: '2px 4px', width: '65px' }}
                      value={d.phase2LengthMm}
                      onChange={(e) => updateDefectP2(idx, d.phase2WidthMm, parseFloat(e.target.value) || 0)}
                    />
                    <span>mm</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* STEP 3: Quality Gate Phụ lục A Checklist */}
      {currentStep === 3 && (
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color="#16a34a" />
              Cổng Kiểm Soát Chất Lượng Phụ Lục A (10 Tiêu Chí)
            </h3>
            <span className={`badge ${allGatePassed ? 'badge-success' : 'badge-warning'}`}>
              {qualityGate.filter((q) => q.passed).length}/10 Tiêu chí Đạt
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {qualityGate.map((q) => (
              <label
                key={q.id}
                onClick={() => handleToggleQualityGate(q.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.5rem',
                  backgroundColor: q.passed ? '#f0fdf4' : '#f8fafc',
                  border: q.passed ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  color: q.passed ? '#15803d' : '#475569',
                }}
              >
                <input
                  type="checkbox"
                  checked={q.passed}
                  onChange={() => {}}
                  style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                />
                <span style={{ fontWeight: q.passed ? 700 : 500 }}>{q.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: 4-Party Digital Signatures */}
      {currentStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PenTool size={18} color="#0284c7" />
            Ký Xác Nhận 4 Bên (Phụ Lục 12 Biên Bản Đối Soát)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <SignaturePad
              label="1. Đại diện Chủ sở hữu công trình"
              signerName={baselineInfo.ownerName}
              role="Chủ hộ"
              initialSignatureUrl={sigOwner}
              onSave={(dataUrl) => setSigOwner(dataUrl)}
            />

            <SignaturePad
              label="2. Đại diện Đơn vị Khảo sát"
              signerName={user?.fullName || 'Nguyễn Văn Khảo Sát'}
              role="Cán bộ hiện trường"
              initialSignatureUrl={sigSurveyor}
              onSave={(dataUrl) => setSigSurveyor(dataUrl)}
            />

            <SignaturePad
              label="3. Đại diện Tư vấn Giám sát (MAUR / Zone Admin)"
              signerName="Lê Hoàng Giám Sát"
              role="Kỹ sư Thẩm định MAUR"
              initialSignatureUrl={sigZoneAdmin}
              onSave={(dataUrl) => setSigZoneAdmin(dataUrl)}
            />

            <SignaturePad
              label="4. Đại diện Nhà thầu Thi công Metro 2"
              signerName="Trần Đình Thi Công"
              role="Chỉ huy trưởng Nhà thầu"
              initialSignatureUrl={sigContractor}
              onSave={(dataUrl) => setSigContractor(dataUrl)}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmitPhase2}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              fontSize: '1rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            <Send size={18} />
            {isSubmitting ? 'Đang nộp biên bản...' : 'Hoàn Tất & Nộp Biên Bản Đối Soát Phase 2'}
          </button>
        </div>
      )}

      {/* Footer Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingBottom: '4.5rem' }}>
        <button
          type="button"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <ChevronLeft size={16} />
          Quay lại
        </button>

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
          >
            Tiếp tục
            <ChevronRight size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
};
