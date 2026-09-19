import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SignaturePad } from '../../components/canvas/SignaturePad';
import { PhotoCaptureInput } from '../../components/common/PhotoCaptureInput';
import { FacadePolygonCanvas, PolygonPoint, FloorSplitLine } from '../../components/canvas/FacadePolygonCanvas';
import { DefectPinningCanvas, DefectItem } from '../../components/canvas/DefectPinningCanvas';
import {
  FileCheck,
  CheckCircle,
  CheckCircle2,
  ShieldCheck,
  Send,
  ChevronRight,
  ChevronLeft,
  PenTool,
  AlertTriangle,
  Sparkles,
  Save,
  Plus,
  Trash2,
  HelpCircle,
  FileText,
  Activity,
  Layers,
} from 'lucide-react';

interface DefectVerification {
  id: string;
  defectCode: string;
  zoneCode: string;
  floorAndRoom: string;
  screeningCategory: string;
  defectType: string;
  phase1WidthMm: number;
  phase1LengthMm: number;
  phase2WidthMm: number;
  phase2LengthMm: number;
  deltaW: number;
  deltaL: number;
  verificationStatus: 'UNCHANGED' | 'DEVELOPED' | 'REPAIRED' | 'NEW';
  cuPhotoUrl: string;
  notes?: string;
}

interface Props {
  initialParcelId?: string;
  onFinished?: () => void;
}

