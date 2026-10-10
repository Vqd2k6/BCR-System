import React from 'react';
import {
  FileCheck,
  RefreshCw,
  AlertCircle,
  CheckSquare,
  Square,
  Eye,
  Download,
  FileType,
} from 'lucide-react';
import type { ExportParcelItem } from '../types';

interface Phase1ParcelsTableProps {
  filteredParcels: ExportParcelItem[];
  isLoading: boolean;
  selectedParcelIds: string[];
  onToggleSelectAll: () => void;
  onToggleSelectParcel: (id: string) => void;
  onOpenPreview: (parcel: ExportParcelItem) => void;
  onExportSinglePdf: (parcel: ExportParcelItem) => void;
  onExportSingleDocx: (parcel: ExportParcelItem) => void;
}

export const Phase1ParcelsTable: React.FC<Phase1ParcelsTableProps> = ({
  filteredParcels,
  isLoading,
  selectedParcelIds,
  onToggleSelectAll,
  onToggleSelectParcel,
  onOpenPreview,
  onExportSinglePdf,
  onExportSingleDocx,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileCheck size={18} className="text-sky-600" />
          <h3 className="text-sm font-bold text-slate-800">
            Danh Sách Hồ Sơ Khảo Sát Phase 1 ({filteredParcels.length} thửa)
          </h3>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Đã chọn: <strong className="text-sky-600">{selectedParcelIds.length}</strong> /{' '}
          {filteredParcels.length} lô
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
          <RefreshCw className="animate-spin text-sky-600" size={16} />
          <span>Đang nạp dữ liệu thửa đất và trạng thái báo cáo...</span>
        </div>
      ) : filteredParcels.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
          Không tìm thấy thửa đất nào phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <button
                    onClick={onToggleSelectAll}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    {selectedParcelIds.length === filteredParcels.length &&
                    filteredParcels.length > 0 ? (
                      <CheckSquare size={16} className="text-sky-600" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Mã Thửa / Mã Dự Án</th>
                <th className="p-3.5">Chủ Hộ & Địa Chỉ</th>
                <th className="p-3.5">Phân Loại Công Trình</th>
                <th className="p-3.5 text-center">Trạng Thái</th>
                <th className="p-3.5 text-center">Chỉ Số Rủi Rọ (ECS/VI)</th>
                <th className="p-3.5 text-right">Tính Năng Xuất Export</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredParcels.map((parcel) => {
                const isSelected = selectedParcelIds.includes(parcel.id);
                const isPhase1Ready = ['APPROVED', 'COMPLETED', 'SUBMITTED'].includes(
                  parcel.surveyStatus
                );

                return (
                  <tr
                    key={parcel.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isSelected ? 'bg-sky-50/50' : ''
                    }`}
                  >
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => onToggleSelectParcel(parcel.id)}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        {isSelected ? (
                          <CheckSquare size={16} className="text-sky-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{parcel.projectParcelCode}</span>
                        {parcel.officialCadastralCode && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({parcel.officialCadastralCode})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        ID Hồ sơ: {parcel.activePhase1ReportId?.slice(0, 12)}...
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{parcel.ownerName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {parcel.houseNumber} {parcel.street}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {parcel.buildingType === 'CONDO_MASTER'
                          ? 'Chung cư mẹ'
                          : parcel.buildingType === 'CONDO_UNIT'
                          ? 'Căn hộ con'
                          : 'Nhà dân cư độc lập'}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {parcel.floorCount} tầng
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          parcel.surveyStatus === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : parcel.surveyStatus === 'COMPLETED'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : parcel.surveyStatus === 'SUBMITTED'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {parcel.surveyStatus === 'APPROVED'
                          ? 'Đã Phê Duyệt'
                          : parcel.surveyStatus === 'COMPLETED'
                          ? 'Hoàn Thành'
                          : parcel.surveyStatus === 'SUBMITTED'
                          ? 'Đã Nộp'
                          : 'Đang Khảo Sát'}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            parcel.ecsClass === 'GOOD'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          ECS: {parcel.ecsClass || 'GOOD'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-600">
                          VI: {parcel.viClass || 'LOW'}
                        </span>
                      </div>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenPreview(parcel)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                          title="Xem trước Báo cáo A4 Song Ngữ chuẩn 0410"
                        >
                          <Eye size={13} />
                          <span>Xem Trước</span>
                        </button>

                        <button
                          onClick={() => onExportSinglePdf(parcel)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 ${
                            isPhase1Ready
                              ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                          }`}
                          title="Xuất file Báo cáo PDF A4 Song Ngữ chuẩn 0410 (Phase 1 BCS)"
                        >
                          <Download size={13} />
                          <span>Xuất PDF Báo Cáo</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
