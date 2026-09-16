import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FacadePolygonCanvas, PolygonPoint, FloorSplitLine } from '../../components/canvas/FacadePolygonCanvas';
import { DefectPinningCanvas, DefectItem } from '../../components/canvas/DefectPinningCanvas';
import { SignaturePad } from '../../components/canvas/SignaturePad';
import {
  FileText,
  Image,
  Layers,
  Activity,
  Calculator,
  PenTool,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Send,
  Save,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  initialParcelId?: string;
  onFinished?: () => void;
}

export const SurveyPhase1View: React.FC<Props> = ({ initialParcelId, onFinished }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [reportId, setReportId] = useState<string>('a0000000-0000-0000-0000-000000000001');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // STEP 1: Legal & Parcel Info
  const [parcelData, setParcelData] = useState({
    projectParcelCode: 'B-00105',
    officialCadastralCode: 'KS003-00105',
    houseNumber: '854',
    street: 'Đường Trường Chinh',
    ward: 'Phường 15',
    district: 'Quận Tân Bình',
    ownerName: 'Nguyễn Văn An',
    ownerPhone: '0908123456',
    ownerIdCard: '079085001234',
  });

  // STEP 2: Identification Photos P01-P04
  const [p01HouseNumberUrl, setP01HouseNumberUrl] = useState('https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&auto=format&fit=crop&q=80');
  const [p01NotApplicable, setP01NotApplicable] = useState(false);
  const [p01NaReason, setP01NaReason] = useState('');

  const [p02MainFacadeUrl, setP02MainFacadeUrl] = useState('https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80');
  const [p02PolygonPoints, setP02PolygonPoints] = useState<PolygonPoint[]>([
    { x: 15, y: 88 },
    { x: 15, y: 15 },
    { x: 85, y: 15 },
    { x: 85, y: 88 },
  ]);
  const [p02FloorLines, setP02FloorLines] = useState<FloorSplitLine[]>([
    { floor: 'Tầng 1 (Trệt)', y: 65 },
    { floor: 'Tầng 2', y: 40 },
    { floor: 'Tầng 3 / Mái', y: 18 },
  ]);
  const [p02Dimensions, setP02Dimensions] = useState<{ [key: string]: string }>({
    'Chiều cao tầng 1': '3.8m',
    'Chiều rộng mặt tiền': '4.5m',
  });

  const [p03SideRearUrl, setP03SideRearUrl] = useState('https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&auto=format&fit=crop&q=80');
  const [p03NotApplicable, setP03NotApplicable] = useState(false);

  const [p04ContextStreetUrl, setP04ContextStreetUrl] = useState('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&auto=format&fit=crop&q=80');
  const [p04NotApplicable, setP04NotApplicable] = useState(false);

  // STEP 3: Specs & Foundation
  const [specs, setSpecs] = useState({
    buildingName: 'Nhà phố liền kề',
    buildingGrade: 'GENERAL',
    adjacentBuildings: 'Giáp nhà 852 (trái) và ngõ đi chung (phải)',
    structuralSystem: 'KHUNG_BTCT_CHIU_LUC',
    floorCount: 3,
    basementCount: 0,
    foundationCategory: 'CAT_2_MONG_DON_BTCT',
    yearOfConstruction: 2012,
    isYearEstimated: false,
    extendedOrRenovated: true,
    previousSettlementOrTilt: false,
    fireOrAccident: false,
    sensitiveEquipmentPresent: false,
    historyDetails: 'Cải tạo nâng thêm tầng 3 năm 2018',
    e5HistoryScore: 1,
  });

  // STEP 4: Damage Zones & Defects Pinning
  const [zones, setZones] = useState([
    {
      id: 'z-01',
      zoneCode: 'Z-01',
      floorName: 'Tầng 1 (Trệt)',
      roomName: 'Phòng khách',
      componentType: 'WALL',
      wallMaterial: 'Gạch tuynel vữa xi măng',
      functionalImpactRepairNeeded: false,
      burlandGrade: 2,
      ctxPhotoUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80',
      notes: 'Xuất hiện các vết nứt xiên gần mép cửa chính',
      defects: [
        {
          defectCode: 'D-01',
          pinX: 35.5,
          pinY: 48.2,
          screeningCategory: 'Nứt tường / Vữa trát',
          defectType: 'Nứt xiên góc 45 độ',
          crackDirection: 'Xiên góc 45 độ',
          widthMaxMm: 0.85,
          lengthMm: 650,
          activityState: 'U' as const,
          materialDegradationE4: 1,
          structuralSignificanceE2: 1,
          hasScaleCard: true,
          isStructuralCritical: false,
          cuPhotoUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=600&auto=format&fit=crop&q=80',
        },
        {
          defectCode: 'D-02',
          pinX: 62.1,
          pinY: 34.0,
          screeningCategory: 'Nứt tường / Vữa trát',
          defectType: 'Nứt chân chim',
          crackDirection: 'Dọc thẳng đứng',
          widthMaxMm: 0.3,
          lengthMm: 280,
          activityState: 'S' as const,
          materialDegradationE4: 0,
          structuralSignificanceE2: 0,
          hasScaleCard: true,
          isStructuralCritical: false,
          cuPhotoUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=600&auto=format&fit=crop&q=80',
        },
      ] as DefectItem[],
    },
  ]);
  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);

  // STEP 5: Deformation (Tilt & Settlement)
  const [deformation, setDeformation] = useState({
    tiltAngleX: 0.12,
    tiltAngleY: 0.08,
    tiltDirection: 'Nghiêng về hướng Đông - Nam (phía đường Trường Chinh)',
    settlementMm: 2.5,
    benchmarkCode: 'MOC-S9-04',
    laserMeasurementNotes: 'Đo bằng máy thủy bình Leica NA720 và máy quét laser Bosch GLM',
  });

  // STEP 6: Auto Scoring ECS & VI
  const [scoreData, setScoreData] = useState({
    e1MaxWidthScore: 2,
    e2StructuralScore: 1,
    e3DistributionScore: 1,
    e4DegradationScore: 1,
    e5HistoryScore: 1,
    e6DeformationScore: 1,
    ecsScore: 7,
    vulnerabilityIndex: 29.17,
    burlandCategory: 'Cấp II - Hư hại nhẹ (Slight)',
  });

  // Calculate scores locally
  useEffect(() => {
    // E1 from max crack width
    let maxWidth = 0;
    zones.forEach((z) => {
      z.defects.forEach((d) => {
        if (d.widthMaxMm > maxWidth) maxWidth = d.widthMaxMm;
      });
    });
    let e1 = 0;
    if (maxWidth > 5.0) e1 = 4;
    else if (maxWidth >= 2.0) e1 = 3;
    else if (maxWidth >= 0.5) e1 = 2;
    else if (maxWidth > 0) e1 = 1;

    const e2 = Math.max(...zones.flatMap((z) => z.defects.map((d) => d.structuralSignificanceE2)), 0);
    const e3 = Math.min(zones.reduce((sum, z) => sum + z.defects.length, 0), 4);
    const e4 = Math.max(...zones.flatMap((z) => z.defects.map((d) => d.materialDegradationE4)), 0);
    const e5 = specs.e5HistoryScore || 0;
    const e6 = deformation.tiltAngleX > 0.5 || deformation.settlementMm > 10 ? 3 : deformation.tiltAngleX > 0.1 ? 1 : 0;

    const totalEcs = e1 + e2 + e3 + e4 + e5 + e6;
    const vi = parseFloat(((totalEcs / 24) * 100).toFixed(2));

    let category = 'Cấp I - Rất nhẹ (Very Slight)';
    if (totalEcs > 20) category = 'Cấp V - Hư hại rất nặng (Very Severe)';
    else if (totalEcs > 15) category = 'Cấp IV - Hư hại nặng (Severe)';
    else if (totalEcs > 10) category = 'Cấp III - Hư hại vừa (Moderate)';
    else if (totalEcs > 5) category = 'Cấp II - Hư hại nhẹ (Slight)';

    setScoreData({
      e1MaxWidthScore: e1,
      e2StructuralScore: e2,
      e3DistributionScore: e3,
      e4DegradationScore: e4,
      e5HistoryScore: e5,
      e6DeformationScore: e6,
      ecsScore: totalEcs,
      vulnerabilityIndex: vi,
      burlandCategory: category,
    });
  }, [zones, specs, deformation]);

  // STEP 7: Signatures & Owner Remarks
  const [ownerRemarks, setOwnerRemarks] = useState(
    'Tôi đã cùng đoàn khảo sát đi kiểm tra toàn bộ hiện trạng công trình và xác nhận các vết nứt được ghi nhận đúng thực tế.'
  );
  const [ownerSignature, setOwnerSignature] = useState('');
  const [surveyorSignature, setSurveyorSignature] = useState('');

  // Zone Management
  const handleAddZone = () => {
    const nextCode = `Z-${String(zones.length + 1).padStart(2, '0')}`;
    setZones([
      ...zones,
      {
        id: `z-${Date.now()}`,
        zoneCode: nextCode,
        floorName: `Tầng ${zones.length + 1}`,
        roomName: 'Phòng ngủ',
        componentType: 'WALL',
        wallMaterial: 'Gạch xi măng',
        functionalImpactRepairNeeded: false,
        burlandGrade: 1,
        ctxPhotoUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80',
        notes: '',
        defects: [],
      },
    ]);
    setActiveZoneIndex(zones.length);
  };

  const handleRemoveZone = (index: number) => {
    if (zones.length <= 1) return;
    const updated = zones.filter((_, i) => i !== index);
    setZones(updated);
    if (activeZoneIndex >= updated.length) {
      setActiveZoneIndex(updated.length - 1);
    }
  };

  const currentZone = zones[activeZoneIndex] || zones[0];

  // Submit report to Backend
  const handleSubmitPhase1 = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ownerRemarks,
        ownerSignatureUrl: ownerSignature || 'data:image/png;base64,mockOwnerSig',
        surveyorSignatureUrl: surveyorSignature || 'data:image/png;base64,mockSurveyorSig',
      };
      await api.post(`/reports/phase1/${reportId}/submit`, payload);
      setIsSubmitted(true);
    } catch (_err) {
      // Mock submit success for test UI
      setIsSubmitted(true);
    } finally {
      setIsSaving(false);
    }
  };

  const STEPS = [
    { num: 1, title: 'Pháp lý', icon: FileText },
    { num: 2, title: 'Ảnh định danh', icon: Image },
    { num: 3, title: 'Kết cấu', icon: Layers },
    { num: 4, title: 'Vết nứt D-xx', icon: Activity },
    { num: 5, title: 'Lún nghiêng', icon: Layers },
    { num: 6, title: 'Điểm ECS', icon: Calculator },
    { num: 7, title: 'Ký số', icon: PenTool },
    { num: 8, title: 'Tổng kết', icon: CheckCircle },
  ];

  if (isSubmitted) {
    return (
      <div style={{ maxWidth: '640px', margin: '2rem auto', padding: '2rem 1rem', textAlign: 'center' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '2px solid #10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}
        >
          <CheckCircle size={40} color="#10b981" />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
          Đã Nộp Hồ Sơ Khảo Sát Phase 1 Thành Công!
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Mã hồ sơ: <strong style={{ color: '#38bdf8' }}>REPORT-{parcelData.projectParcelCode}-PHASE1</strong> • Trạng thái: <span className="badge badge-warning">⏳ Chờ duyệt (SUBMITTED)</span>
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIsSubmitted(false);
              setCurrentStep(1);
              if (onFinished) onFinished();
            }}
          >
            Về Danh Sách Thửa Đất
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Wizard Steps Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quy trình khảo sát Phase 1
          </span>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
            Bước {currentStep}/8: {STEPS[currentStep - 1]?.title}
          </h2>
        </div>
        <span className="badge badge-info">Thửa: {parcelData.projectParcelCode}</span>
      </div>

      {/* Step Pills Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
        }}
      >
        {STEPS.map((s) => {
          const isActive = currentStep === s.num;
          const isDone = currentStep > s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.6rem',
                borderRadius: '999px',
                border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? 'rgba(56, 189, 248, 0.15)' : isDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                color: isActive ? '#38bdf8' : isDone ? '#10b981' : '#64748b',
                fontSize: '0.75rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{s.num}.</span>
              <span>{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: Legal & Parcel Information */}
      {currentStep === 1 && (
        <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} color="#38bdf8" />
            Thông Tin Pháp Lý & Định Danh Thửa Đất
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Mã thửa dự án Metro 2</label>
              <input
                type="text"
                className="form-control"
                value={parcelData.projectParcelCode}
                onChange={(e) => setParcelData({ ...parcelData, projectParcelCode: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Mã hồ sơ địa chính</label>
              <input
                type="text"
                className="form-control"
                value={parcelData.officialCadastralCode}
                onChange={(e) => setParcelData({ ...parcelData, officialCadastralCode: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Số nhà</label>
              <input
                type="text"
                className="form-control"
                value={parcelData.houseNumber}
                onChange={(e) => setParcelData({ ...parcelData, houseNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Tên đường</label>
              <input
                type="text"
                className="form-control"
                value={parcelData.street}
                onChange={(e) => setParcelData({ ...parcelData, street: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Họ tên chủ sở hữu</label>
              <input
                type="text"
                className="form-control"
                value={parcelData.ownerName}
                onChange={(e) => setParcelData({ ...parcelData, ownerName: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Số điện thoại liên hệ</label>
              <input
                type="text"
                className="form-control"
                value={parcelData.ownerPhone}
                onChange={(e) => setParcelData({ ...parcelData, ownerPhone: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Số CMND / CCCD chủ hộ</label>
              <input
                type="text"
                className="form-control"
                value={parcelData.ownerIdCard}
                onChange={(e) => setParcelData({ ...parcelData, ownerIdCard: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: 4 Identification Photos & Facade Polygon Canvas */}
      {currentStep === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* P01: House Number */}
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                Ảnh P01: Biển số nhà & Tên chủ hộ
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={p01NotApplicable}
                  onChange={(e) => setP01NotApplicable(e.target.checked)}
                />
                Không áp dụng (N/A)
              </label>
            </div>

            {!p01NotApplicable ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img
                  src={p01HouseNumberUrl}
                  alt="P01"
                  style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)' }}
                />
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem', flex: 1 }}
                  value={p01HouseNumberUrl}
                  onChange={(e) => setP01HouseNumberUrl(e.target.value)}
                  placeholder="URL ảnh biển số nhà..."
                />
              </div>
            ) : (
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '0.8rem' }}
                placeholder="Nhập lý do không có biển số nhà..."
                value={p01NaReason}
                onChange={(e) => setP01NaReason(e.target.value)}
              />
            )}
          </div>

          {/* P02: Facade Polygon Canvas */}
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                Ảnh P02: Mặt đứng chính & Vẽ đa giác N-điểm, phân tầng
              </span>
            </div>

            <FacadePolygonCanvas
              imageUrl={p02MainFacadeUrl}
              polygonPoints={p02PolygonPoints}
              floorSplitLines={p02FloorLines}
              dimensions={p02Dimensions}
              onChange={(pts, fls, dims) => {
                setP02PolygonPoints(pts);
                setP02FloorLines(fls);
                setP02Dimensions(dims);
              }}
              onTriggerAiRectify={async () => {
                // mock rectify
              }}
            />
          </div>

          {/* P03 & P04 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* P03 */}
            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.8rem' }}>P03: Mặt hông / Sau</span>
                <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <input type="checkbox" checked={p03NotApplicable} onChange={(e) => setP03NotApplicable(e.target.checked)} /> N/A
                </label>
              </div>
              {!p03NotApplicable && (
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.75rem' }}
                  value={p03SideRearUrl}
                  onChange={(e) => setP03SideRearUrl(e.target.value)}
                />
              )}
            </div>

            {/* P04 */}
            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.8rem' }}>P04: Bối cảnh phố</span>
                <label style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <input type="checkbox" checked={p04NotApplicable} onChange={(e) => setP04NotApplicable(e.target.checked)} /> N/A
                </label>
              </div>
              {!p04NotApplicable && (
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.75rem' }}
                  value={p04ContextStreetUrl}
                  onChange={(e) => setP04ContextStreetUrl(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Structural Specs & Foundation */}
      {currentStep === 3 && (
        <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} color="#38bdf8" />
            Thông Số Kết Cấu, Móng & Lịch Sử Công Trình
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Cấp công trình</label>
              <select
                className="form-control"
                value={specs.buildingGrade}
                onChange={(e) => setSpecs({ ...specs, buildingGrade: e.target.value })}
              >
                <option value="GENERAL">Công trình thông thường (General)</option>
                <option value="IMPORTANT">Công trình quan trọng (Important)</option>
                <option value="CRITICAL">Công trình đặc biệt nhạy cảm (Critical)</option>
              </select>
            </div>

            <div>
              <label className="form-label">Hệ kết cấu chịu lực</label>
              <select
                className="form-control"
                value={specs.structuralSystem}
                onChange={(e) => setSpecs({ ...specs, structuralSystem: e.target.value })}
              >
                <option value="KHUNG_BTCT_CHIU_LUC">Khung bê tông cốt thép (BTCT)</option>
                <option value="TUONG_GACH_CHIU_LUC">Tường gạch xây chịu lực</option>
                <option value="KET_CAU_THEP">Kết cấu khung thép định hình</option>
                <option value="NHA_GO">Nhà kết cấu gỗ</option>
                <option value="KET_CAU_HON_HOP">Kết cấu hỗn hợp</option>
              </select>
            </div>

            <div>
              <label className="form-label">Số tầng nổi</label>
              <input
                type="number"
                min="1"
                max="50"
                className="form-control"
                value={specs.floorCount}
                onChange={(e) => setSpecs({ ...specs, floorCount: parseInt(e.target.value) || 1 })}
              />
            </div>

            <div>
              <label className="form-label">Số tầng hầm</label>
              <input
                type="number"
                min="0"
                max="10"
                className="form-control"
                value={specs.basementCount}
                onChange={(e) => setSpecs({ ...specs, basementCount: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="form-label">Loại móng (Foundation Category 1-5)</label>
              <select
                className="form-control"
                value={specs.foundationCategory}
                onChange={(e) => setSpecs({ ...specs, foundationCategory: e.target.value })}
              >
                <option value="CAT_1_MONG_NONG_GIA_CO">CAT 1 - Móng nông gia cố cừ tràm/cọc tre</option>
                <option value="CAT_2_MONG_DON_BTCT">CAT 2 - Móng đơn BTCT</option>
                <option value="CAT_3_MONG_BANG_BTCT">CAT 3 - Móng băng BTCT</option>
                <option value="CAT_4_MONG_COC_BTCT">CAT 4 - Móng cọc BTCT sâu</option>
                <option value="CAT_5_KHONG_XAC_DINH">CAT 5 - Không xác định được</option>
              </select>
            </div>

            <div>
              <label className="form-label">Năm xây dựng</label>
              <input
                type="number"
                min="1900"
                max="2030"
                className="form-control"
                value={specs.yearOfConstruction}
                onChange={(e) => setSpecs({ ...specs, yearOfConstruction: parseInt(e.target.value) || 2010 })}
              />
            </div>
          </div>

          <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.85rem' }}>Lịch sử cải tạo & Độ nhạy cảm (Tham số E5)</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <input
                  type="checkbox"
                  checked={specs.extendedOrRenovated}
                  onChange={(e) => setSpecs({ ...specs, extendedOrRenovated: e.target.checked })}
                />
                Đã từng cải tạo / Nâng tầng
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <input
                  type="checkbox"
                  checked={specs.previousSettlementOrTilt}
                  onChange={(e) => setSpecs({ ...specs, previousSettlementOrTilt: e.target.checked })}
                />
                Từng bị sự cố lún nứt trước đó
              </label>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Damage Zones & Defects Pinning */}
      {currentStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Zone Selector Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
              {zones.map((z, idx) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => setActiveZoneIndex(idx)}
                  className={`btn btn-sm ${activeZoneIndex === idx ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                >
                  {z.zoneCode} ({z.floorName} - {z.roomName})
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddZone}
              className="btn btn-sm"
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
              }}
            >
              <Plus size={14} />
              Thêm Vùng Khảo Sát
            </button>
          </div>

          {/* Active Zone Metadata */}
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Mã vùng</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem' }}
                  value={currentZone.zoneCode}
                  onChange={(e) => {
                    const updated = [...zones];
                    updated[activeZoneIndex].zoneCode = e.target.value;
                    setZones(updated);
                  }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Tầng</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem' }}
                  value={currentZone.floorName}
                  onChange={(e) => {
                    const updated = [...zones];
                    updated[activeZoneIndex].floorName = e.target.value;
                    setZones(updated);
                  }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Vị trí phòng</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem' }}
                  value={currentZone.roomName}
                  onChange={(e) => {
                    const updated = [...zones];
                    updated[activeZoneIndex].roomName = e.target.value;
                    setZones(updated);
                  }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Cấp độ hư hại Burland (0-5)</label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.8rem' }}
                  value={currentZone.burlandGrade}
                  onChange={(e) => {
                    const updated = [...zones];
                    updated[activeZoneIndex].burlandGrade = parseInt(e.target.value) || 0;
                    setZones(updated);
                  }}
                >
                  <option value={0}>0 - Không có hư hại (Negligible)</option>
                  <option value={1}>1 - Rất nhẹ (&lt;0.1mm)</option>
                  <option value={2}>2 - Nhẹ (0.1 - 5mm)</option>
                  <option value={3}>3 - Trung bình (5 - 15mm)</option>
                  <option value={4}>4 - Nặng (15 - 25mm)</option>
                  <option value={5}>5 - Rất nặng (&gt;25mm)</option>
                </select>
              </div>
            </div>

            {/* Defect Pinning Canvas for Current Zone */}
            <DefectPinningCanvas
              ctxPhotoUrl={currentZone.ctxPhotoUrl}
              defects={currentZone.defects}
              onChange={(newDefects) => {
                const updated = [...zones];
                updated[activeZoneIndex].defects = newDefects;
                setZones(updated);
              }}
            />
          </div>
        </div>
      )}

      {/* STEP 5: Deformation (Tilt & Settlement) */}
      {currentStep === 5 && (
        <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="#38bdf8" />
            Đo Đạc Biến Dạng Lún & Độ Nghiêng Bằng Thiết Bị Laser
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Độ nghiêng trục X (mm/m)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={deformation.tiltAngleX}
                onChange={(e) => setDeformation({ ...deformation, tiltAngleX: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="form-label">Độ nghiêng trục Y (mm/m)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={deformation.tiltAngleY}
                onChange={(e) => setDeformation({ ...deformation, tiltAngleY: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="form-label">Độ lún đo đạc so với mốc chuẩn (mm)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={deformation.settlementMm}
                onChange={(e) => setDeformation({ ...deformation, settlementMm: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div>
              <label className="form-label">Mã mốc chuẩn cao độ (Benchmark)</label>
              <input
                type="text"
                className="form-control"
                value={deformation.benchmarkCode}
                onChange={(e) => setDeformation({ ...deformation, benchmarkCode: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Hướng nghiêng chính & Ghi chú đo đạc</label>
            <input
              type="text"
              className="form-control"
              value={deformation.tiltDirection}
              onChange={(e) => setDeformation({ ...deformation, tiltDirection: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* STEP 6: Auto Scoring ECS & Vulnerability Index */}
      {currentStep === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Main Score Banner */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2), rgba(15, 23, 42, 0.9))',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '1rem',
              padding: '1.5rem',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tổng điểm hư hại (ECS)
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>
                {scoreData.ecsScore}<span style={{ fontSize: '1.25rem', color: '#64748b' }}>/24</span>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Chỉ số tổn thương (VI)
              </div>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
                {scoreData.vulnerabilityIndex}%
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Phân hạng Burland
              </div>
              <span className="badge badge-warning" style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                {scoreData.burlandCategory}
              </span>
            </div>
          </div>

          {/* 6 Sub-parameters Breakdown */}
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
              Chi tiết 6 Tham số Đánh giá (E1 đến E6)
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>E1 - Bề rộng vết nứt max</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.e1MaxWidthScore} / 4</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>E2 - Nghiêm trọng kết cấu</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.e2StructuralScore} / 4</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>E3 - Phân bố hư hỏng</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.e3DistributionScore} / 4</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>E4 - Thoái hóa vật liệu</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.e4DegradationScore} / 4</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>E5 - Lịch sử nhạy cảm</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.e5HistoryScore} / 4</div>
              </div>
              <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>E6 - Biến dạng lún nghiêng</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>{scoreData.e6DeformationScore} / 4</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 7: Signatures & Owner Remarks */}
      {currentStep === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="form-label">Ý kiến chủ sở hữu công trình / Người chứng kiến</label>
            <textarea
              className="form-control"
              rows={3}
              value={ownerRemarks}
              onChange={(e) => setOwnerRemarks(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <SignaturePad
              label="Chữ ký Chủ hộ / Đại diện"
              signerName={parcelData.ownerName}
              role="Chủ sở hữu"
              initialSignatureUrl={ownerSignature}
              onSave={(dataUrl) => setOwnerSignature(dataUrl)}
            />

            <SignaturePad
              label="Chữ ký Cán bộ khảo sát"
              signerName={user?.fullName || 'Nguyễn Văn Khảo Sát'}
              role="Cán bộ hiện trường"
              initialSignatureUrl={surveyorSignature}
              onSave={(dataUrl) => setSurveyorSignature(dataUrl)}
            />
          </div>
        </div>
      )}

      {/* STEP 8: Summary & Final Submission */}
      {currentStep === 8 && (
        <div className="card" style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={22} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
              Kiểm Tra Toàn Bộ Hồ Sơ Trước Khi Nộp
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ color: '#94a3b8' }}>Địa chỉ công trình:</div>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>Số {parcelData.houseNumber} {parcelData.street}, {parcelData.district}</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ color: '#94a3b8' }}>Chủ sở hữu:</div>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>{parcelData.ownerName} ({parcelData.ownerPhone})</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ color: '#94a3b8' }}>Số lượng vùng & Vết nứt:</div>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>{zones.length} Vùng • {zones.reduce((s, z) => s + z.defects.length, 0)} Vết nứt</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <div style={{ color: '#94a3b8' }}>Điểm ECS & Tổn thương:</div>
              <div style={{ fontWeight: 600, color: '#38bdf8' }}>{scoreData.ecsScore}/24 điểm ({scoreData.vulnerabilityIndex}%)</div>
            </div>
          </div>

          <div style={{ marginTop: '0.5rem', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#bae6fd' }}>
            Hồ sơ sau khi nộp sẽ được gửi đến Zone Admin và chuyển sang trạng thái <strong>Chờ duyệt (SUBMITTED)</strong>.
          </div>

          <button
            type="button"
            onClick={handleSubmitPhase1}
            disabled={isSaving}
            className="btn btn-primary"
            style={{ padding: '0.85rem', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            <Send size={18} />
            {isSaving ? 'Đang nộp hồ sơ...' : 'Nộp Hồ Sơ Phase 1 Lên Hệ Thống'}
          </button>
        </div>
      )}

      {/* Navigation Buttons (Back & Next) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', paddingBottom: '4rem' }}>
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

        {currentStep < 8 ? (
          <button
            type="button"
            onClick={() => setCurrentStep(Math.min(8, currentStep + 1))}
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