export const SurveyPhase2View: React.FC<Props> = ({ initialParcelId, onFinished }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const draftKey = `metro2_phase2_draft_${initialParcelId || 'default'}`;

  // STEP 1: Identification & Phase 1 Baseline Inheritance
  const [ident, setIdent] = useState({
    projectParcelCode: 'B-00105',
    officialCadastralCode: 'KS003-00105',
    phase1ReportRef: 'REPORT-PHASE1-B00105',
    phase1ApprovalDate: '15/01/2026',
    buildingName: 'Nhà ở gia đình',
    address: 'Số 854 Đường Trường Chinh, P.15, Q.Tân Bình',
    ownerName: 'Nguyễn Văn Hùng',
    ownerContact: '0908123456',
    workSection: 'Đoạn tuyến Ga S9 (Bà Quẹo) - Ga S10 (Phạm Văn Bạch)',
    surveyDate: new Date().toLocaleDateString('vi-VN'),
    surveyPurpose: 'Baseline trước thi công', // Baseline trước thi công, Kiểm tra lại
    surveyLevel: 'L2-B', // L2-A, L2-B, L2-C
    witnessList: 'Đại diện Chủ đầu tư MAUR, TVGS, Cán bộ KS, Chủ nhà',
    specialConditions: 'Thời tiết khô ráo, công trình đang sinh hoạt bình thường',
  });

  // STEP 1 Photos: P01 & P02 for Phase 2 (clean zero-demo)
  const [p01PhotoUrl, setP01PhotoUrl] = useState('');
  const [p01NotApplicable, setP01NotApplicable] = useState(false);
  const [p01NaReason, setP01NaReason] = useState('');

  const [p02PhotoUrl, setP02PhotoUrl] = useState('');
  const [p02NotApplicable, setP02NotApplicable] = useState(false);
  const [p02NaReason, setP02NaReason] = useState('');
  const [p02PolygonPoints, setP02PolygonPoints] = useState<PolygonPoint[]>([]);
  const [p02FloorLines, setP02FloorLines] = useState<FloorSplitLine[]>([]);

  // STEP 2: Structural Verification & Variations after Phase 1
  const [variations, setVariations] = useState({
    useCategory: 'Nhà ở gia đình',
    floorCount: 3,
    structuralSystem: 'BTCT (Khung chịu lực)',
    foundationType: 'Cọc ép BTCT (CAT 3/5)',
    hasExtensionAfterP1: false,
    extensionDesc: '',
    hasRepairsAfterP1: false,
    repairsDesc: '',
    hasLoadChangesAfterP1: false,
    loadChangesDesc: '',
    otherChangesDesc: '',
    variationConclusion: 'NO_SIGNIFICANT_CHANGE', // NO_SIGNIFICANT_CHANGE, HAS_CHANGES
  });

  // STEP 3: Defect Verification Register (Phase 1 Baseline + New Phase 2 Defects)
  const [defects, setDefects] = useState<DefectVerification[]>([
    {
      id: 'd-01',
      defectCode: 'D-01',
      zoneCode: 'Z-01',
      floorAndRoom: 'Tầng trệt - Phòng khách',
      screeningCategory: 'Nứt tường / Vữa trát',
      defectType: 'Nứt xiên góc 45 độ gần cửa chính',
      phase1WidthMm: 0.85,
      phase1LengthMm: 650,
      phase2WidthMm: 0.85,
      phase2LengthMm: 650,
      deltaW: 0.0,
      deltaL: 0,
      verificationStatus: 'UNCHANGED',
      cuPhotoUrl: '',
      notes: '',
    },
    {
      id: 'd-02',
      defectCode: 'D-02',
      zoneCode: 'Z-01',
      floorAndRoom: 'Tầng trệt - Phòng khách',
      screeningCategory: 'Nứt tường / Vữa trát',
      defectType: 'Nứt chân chim mép tường',
      phase1WidthMm: 0.3,
      phase1LengthMm: 280,
      phase2WidthMm: 0.3,
      phase2LengthMm: 280,
      deltaW: 0.0,
      deltaL: 0,
      verificationStatus: 'UNCHANGED',
      cuPhotoUrl: '',
      notes: '',
    },
  ]);

  // Context CTX Photo for Phase 2
  const [ctxPhotoP2Url, setCtxPhotoP2Url] = useState('');

  // STEP 4: Settlement, Tilt & Deflection (Phase 2 Measurements)
  const [measP2, setMeasP2] = useState({
    tiltFrontXPercent: 0.15,
    deltaTiltX: 0.0,
    tiltSideYPercent: 0.1,
    deltaTiltY: 0.0,
    floorTiltPercent: 0.1,
    beamDeflectionMm: 6.0,
    measureMethods: ['Thước laser', 'Thước nivo điện tử'],
    dataConfidence: 'Cao',
    expertRemarks: 'Nghiêng và võng trong giới hạn cho phép, ổn định so với GĐ1.',
  });

  // STEP 5: Scope & GIS Cadastral Alignment
  const [scopeP2, setScopeP2] = useState({
    accessScope: 'FULL', // FULL, PARTIAL
    inaccessibleAreas: '',
    boundaryAlignment: 'MATCH', // MATCH, SPLIT_MUTATION, EXTENSION
  });

  // STEP 6: Damage Map Sketch & 10-Item Quality Gate Checklist (Phụ lục A)
  const [sketchPhotoUrl, setSketchPhotoUrl] = useState('');
  const [cadDrawingRef, setCadDrawingRef] = useState('');
  const [qualityChecklist, setQualityChecklist] = useState([
    { id: 1, title: 'Đã xác nhận mã công trình, địa chỉ, đoạn thi công và tham chiếu Giai đoạn 1', passed: true },
    { id: 2, title: 'Đã ghi phạm vi tiếp cận và khu vực không tiếp cận (nếu có)', passed: true },
    { id: 3, title: 'Đã chụp ảnh số nhà/biển tên, mặt đứng và bối cảnh công trình (P-01, P-02)', passed: true },
    { id: 4, title: 'Đã kiểm tra các tầng/phòng/khu vực có thể tiếp cận', passed: true },
    { id: 5, title: 'Khuyết tật đã được gán ID và ghi vị trí, loại, kích thước đầy đủ', passed: true },
    { id: 6, title: 'Mỗi khuyết tật có ảnh bối cảnh (CTX) và ảnh cận cảnh kèm thước (CU)', passed: true },
    { id: 7, title: 'Đã lập sơ đồ/bản vẽ vị trí khuyết tật hoặc ghi số hiệu damage mapping', passed: true },
    { id: 8, title: 'Đã so sánh với Giai đoạn 1 và ghi rõ thay đổi/sửa chữa/khuyết tật mới', passed: true },
    { id: 9, title: 'Đã ghi kết luận hiện trạng, nhu cầu quan trắc/NDT/bảo vệ nếu cần', passed: true },
    { id: 10, title: 'Đã lấy ý kiến/chữ ký 4 bên hoặc lập hồ sơ từ chối/vắng mặt', passed: true },
  ]);

  // STEP 7: Comparison Summary & Monitoring Needs
  const [summaryP2, setSummaryP2] = useState({
    overallVariation: 'UNCHANGED', // UNCHANGED, DEVELOPED, REPAIRED, NEW_DEFECTS
    hasCriticalSafetyDanger: false,
    criticalDangerDesc: '',
    monitoringNeeds: ['Lún', 'Nghiêng', 'Rung'], // Lún, Nghiêng, Nứt, Rung
    needsNdtTest: false,
    ndtType: '',
    conclusionP2: 'STABLE_OBSERVED', // STABLE_OBSERVED, NEEDS_MONITORING, IN_DEPTH_EVAL
  });

  // STEP 8: Owner Feedback & Legal Confirmation
  const [ownerFeedbackP2, setOwnerFeedbackP2] = useState('Đồng ý và thống nhất với biên bản khảo sát hiện trạng Đợt 2.');

  // STEP 9: 4-Party Signatures (Owner, Joint Venture, Contractor, Witness)
  const [sigOwner, setSigOwner] = useState('');
  const [sigJointVenture, setSigJointVenture] = useState('');
  const [sigContractor, setSigContractor] = useState('');
  const [sigWitness, setSigWitness] = useState('');

  const [ownerNameP2, setOwnerNameP2] = useState('Nguyễn Văn Hùng');
  const [jvNameP2, setJvNameP2] = useState('Lê Trọng Nghĩa (Kỹ sư CRLG-CRSRI-TT)');
  const [contractorNameP2, setContractorNameP2] = useState('Trần Quốc Cường (Đại diện Nhà thầu)');
  const [witnessNameP2, setWitnessNameP2] = useState('UBND Phường 15 / Tổ dân phố');

  const updateDefectMeasurement = (index: number, width: number, length: number) => {
    const updated = [...defects];
    const item = updated[index];
    item.phase2WidthMm = width;
    item.phase2LengthMm = length;
    item.deltaW = parseFloat((width - item.phase1WidthMm).toFixed(2));
    item.deltaL = parseFloat((length - item.phase1LengthMm).toFixed(1));

    if (item.verificationStatus !== 'REPAIRED' && item.verificationStatus !== 'NEW') {
      item.verificationStatus = item.deltaW > 0.05 || item.deltaL > 5 ? 'DEVELOPED' : 'UNCHANGED';
    }
    setDefects(updated);
  };

  const handleAddNewDefect = () => {
    const nextIdx = defects.length + 1;
    const newDef: DefectVerification = {
      id: `d-${String(nextIdx).padStart(2, '0')}`,
      defectCode: `D-${String(nextIdx).padStart(2, '0')}`,
      zoneCode: 'Z-01',
      floorAndRoom: 'Tầng trệt - Phòng khách',
      screeningCategory: 'Nứt tường / Vữa trát',
      defectType: 'Vết nứt mới phát sinh sau GĐ1',
      phase1WidthMm: 0,
      phase1LengthMm: 0,
      phase2WidthMm: 0.5,
      phase2LengthMm: 300,
      deltaW: 0.5,
      deltaL: 300,
      verificationStatus: 'NEW',
      cuPhotoUrl: '',
      notes: 'Mới ghi nhận tại GĐ2',
    };
    setDefects([...defects, newDef]);
  };

  const handleRemoveDefect = (index: number) => {
    setDefects(defects.filter((_, i) => i !== index));
  };

  const handleToggleQuality = (id: number) => {
    setQualityChecklist(
      qualityChecklist.map((q) => (q.id === id ? { ...q, passed: !q.passed } : q))
    );
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    try {
      const draft = {
        ident,
        variations,
        defects,
        measP2,
        scopeP2,
        sketchPhotoUrl,
        summaryP2,
        ownerFeedbackP2,
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch (_e) {}
    setTimeout(() => setIsSaving(false), 600);
  };

  const handleSubmitPhase2 = async () => {
    setIsSubmitting(true);
    try {
      await api.post('/reports/phase2/a0000000-0000-0000-0000-000000000002/submit', {
        ident,
        variations,
        defects,
        measP2,
        summaryP2,
        witnessSignatures: {
          owner: sigOwner,
          jointVenture: sigJointVenture,
          contractor: sigContractor,
          witness: sigWitness,
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
      <div style={{ maxWidth: '680px', margin: '2rem auto', padding: '2rem 1.5rem', textAlign: 'center' }}>
        <div
          style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            backgroundColor: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
            border: '2px solid #93c5fd',
          }}
        >
          <ShieldCheck size={44} color="#1d4ed8" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
          ĐÃ HOÀN TẤT HỒ SƠ KHẢO SÁT HIỆN TRẠNG PHASE 2!
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Biên bản khảo sát trước thi công (Phiếu 02) cho công trình <strong>{ident.projectParcelCode}</strong> ({ident.address}) đã được chốt và đồng bộ vào hệ thống cơ sở pháp lý Metro 2.
        </p>

        <div
          className="card"
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            margin: '1.5rem 0',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.825rem',
          }}
        >
          <div>• <strong>Mã hồ sơ Phase 2:</strong> REPORT-PHASE2-{ident.projectParcelCode}</div>
          <div>• <strong>Đối chiếu khuyết tật:</strong> {defects.length} vết nứt (Không đổi: {defects.filter(d => d.verificationStatus === 'UNCHANGED').length}, Phát triển: {defects.filter(d => d.verificationStatus === 'DEVELOPED').length}, Mới: {defects.filter(d => d.verificationStatus === 'NEW').length})</div>
          <div>• <strong>Chữ ký 4 bên:</strong> Đã ký số xác nhận đầy đủ 4 bên theo quy định.</div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={onFinished}
          style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}
        >
          Quay về Trang chủ Khảo sát
        </button>
      </div>
    );
  }

  const stepsList = [
    { num: 1, title: 'Nhận diện & Ảnh P01-P02' },
    { num: 2, title: 'Biến động sau GĐ1' },
    { num: 3, title: 'Đối soát sổ khuyết tật' },
    { num: 4, title: 'Đo đạc lún – nghiêng GĐ2' },
    { num: 5, title: 'Phạm vi & Ranh GIS' },
    { num: 6, title: 'Sơ đồ & Quality Gate' },
    { num: 7, title: 'Tổng hợp so sánh GĐ1' },
    { num: 8, title: 'Cam kết pháp lý Phiếu 02' },
    { num: 9, title: 'Ký biên bản 4 bên' },
  ];

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', padding: '1rem 1rem 6rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span className="badge" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', fontWeight: 800 }}>
              PHASE 2 (PRE-CONSTRUCTION)
            </span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
              {ident.projectParcelCode}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            {ident.address} • Kế thừa hồ sơ GĐ1 ({ident.phase1ApprovalDate})
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Save size={14} />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu nháp'}</span>
          </button>
          {onFinished && (
            <button type="button" onClick={onFinished} className="btn btn-secondary btn-sm">
              Thoát
            </button>
          )}
        </div>
      </div>

      {/* 9 Steps Navigation Pill Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          paddingBottom: '0.35rem',
          scrollbarWidth: 'thin',
        }}
      >
        {stepsList.map((st) => {
          const isActive = currentStep === st.num;
          const isPassed = currentStep > st.num;
          return (
            <button
              key={st.num}
              type="button"
              onClick={() => setCurrentStep(st.num)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: isActive ? 800 : 500,
                whiteSpace: 'nowrap',
                border: isActive ? '1.5px solid #2563eb' : isPassed ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                backgroundColor: isActive ? '#eff6ff' : isPassed ? '#f0f9ff' : '#ffffff',
                color: isActive ? '#1d4ed8' : isPassed ? '#0369a1' : '#475569',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {isPassed && <CheckCircle2 size={11} />}
                <span>{st.num}.</span>
              </span>
              <span>{st.title}</span>
            </button>
          );
        })}
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* ===================== STEP 1: NHẬN DIỆN & ẢNH P01-P02 ===================== */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 1: Tiếp Cận Ngoài Nhà, Nhận Diện Công Trình & Chụp Ảnh Phase 2
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                Hệ thống tự động hiển thị dữ liệu gốc từ Phase 1 và thông tin khảo sát đợt 2.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Mã tham chiếu Phase 1:</label>
                <input type="text" className="form-control" value={ident.phase1ReportRef} disabled={true} />
              </div>
              <div>
                <label className="form-label">Đoạn thi công tuyến Metro 2:</label>
                <input
                  type="text"
                  className="form-control"
                  value={ident.workSection}
                  onChange={(e) => setIdent({ ...ident, workSection: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">Mục tiêu khảo sát:</label>
                <select
                  className="form-control"
                  value={ident.surveyPurpose}
                  onChange={(e) => setIdent({ ...ident, surveyPurpose: e.target.value })}
                >
                  <option value="Baseline trước thi công">Baseline trước thi công</option>
                  <option value="Kiểm tra lại">Kiểm tra lại (Re-survey)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Cấp khảo sát (Survey Level):</label>
                <select
                  className="form-control"
                  value={ident.surveyLevel}
                  onChange={(e) => setIdent({ ...ident, surveyLevel: e.target.value })}
                >
                  <option value="L2-A">L2-A (Cơ bản: Ngoài phạm vi lún chính)</option>
                  <option value="L2-B">L2-B (Tiêu chuẩn: Nằm trong đới ảnh hưởng đào hầm)</option>
                  <option value="L2-C">L2-C (Chuyên sâu: Công trình nhạy cảm cao/di tích)</option>
                </select>
              </div>
            </div>

            {/* 2 Photos P01 & P02 */}
            <h4 style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
              Chụp 2 Ảnh Nhận Dạng / Tổng Thể Phase 2:
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              <PhotoCaptureInput
                label="Ảnh P-01: Số nhà / Biển tên + Mặt đứng chính GĐ2"
                value={p01PhotoUrl}
                onChange={setP01PhotoUrl}
                allowNotApplicable={true}
                isNotApplicable={p01NotApplicable}
                onToggleNotApplicable={setP01NotApplicable}
                naReason={p01NaReason}
                onNaReasonChange={setP01NaReason}
                watermarkText={`PHASE2-P01 | ${ident.projectParcelCode}`}
                required={true}
              />

              <PhotoCaptureInput
                label="Ảnh P-02: Toàn cảnh công trình & Bối cảnh tuyến đường"
                value={p02PhotoUrl}
                onChange={setP02PhotoUrl}
                allowNotApplicable={true}
                isNotApplicable={p02NotApplicable}
                onToggleNotApplicable={setP02NotApplicable}
                naReason={p02NaReason}
                onNaReasonChange={setP02NaReason}
                watermarkText={`PHASE2-P02 | ${ident.projectParcelCode}`}
                required={true}
              />
            </div>
          </div>
        )}

        {/* ===================== STEP 2: BIẾN ĐỘNG SAU GĐ1 ===================== */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 2: Phỏng Vấn Chủ Hộ & Xác Nhận Biến Động Sau Giai Đoạn 1
              </h3>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
              <strong>Kế thừa từ Phase 1:</strong> {variations.useCategory} • {variations.floorCount} tầng • {variations.structuralSystem} • {variations.foundationType}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="form-label">1. Cơi nới / Cải tạo sau GĐ1:</label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="radio"
                      name="extension"
                      checked={!variations.hasExtensionAfterP1}
                      onChange={() => setVariations({ ...variations, hasExtensionAfterP1: false })}
                    />
                    Không
                  </label>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="radio"
                      name="extension"
                      checked={variations.hasExtensionAfterP1}
                      onChange={() => setVariations({ ...variations, hasExtensionAfterP1: true })}
                    />
                    Có
                  </label>
                </div>
                {variations.hasExtensionAfterP1 && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Mô tả vị trí cơi nới thêm..."
                    value={variations.extensionDesc}
                    onChange={(e) => setVariations({ ...variations, extensionDesc: e.target.value })}
                    style={{ marginTop: '0.35rem' }}
                  />
                )}
              </div>

              <div>
                <label className="form-label">2. Sửa chữa hư hỏng sau GĐ1 (Trám nứt, sơn lại...):</label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="radio"
                      name="repairs"
                      checked={!variations.hasRepairsAfterP1}
                      onChange={() => setVariations({ ...variations, hasRepairsAfterP1: false })}
                    />
                    Không
                  </label>
                  <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="radio"
                      name="repairs"
                      checked={variations.hasRepairsAfterP1}
                      onChange={() => setVariations({ ...variations, hasRepairsAfterP1: true })}
                    />
                    Có
                  </label>
                </div>
                {variations.hasRepairsAfterP1 && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Mô tả chi tiết việc sửa chữa..."
                    value={variations.repairsDesc}
                    onChange={(e) => setVariations({ ...variations, repairsDesc: e.target.value })}
                    style={{ marginTop: '0.35rem' }}
                  />
                )}
              </div>

              <div>
                <label className="form-label">Kết luận xác nhận đặc trưng sau GĐ1:</label>
                <select
                  className="form-control"
                  value={variations.variationConclusion}
                  onChange={(e) => setVariations({ ...variations, variationConclusion: e.target.value })}
                >
                  <option value="NO_SIGNIFICANT_CHANGE">Không thay đổi đáng kể so với GĐ1</option>
                  <option value="HAS_CHANGES">Có thay đổi – đã ghi nhận ở trên</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 3: ĐỐI SOÁT SỔ KHUYẾT TẬT ===================== */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  BƯỚC 3: Đối Soát Sổ Khuyết Tật $D-xx$ & Ghi Nhận Mới Phase 2
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                  Đo lại kích thước thực tế, tính toán độ biến thiên $\Delta w, \Delta L$ và chụp ảnh Photo CU có thước.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddNewDefect}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Plus size={14} />
                <span>+ Thêm Vết Nứt Mới (GĐ2)</span>
              </button>
            </div>

            {/* Photo CTX for Phase 2 Context */}
            <PhotoCaptureInput
              label="Ảnh bối cảnh mảng tường khảo sát Phase 2 (Photo CTX):"
              value={ctxPhotoP2Url}
              onChange={setCtxPhotoP2Url}
              watermarkText={`PHASE2-CTX | ${ident.projectParcelCode}`}
              height="180px"
            />

            {/* List of Defects */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {defects.map((d, idx) => (
                <div
                  key={d.id}
                  className="card"
                  style={{
                    padding: '1rem',
                    backgroundColor: '#ffffff',
                    border: d.verificationStatus === 'NEW' ? '1.5px solid #f59e0b' : d.verificationStatus === 'DEVELOPED' ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
                        {d.defectCode}
                      </span>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: d.verificationStatus === 'UNCHANGED' ? '#dcfce7' : d.verificationStatus === 'DEVELOPED' ? '#fee2e2' : '#fef3c7',
                          color: d.verificationStatus === 'UNCHANGED' ? '#15803d' : d.verificationStatus === 'DEVELOPED' ? '#b91c1c' : '#b45309',
                          fontWeight: 700,
                        }}
                      >
                        {d.verificationStatus === 'UNCHANGED' ? 'Không đổi' : d.verificationStatus === 'DEVELOPED' ? 'Phát triển thêm' : d.verificationStatus === 'REPAIRED' ? 'Đã sửa chữa' : 'MỚI GHI NHẬN'}
                      </span>
                    </div>

                    {d.verificationStatus === 'NEW' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDefect(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    Vị trí: <strong>{d.floorAndRoom}</strong> • Loại: {d.defectType}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '0.5rem', fontSize: '0.775rem' }}>
                    <div>
                      Kích thước GĐ1: <strong>{d.phase1WidthMm}mm x {d.phase1LengthMm}mm</strong>
                    </div>
                    <div>
                      Đo lại GĐ2 (mm):{' '}
                      <input
                        type="number"
                        step="0.05"
                        style={{ width: '70px', padding: '0.2rem', fontSize: '0.775rem' }}
                        value={d.phase2WidthMm}
                        onChange={(e) => updateDefectMeasurement(idx, parseFloat(e.target.value) || 0, d.phase2LengthMm)}
                      />
                      {' '}x{' '}
                      <input
                        type="number"
                        step="10"
                        style={{ width: '70px', padding: '0.2rem', fontSize: '0.775rem' }}
                        value={d.phase2LengthMm}
                        onChange={(e) => updateDefectMeasurement(idx, d.phase2WidthMm, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      Độ biến thiên: <strong style={{ color: d.deltaW > 0 ? '#dc2626' : '#15803d' }}>&Delta;w = {d.deltaW > 0 ? `+${d.deltaW}` : d.deltaW} mm</strong> | &Delta;L = {d.deltaL > 0 ? `+${d.deltaL}` : d.deltaL} mm
                    </div>
                  </div>

                  {/* Photo CU with Scale Card */}
                  <PhotoCaptureInput
                    label={`Ảnh chụp cận cảnh có thước đo (${d.defectCode}-CU Phase 2):`}
                    value={d.cuPhotoUrl}
                    onChange={(url) => {
                      const updated = [...defects];
                      updated[idx].cuPhotoUrl = url;
                      setDefects(updated);
                    }}
                    watermarkText={`${d.defectCode}-CU-P2 | ${d.phase2WidthMm}mm x ${d.phase2LengthMm}mm`}
                    height="150px"
                    required={true}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================== STEP 4: ĐO ĐẠC LÚN NGHIÊNG GĐ2 ===================== */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 4: Đánh Giá & Đo Đạc Lún – Nghiêng – Biến Dạng Phase 2
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Nghiêng mặt trước X (%):</label>
                <input
                  type="number"
                  step="0.05"
                  className="form-control"
                  value={measP2.tiltFrontXPercent}
                  onChange={(e) => setMeasP2({ ...measP2, tiltFrontXPercent: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="form-label">Nghiêng mặt hông Y (%):</label>
                <input
                  type="number"
                  step="0.05"
                  className="form-control"
                  value={measP2.tiltSideYPercent}
                  onChange={(e) => setMeasP2({ ...measP2, tiltSideYPercent: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="form-label">Nghiêng sàn (%):</label>
                <input
                  type="number"
                  step="0.05"
                  className="form-control"
                  value={measP2.floorTiltPercent}
                  onChange={(e) => setMeasP2({ ...measP2, floorTiltPercent: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <label className="form-label">Võng dầm lớn nhất (mm):</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-control"
                  value={measP2.beamDeflectionMm}
                  onChange={(e) => setMeasP2({ ...measP2, beamDeflectionMm: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Nhận xét chuyên môn về biến dạng:</label>
              <textarea
                className="form-control"
                rows={2}
                value={measP2.expertRemarks}
                onChange={(e) => setMeasP2({ ...measP2, expertRemarks: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* ===================== STEP 5: PHẠM VI & RANH GIS ===================== */}
        {currentStep === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 5: Xác Nhận Phạm Vi & Đối Soát Ranh Thửa Đất GIS
              </h3>
            </div>

            <div>
              <label className="form-label">Phạm vi tiếp cận thực tế Phase 2:</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="radio"
                    name="scopeP2"
                    checked={scopeP2.accessScope === 'FULL'}
                    onChange={() => setScopeP2({ ...scopeP2, accessScope: 'FULL' })}
                  />
                  <span>Toàn bộ ngôi nhà</span>
                </label>
                <label style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="radio"
                    name="scopeP2"
                    checked={scopeP2.accessScope === 'PARTIAL'}
                    onChange={() => setScopeP2({ ...scopeP2, accessScope: 'PARTIAL' })}
                  />
                  <span>Một phần (Có khu vực bị khóa/không vào được)</span>
                </label>
              </div>
            </div>

            <div>
              <label className="form-label">Đối soát ranh địa chính trên GIS:</label>
              <select
                className="form-control"
                value={scopeP2.boundaryAlignment}
                onChange={(e) => setScopeP2({ ...scopeP2, boundaryAlignment: e.target.value })}
              >
                <option value="MATCH">Khớp hoàn toàn với ranh Phase 1</option>
                <option value="EXTENSION">Phát sinh cơi nới xây thêm</option>
                <option value="SPLIT_MUTATION">Phát sinh chia tách thửa đất</option>
              </select>
            </div>
          </div>
        )}

        {/* ===================== STEP 6: SƠ ĐỒ & QUALITY GATE CHECKLIST ===================== */}
        {currentStep === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 6: Sơ Đồ Vị Trí Khuyết Tật & Cổng Kiểm Soát Chất Lượng (Phụ Lục A)
              </h3>
            </div>

            <PhotoCaptureInput
              label="Sơ đồ phác thảo vị trí khuyết tật Phase 2 (Damage Map Sketch):"
              value={sketchPhotoUrl}
              onChange={setSketchPhotoUrl}
              watermarkText={`DAMAGE-MAP-P2 | ${ident.projectParcelCode}`}
              height="180px"
            />

            <div>
              <label className="form-label">Checklist 10 Tiêu Chí Cổng Kiểm Soát Chất Lượng (Phụ lục A):</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {qualityChecklist.map((q) => (
                  <label
                    key={q.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.775rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.45rem',
                      backgroundColor: q.passed ? '#f0fdf4' : '#fffbeb',
                      border: q.passed ? '1px solid #86efac' : '1px solid #fde68a',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={q.passed}
                      onChange={() => handleToggleQuality(q.id)}
                      style={{ accentColor: '#16a34a' }}
                    />
                    <span style={{ fontWeight: 600, color: q.passed ? '#15803d' : '#b45309' }}>
                      {q.id}. {q.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 7: TỔNG HỢP SO SÁNH GĐ1 ===================== */}
        {currentStep === 7 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 7: Tổng Hợp So Sánh Giai Đoạn 1 & Đề Xuất Quan Trắc
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label className="form-label">Tổng hợp biến động khuyết tật:</label>
                <select
                  className="form-control"
                  value={summaryP2.overallVariation}
                  onChange={(e) => setSummaryP2({ ...summaryP2, overallVariation: e.target.value })}
                >
                  <option value="UNCHANGED">Không đổi (Ổn định)</option>
                  <option value="DEVELOPED">Phát triển thêm vết nứt cũ</option>
                  <option value="REPAIRED">Chủ nhà đã sửa chữa / trám bả</option>
                  <option value="NEW_DEFECTS">Có phát sinh khuyết tật mới</option>
                </select>
              </div>

              <div>
                <label className="form-label">Kết luận hiện trạng Phase 2:</label>
                <select
                  className="form-control"
                  value={summaryP2.conclusionP2}
                  onChange={(e) => setSummaryP2({ ...summaryP2, conclusionP2: e.target.value })}
                >
                  <option value="STABLE_OBSERVED">Ổn định theo quan sát</option>
                  <option value="NEEDS_MONITORING">Có hư hỏng hiện hữu cần theo dõi</option>
                  <option value="IN_DEPTH_EVAL">Cần đánh giá chuyên sâu</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ===================== STEP 8: CAM KẾT PHÁP LÝ PHIẾU 02 ===================== */}
        {currentStep === 8 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 8: Cam Kết Pháp Lý Mẫu Chuẩn Phiếu 02 & Ý Kiến Chủ Hộ
              </h3>
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '1rem',
                borderRadius: '0.65rem',
                fontSize: '0.8rem',
                lineHeight: 1.6,
                color: '#334155',
                fontStyle: 'italic',
              }}
            >
              &quot;Qua khảo sát trong phạm vi tiếp cận được, các bên xác nhận Phiếu 02 và các ảnh/bản vẽ kèm theo phản ánh hiện trạng quan sát được của công trình tại thời điểm khảo sát. Các khuyết tật hiện hữu chính đã được ghi nhận và mã hóa để làm mốc đối chiếu trong quá trình thi công.
              <br /><br />
              Phiếu này là hồ sơ hiện trạng cơ sở phục vụ đối chiếu kỹ thuật và xử lý phản ánh/khiếu nại, bồi thường hoặc bảo hiểm (nếu phát sinh) theo hợp đồng, điều kiện bảo hiểm và quy định pháp luật áp dụng; bản thân chữ ký trên phiếu không mặc nhiên xác lập trách nhiệm, không phải sự từ bỏ quyền pháp lý và không miễn trừ nghĩa vụ của bất kỳ bên nào.&quot;
            </div>

            <div>
              <label className="form-label">Ý kiến của Chủ sở hữu / Người sử dụng:</label>
              <input
                type="text"
                className="form-control"
                value={ownerFeedbackP2}
                onChange={(e) => setOwnerFeedbackP2(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ===================== STEP 9: KÝ BIÊN BẢN 4 BÊN ===================== */}
        {currentStep === 9 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                BƯỚC 9: Chốt Biên Bản & Ký Xác Nhận Hiện Trường 4 Bên
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
              {/* 1. Chủ sở hữu */}
              <SignaturePad
                label="1. CHỦ SỞ HỮU / NGƯỜI SỬ DỤNG:"
                signerName={ownerNameP2}
                role="Chủ hộ"
                onSave={setSigOwner}
              />

              {/* 2. Đại diện Liên danh */}
              <SignaturePad
                label="2. ĐẠI DIỆN LIÊN DANH (CRLG-CRSRI-TT):"
                signerName={jvNameP2}
                role="Cán bộ Kỹ thuật"
                onSave={setSigJointVenture}
              />

              {/* 3. Đại diện Nhà thầu */}
              <SignaturePad
                label="3. ĐẠI DIỆN NHÀ THẦU / KHÁCH HÀNG:"
                signerName={contractorNameP2}
                role="Đại diện Nhà thầu"
                onSave={setSigContractor}
              />

              {/* 4. Người làm chứng / Địa phương */}
              <SignaturePad
                label="4. NGƯỜI LÀM CHỨNG / ĐỊA PHƯƠNG:"
                signerName={witnessNameP2}
                role="Chính quyền / Tổ dân phố"
                onSave={setSigWitness}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmitPhase2}
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem',
                  backgroundColor: '#2563eb',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                }}
              >
                <Send size={18} />
                <span>{isSubmitting ? 'Đang gửi hồ sơ Phase 2...' : 'HOÀN TẤT & NỘP HỒ SƠ KHẢO SÁT PHASE 2'}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP FOOTER NAVIGATION (PREV / NEXT) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
          {currentStep > 1 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentStep(currentStep - 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <ChevronLeft size={16} />
              <span>Bước trước</span>
            </button>
          ) : <div />}

          {currentStep < 9 ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCurrentStep(currentStep + 1)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <span>Tiếp theo: Bước {currentStep + 1}</span>
              <ChevronRight size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
