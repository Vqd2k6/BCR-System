import React, { useState } from 'react';
import { Card } from '../../../core/components/ui/Card';
import { Badge } from '../../../core/components/ui/Badge';
import { Button } from '../../../core/components/ui/Button';
import { Input } from '../../../core/components/ui/FormControls';
import { Search, Building, ShieldCheck, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export const PublicCitizenPortalPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const sampleResult = {
    projectParcelCode: 'B-00102',
    officialCadastralCode: 'KS003-8472',
    address: '124 Cách Mạng Tháng Tám, Phường 7, Quận Tân Bình, TP.HCM',
    ownerName: 'Nguyễn Văn A',
    status: 'COMPLETED',
    surveyDate: '15/09/2026',
    totalZonesRecorded: 4,
    totalDefectsRecorded: 6,
    ecsClass: 'Good (Tình trạng hiện hữu tốt)',
    viClass: 'Low (Độ tổn thương thấp)',
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setHasSearched(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/60 pb-20">
      {/* Top Public Banner */}
      <div className="bg-slate-900 text-white py-12 px-4 text-center border-b border-slate-800">
        <div className="max-w-3xl mx-auto">
          <Badge variant="success" className="mb-3">
            CỔNG THÔNG TIN TRA CỨU CỘNG ĐỒNG
          </Badge>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
            Tra Cứu Hồ Sơ Khảo Sát Hiện Trạng Tuyến Metro Số 2
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Dành cho người dân và chủ sở hữu công trình tra cứu hiện trạng kỹ thuật, hình ảnh ghi nhận ban đầu làm căn cứ xác thực bảo vệ quyền lợi bồi thường.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="mt-6 max-w-xl mx-auto flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nhập mã thửa (VD: B-00102) hoặc Số nhà, tên chủ hộ..."
                className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/90 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <Button size="lg" icon={<Search className="w-4 h-4" />}>
              Tra cứu
            </Button>
          </form>
        </div>
      </div>

      {/* Search Result */}
      <div className="max-w-3xl mx-auto px-4 mt-8">
        {hasSearched ? (
          <Card className="border-emerald-200 shadow-md">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-600" />
                <div>
                  <span className="text-xs font-mono font-bold text-slate-500 block">
                    Mã dự án: {sampleResult.projectParcelCode} | Mã địa chính: {sampleResult.officialCadastralCode}
                  </span>
                  <h2 className="text-base font-bold text-slate-800">{sampleResult.address}</h2>
                </div>
              </div>
              <Badge variant="success" dot>Đã hoàn tất khảo sát</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Chủ sở hữu</span>
                <span className="text-xs sm:text-sm font-bold text-slate-800">{sampleResult.ownerName}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Ngày khảo sát</span>
                <span className="text-xs sm:text-sm font-bold text-slate-800">{sampleResult.surveyDate}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Hiện trạng ECS</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-700">Good (Tốt)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-500 block">Độ tổn thương VI</span>
                <span className="text-xs sm:text-sm font-bold text-purple-700">Low (Thấp)</span>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 leading-relaxed">
                <strong>Xác nhận pháp lý:</strong> Toàn bộ 4 ảnh định danh mặt đứng, 4 vùng không gian và 6 vị trí nứt tường hiện hữu đã được ký xác nhận 3 bên và lưu vết điện tử làm căn cứ pháp lý trong suốt quá trình xây dựng tuyến Metro 2.
              </div>
            </div>
          </Card>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Building className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Nhập mã thửa hoặc địa chỉ để xem chi tiết hồ sơ hiện trạng</p>
          </div>
        )}
      </div>
    </div>
  );
};
