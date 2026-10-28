import React, { useEffect, useState } from "react";
import {
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useProgressConfig } from "../hooks/useProgressConfig";
import type {
  ProgressReportConfig,
  RiskRule,
  SideOverrideRule,
} from "../types";

/**
 * Tab cấu hình plugin Progress Report – chỉ SUPER_ADMIN.
 * Mỗi lần lưu tạo phiên bản mới (append-only) kèm lý do thay đổi bắt buộc.
 */

const inputCls =
  "w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500";

function listToText(list: string[]): string {
  return list.join(", ");
}

function textToList(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

function argbToHex(argb: string): string {
  return `#${argb.slice(2).toLowerCase()}`;
}

function hexToArgb(hex: string): string {
  return `FF${hex.replace("#", "").toUpperCase()}`;
}

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => (
  <label className="block space-y-1">
    <span className="text-[11px] font-bold text-slate-600">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-slate-400">{hint}</span>}
  </label>
);

const RiskRuleEditor: React.FC<{
  title: string;
  rule: RiskRule;
  onChange: (r: RiskRule) => void;
  children?: React.ReactNode;
}> = ({ title, rule, onChange, children }) => (
  <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
    <div className="text-xs font-black text-slate-700">{title}</div>
    <Field
      label="Lớp ECS (phân cách dấu phẩy)"
      hint="GOOD, MEDIUM, DEFICIENT, CRITICAL"
    >
      <input
        className={inputCls}
        value={listToText(rule.ecsClasses)}
        onChange={(e) =>
          onChange({ ...rule, ecsClasses: textToList(e.target.value) })
        }
      />
    </Field>
    <Field
      label="Mức BRA (phân cách dấu phẩy)"
      hint="LOW, MEDIUM, HIGH, VERY_HIGH"
    >
      <input
        className={inputCls}
        value={listToText(rule.braValues)}
        onChange={(e) =>
          onChange({ ...rule, braValues: textToList(e.target.value) })
        }
      />
    </Field>
    <Field label="Burland tối thiểu (0–5, để trống = không xét)">
      <input
        type="number"
        min={0}
        max={5}
        className={inputCls}
        value={rule.burlandMin ?? ""}
        onChange={(e) =>
          onChange({
            ...rule,
            burlandMin: e.target.value === "" ? null : Number(e.target.value),
          })
        }
      />
    </Field>
    {children}
  </div>
);

export const ProgressConfigTab: React.FC = () => {
  const { data, isLoading, isSaving, error, reload, save } =
    useProgressConfig();
  const [draft, setDraft] = useState<ProgressReportConfig | null>(null);
  const [reason, setReason] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data) setDraft(structuredClone(data.config));
  }, [data]);

  if (isLoading && !draft) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải cấu hình...
      </div>
    );
  }
  if (!draft || !data) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />{" "}
        {error || "Không có dữ liệu cấu hình"}
      </div>
    );
  }

  const update = (patch: Partial<ProgressReportConfig>) =>
    setDraft({ ...draft, ...patch });
  const updateOverride = (idx: number, patch: Partial<SideOverrideRule>) =>
    update({
      sideOverrides: draft.sideOverrides.map((o, i) =>
        i === idx ? { ...o, ...patch } : o,
      ),
    });

  const handleSave = async () => {
    setSavedMsg(null);
    const version = await save(draft, reason.trim());
    if (version !== null) {
      setSavedMsg(`Đã lưu cấu hình phiên bản v${version}`);
      setReason("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-emerald-600" /> Cấu Hình Báo
              Cáo Tiến Độ Ngày
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Đang hiệu lực:{" "}
              <span className="font-mono font-bold">
                {data.source === "DB"
                  ? `v${data.version}`
                  : "Mặc định hệ thống"}
              </span>
              . Mỗi lần lưu tạo phiên bản mới, không ghi đè lịch sử.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDraft(structuredClone(data.defaults))}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Nạp giá trị mặc định
            </button>
            <button
              type="button"
              onClick={() => void reload()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tải lại
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Field
              label="Tiền tố tiêu đề báo cáo"
              hint='Sẽ nối thêm "GA STxx" / "TOÀN TUYẾN"'
            >
              <input
                className={inputCls}
                value={draft.titlePrefix}
                onChange={(e) => update({ titlePrefix: e.target.value })}
              />
            </Field>
          </div>
          <Field label='Năm XD từ năm này trở đi = "Mới"'>
            <input
              type="number"
              className={inputCls}
              value={draft.newBuildingMinYear}
              onChange={(e) =>
                update({ newBuildingMinYear: Number(e.target.value) })
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <RiskRuleEditor
            title='Ngưỡng "Nguy cơ cao"'
            rule={draft.highRisk}
            onChange={(r) => update({ highRisk: r })}
          />
          <RiskRuleEditor
            title='Ngưỡng "Cần theo dõi"'
            rule={draft.monitor}
            onChange={(r) => update({ monitor: { ...draft.monitor, ...r } })}
          >
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={draft.monitor.includeMonitoringRequired}
                onChange={(e) =>
                  update({
                    monitor: {
                      ...draft.monitor,
                      includeMonitoringRequired: e.target.checked,
                    },
                  })
                }
              />
              Hồ sơ yêu cầu quan trắc bổ sung → Cần theo dõi
            </label>
          </RiskRuleEditor>
          <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
            <div className="text-xs font-black text-slate-700">Khác</div>
            <Field label='Lớp ECS → "Xuống cấp"'>
              <input
                className={inputCls}
                value={listToText(draft.degraded.ecsClasses)}
                onChange={(e) =>
                  update({
                    degraded: { ecsClasses: textToList(e.target.value) },
                  })
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                className="cursor-pointer"
                checked={draft.includeNotSurveyedRows}
                onChange={(e) =>
                  update({ includeNotSurveyedRows: e.target.checked })
                }
              />
              Chế độ lũy kế: liệt kê cả công trình chưa khảo sát
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="text-xs font-black text-slate-700">
              Nhãn & màu cột "Tình trạng hiện tại"
            </div>
            {(
              Object.keys(draft.labels.condition) as Array<
                keyof ProgressReportConfig["labels"]["condition"]
              >
            ).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-24 text-[10px] font-mono text-slate-500">
                  {k}
                </span>
                <input
                  className={inputCls}
                  value={draft.labels.condition[k]}
                  onChange={(e) =>
                    update({
                      labels: {
                        ...draft.labels,
                        condition: {
                          ...draft.labels.condition,
                          [k]: e.target.value,
                        },
                      },
                    })
                  }
                />
                {(k === "MONITOR" ||
                  k === "HIGH_RISK" ||
                  k === "INACCESSIBLE") && (
                  <input
                    type="color"
                    className="w-9 h-8 rounded border border-slate-200 cursor-pointer"
                    value={argbToHex(draft.colors[k])}
                    onChange={(e) =>
                      update({
                        colors: {
                          ...draft.colors,
                          [k]: hexToArgb(e.target.value),
                        },
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="text-xs font-black text-slate-700">
              Nhãn "Trạng thái KS", phía tuyến & màu bảng
            </div>
            {(
              Object.keys(draft.labels.surveyProgress) as Array<
                keyof ProgressReportConfig["labels"]["surveyProgress"]
              >
            ).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="w-24 text-[10px] font-mono text-slate-500 truncate"
                  title={k}
                >
                  {k}
                </span>
                <input
                  className={inputCls}
                  value={draft.labels.surveyProgress[k]}
                  onChange={(e) =>
                    update({
                      labels: {
                        ...draft.labels,
                        surveyProgress: {
                          ...draft.labels.surveyProgress,
                          [k]: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2">
              <Field label="Phải tuyến">
                <input
                  className={inputCls}
                  value={draft.labels.sideRight}
                  onChange={(e) =>
                    update({
                      labels: { ...draft.labels, sideRight: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Trái tuyến">
                <input
                  className={inputCls}
                  value={draft.labels.sideLeft}
                  onChange={(e) =>
                    update({
                      labels: { ...draft.labels, sideLeft: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Không xác định">
                <input
                  className={inputCls}
                  value={draft.labels.sideUnknown}
                  onChange={(e) =>
                    update({
                      labels: { ...draft.labels, sideUnknown: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {(["header", "legend", "total"] as const).map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer"
                >
                  <input
                    type="color"
                    className="w-8 h-7 rounded border border-slate-200 cursor-pointer"
                    value={argbToHex(draft.colors[k])}
                    onChange={(e) =>
                      update({
                        colors: {
                          ...draft.colors,
                          [k]: hexToArgb(e.target.value),
                        },
                      })
                    }
                  />
                  {k === "header"
                    ? "Nền tiêu đề"
                    : k === "legend"
                      ? "Nền chú giải"
                      : "Nền dòng tổng"}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-slate-700">
                Hiệu chỉnh thủ công Phải / Trái tuyến
              </div>
              <div className="text-[10px] text-slate-400">
                Áp dụng khi công trình thiếu tọa độ; bật "Bắt buộc" để ghi đè
                kết quả tính hình học. Số nhà phân cách dấu phẩy.
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                update({
                  sideOverrides: [
                    ...draft.sideOverrides,
                    {
                      ward: "",
                      street: "",
                      houseNumbers: [],
                      side: "RIGHT",
                      force: false,
                    },
                  ],
                })
              }
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>
          {draft.sideOverrides.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic">
              Chưa có hiệu chỉnh nào.
            </div>
          ) : (
            draft.sideOverrides.map((o, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  className={`${inputCls} col-span-3`}
                  placeholder="Phường"
                  value={o.ward}
                  onChange={(e) =>
                    updateOverride(idx, { ward: e.target.value })
                  }
                />
                <input
                  className={`${inputCls} col-span-3`}
                  placeholder="Đường"
                  value={o.street}
                  onChange={(e) =>
                    updateOverride(idx, { street: e.target.value })
                  }
                />
                <input
                  className={`${inputCls} col-span-3`}
                  placeholder="Số nhà (vd 657, 659)"
                  value={o.houseNumbers.join(", ")}
                  onChange={(e) =>
                    updateOverride(idx, {
                      houseNumbers: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
                <select
                  className={`${inputCls} col-span-1 cursor-pointer`}
                  value={o.side}
                  onChange={(e) =>
                    updateOverride(idx, {
                      side: e.target.value === "LEFT" ? "LEFT" : "RIGHT",
                    })
                  }
                >
                  <option value="RIGHT">Phải</option>
                  <option value="LEFT">Trái</option>
                </select>
                <label className="col-span-1 flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={o.force}
                    onChange={(e) =>
                      updateOverride(idx, { force: e.target.checked })
                    }
                  />
                  Bắt buộc
                </label>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      sideOverrides: draft.sideOverrides.filter(
                        (_, i) => i !== idx,
                      ),
                    })
                  }
                  className="col-span-1 p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 justify-self-center transition-all active:scale-95 cursor-pointer"
                  aria-label="Xóa hiệu chỉnh"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-end gap-3 pt-2 border-t border-slate-100">
          <div className="flex-1">
            <Field label="Lý do thay đổi (bắt buộc, tối thiểu 5 ký tự)">
              <input
                className={inputCls}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Điều chỉnh ngưỡng Cần theo dõi theo chỉ đạo MAUR"
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || reason.trim().length < 5}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}{" "}
            Lưu phiên bản mới
          </button>
        </div>
        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
        {savedMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> {savedMsg}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-xs font-black text-slate-700 flex items-center gap-2 mb-3">
          <History className="w-4 h-4" /> Lịch sử phiên bản
        </h4>
        {data.versions.length === 0 ? (
          <div className="text-[11px] text-slate-400 italic">
            Chưa có phiên bản nào – đang dùng cấu hình mặc định.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.versions.map((v) => (
              <li
                key={v.versionNumber}
                className="py-2 text-xs flex flex-wrap gap-x-3 gap-y-0.5"
              >
                <span className="font-mono font-bold text-emerald-700">
                  v{v.versionNumber}
                </span>
                <span className="text-slate-500">
                  {new Date(v.createdAt).toLocaleString("vi-VN")}
                </span>
                <span className="text-slate-500">
                  {v.createdByName || "--"}
                </span>
                <span className="text-slate-700">{v.changeReason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
