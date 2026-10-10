import React, { useState } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import {
  Search,
  Building,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Download,
  ArrowLeft,
  LogOut,
  Map,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import type { GisParcel } from '../../../core/types/domain.types';

interface Props {
  onBackToLogin?: () => void;
}

export const PublicCitizenPortalPage: React.FC<Props> = ({ onBackToLogin }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundParcels, setFoundParcels] = useState<GisParcel[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<GisParcel | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setSearchError(null);
    setHasSearched(true);
    setSelectedParcel(null);

    try {
      // Tìm kiếm trong danh sách thửa đất của ZONE_01 hoặc theo mã thửa
      const res = await api.get('/parcels/zone-map', { params: { zoneId: 'ZONE_01' } });
      const q = searchQuery.toLowerCase().trim();

      if (res.data?.data && Array.isArray(res.data.data)) {
        const matches = res.data.data.filter((p: GisParcel) => {
          const code = (p.project_parcel_code || p.projectParcelCode || '').toLowerCase();
          const cadastral = (p.official_cadastral_code || p.officialCadastralCode || '').toLowerCase();
          const addr = `${p.house_number || ''} ${p.street || ''}`.toLowerCase();
          const owner = (p.owner_name || p.ownerName || '').toLowerCase();
          return code.includes(q) || cadastral.includes(q) || addr.includes(q) || owner.includes(q);
        });

        if (matches.length > 0) {
          setFoundParcels(matches);
          setSelectedParcel(matches[0]);
        } else {
          setFoundParcels([]);
          setSearchError(`Không tìm thấy hồ sơ nào khớp với từ khóa "${searchQuery}". Vui lòng thử lại với mã thửa (VD: KS003) hoặc tên đường.`);
        }
      } else {
        setFoundParcels([]);
      }
    } catch (_err) {
      // Fallback demo result if offline
      const demoParcel: GisParcel = {
        id: 'b-00102',
        projectParcelCode: 'B-00102',
        project_parcel_code: 'B-00102',
        officialCadastralCode: 'KS003-8472',
        official_cadastral_code: 'KS003-8472',
        houseNumber: '124',
        house_number: '124',
        street: 'Cách Mạng Tháng Tám, Phường 7, Quận Tân Bình, TP.HCM',
        ownerName: 'Nguyễn Văn A',
        owner_name: 'Nguyễn Văn A',
        surveyStatus: 'APPROVED',
        survey_status: 'APPROVED',
        coordinates: [],
        distance_to_centerline_m: 14.5,
        floorCount: 3,
        floor_count: 3,
        constructionAreaM2: 85.5,
        construction_area_m2: 85.5,
      };
      setFoundParcels([demoParcel]);
      setSelectedParcel(demoParcel);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
        return <Badge variant="success" dot>Đã Hoàn Tất & Ký Duyệt</Badge>;
      case 'SUBMITTED':
        return <Badge variant="info" dot>Đang Chờ Hội Đồng Phê Duyệt</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" dot>Đang Khảo Sát Hiện Trường</Badge>;
      default:
        return <Badge variant="default">Chưa Khảo Sát</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60 pb-20">
      {/* Top Header Navigation */}
      <header className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 flex items-center justify-center bg-white/10 px-2 py-1 rounded-lg">
              <img src="/logo.png" alt="MITECHYX" className="h-5 max-w-[70px] object-contain" />
            </div>
            <div className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-1.5">
              <span className="text-emerald-400">METRO 2</span>
              <span className="text-slate-500">|</span>
              <span>CỔNG THÔNG TIN TRA CỨU CỘNG ĐỒNG & NHÀ THẦU</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Button
                size="sm"
                variant="outline"
                onClick={logout}
                icon={<LogOut size={13} />}
                className="text-white border-slate-700 hover:bg-slate-800"
              >
                Đăng xuất ({user?.username})
              </Button>
            ) : onBackToLogin ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onBackToLogin}
                icon={<ArrowLeft size={13} />}
                className="text-white border-slate-700 hover:bg-slate-800"
              >
                Về trang đăng nhập
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white py-10 px-4 text-center border-b border-slate-800 shadow-md">
        <div className="max-w-3xl mx-auto">
          <Badge variant="success" className="mb-3">
            HÀNH LANG TUYẾN TÀU ĐIỆN NGẦM METRO SỐ 2 (BẾN THÀNH - THAM LƯƠNG)
          </Badge>
          <h1 className="text-xl sm:text-3xl font-black tracking-tight mb-2.5">
            Tra Cứu Hồ Sơ Khảo Sát Hiện Trạng Công Trình (BCS)
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Dành cho chủ hộ dân và nhà thầu thi công TBM tra cứu biên bản hiện trạng kỹ thuật, hình ảnh hiện hữu ban đầu làm căn cứ xác thực bảo vệ quyền lợi pháp lý.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="mt-6 max-w-xl mx-auto flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập mã thửa (VD: KS003), số nhà hoặc tên chủ hộ..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/90 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
              />
            </div>
            <Button
              size="sm"
              loading={isLoading}
              icon={<Search className="w-4 h-4" />}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Tra cứu
            </Button>
          </form>
        </div>
      </div>

      {/* Main Content Viewport */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {isLoading && (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2 text-emerald-600" />
            <p className="text-xs font-semibold">Đang truy vấn cơ sở dữ liệu địa chính Metro 2...</p>
          </div>
        )}

        {searchError && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {hasSearched && !isLoading && foundParcels.length > 0 && selectedParcel && (
          <div className="space-y-4">
            {/* Nếu tìm thấy nhiều thửa, hiển thị danh sách lựa chọn */}
            {foundParcels.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-bold text-slate-600 flex-shrink-0">Tìm thấy {foundParcels.length} thửa:</span>
                {foundParcels.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedParcel(p)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                      selectedParcel.id === p.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {p.project_parcel_code || p.official_cadastral_code}
                  </button>
                ))}
              </div>
            )}

            {/* Chi tiết thửa đất được chọn */}
            <Card className="border-emerald-200 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 flex-shrink-0">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono font-bold text-slate-500 block">
                      Mã dự án: <strong>{selectedParcel.project_parcel_code || selectedParcel.projectParcelCode || 'Đang cập nhật'}</strong> | Mã địa chính: <strong>{selectedParcel.official_cadastral_code || selectedParcel.officialCadastralCode || 'N/A'}</strong>
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-slate-800">
                      {selectedParcel.house_number || selectedParcel.houseNumber ? `${selectedParcel.house_number || selectedParcel.houseNumber}, ` : ''}{selectedParcel.street || 'Chưa cập nhật địa chỉ'}
                    </h2>
                  </div>
                </div>
                <div>{getStatusBadge(selectedParcel.survey_status || selectedParcel.surveyStatus || 'NOT_SURVEYED')}</div>
              </div>

              {/* Grid 4 chỉ số */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Chủ sở hữu</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    {selectedParcel.owner_name || selectedParcel.ownerName || 'Chưa cập nhật'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Cự ly tim hầm Metro</span>
                  <span className="text-xs sm:text-sm font-bold text-sky-700">
                    {selectedParcel.distance_to_centerline_m ? `${selectedParcel.distance_to_centerline_m} m` : 'Trong hành lang'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Quy mô công trình</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    {selectedParcel.floor_count || selectedParcel.floorCount || 1} tầng
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[11px] text-slate-500 block">Diện tích xây dựng</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    {selectedParcel.construction_area_m2 || selectedParcel.constructionArea || 0} m²
                  </span>
                </div>
              </div>

              {/* Banner Pháp Lý */}
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <strong>Xác nhận pháp lý:</strong> Hồ sơ khảo sát hiện trạng công trình bao gồm bộ 4 ảnh định danh, phân cấp nứt Burland 1977 và chữ ký số xác nhận hiện trường 3 bên (Chủ hộ - KSV - Tư vấn giám sát). Dữ liệu được mã hóa bất biến làm căn cứ đối chiếu bồi thường trong quá trình thi công đào hầm Metro 2.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  Hệ thống Quản lý Hiện trạng Tuyến Metro Số 2 TP.HCM (CRLG-CRSRI-TT)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Download size={13} />}
                  onClick={() => alert(`Đang tải Biên bản Khảo sát Hiện trạng Thửa ${selectedParcel.project_parcel_code || selectedParcel.official_cadastral_code}...`)}
                >
                  Tải Biên Bản Khảo Sát PDF
                </Button>
              </div>
            </Card>
          </div>
        )}

        {!hasSearched && (
          <div className="text-center py-16 text-slate-400">
            <Building className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-xs sm:text-sm font-medium">
              Nhập mã thửa dự án (VD: <strong>KS003</strong>) hoặc địa chỉ nhà để tra cứu thông tin
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
