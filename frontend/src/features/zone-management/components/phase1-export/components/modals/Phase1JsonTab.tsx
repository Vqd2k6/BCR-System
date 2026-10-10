import React from 'react';
import type { ExportParcelItem } from '../../types';

interface Phase1JsonTabProps {
  previewReportData: unknown;
  previewParcel: ExportParcelItem;
}

export const Phase1JsonTab: React.FC<Phase1JsonTabProps> = ({
  previewReportData,
  previewParcel,
}) => {
  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs overflow-x-auto shadow border border-slate-800">
      <div className="text-emerald-400 text-[11px] font-bold mb-2 pb-2 border-b border-slate-800 flex items-center justify-between">
        <span>// JSON Data Payload injected into Report Generator Engine</span>
        <span>JWT Authorized Call</span>
      </div>
      <pre>{JSON.stringify(previewReportData || previewParcel, null, 2)}</pre>
    </div>
  );
};
