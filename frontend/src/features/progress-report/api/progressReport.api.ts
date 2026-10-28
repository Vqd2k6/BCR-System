import axios from "axios";
import { api } from "../../../services/api";
import type {
  ProgressConfigResponse,
  ProgressPreviewData,
  ProgressQueryParams,
  ProgressReportConfig,
} from "../types";

/**
 * API client plugin Progress Report – mọi endpoint nằm dưới /progress-report.
 */

const BASE = "/progress-report";

function toParams(q: ProgressQueryParams): Record<string, string> {
  const params: Record<string, string> = {
    zoneId: q.zoneId,
    timeMode: q.timeMode,
  };
  if (q.timeMode === "DATE_RANGE") {
    if (q.fromDate) params.fromDate = q.fromDate;
    if (q.toDate) params.toDate = q.toDate;
  }
  return params;
}

function parseFilename(
  disposition: string | null | undefined,
  fallback: string,
): string {
  if (!disposition) return fallback;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch (err: unknown) {
      console.error("[ProgressReport] Không giải mã được tên file:", err);
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : fallback;
}

/** Lỗi trả về dạng Blob (responseType=blob) → đọc lại JSON problem-details để có thông báo rõ ràng. */
async function rethrowBlobError(err: unknown): Promise<never> {
  if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
    const textBody = await err.response.data.text();
    try {
      const parsed = JSON.parse(textBody) as {
        detail?: string;
        title?: string;
      };
      throw new Error(
        parsed.detail ||
          parsed.title ||
          `Lỗi xuất file (HTTP ${err.response.status})`,
      );
    } catch (parseErr: unknown) {
      if (parseErr instanceof Error && !(parseErr instanceof SyntaxError))
        throw parseErr;
      throw new Error(`Lỗi xuất file (HTTP ${err.response.status})`);
    }
  }
  throw err;
}

export const progressReportApi = {
  async preview(q: ProgressQueryParams): Promise<ProgressPreviewData> {
    const res = await api.get<{ success: boolean; data: ProgressPreviewData }>(
      `${BASE}/preview`,
      { params: toParams(q) },
    );
    return res.data.data;
  },

  async downloadExcel(q: ProgressQueryParams): Promise<string> {
    try {
      const res = await api.get<Blob>(`${BASE}/export`, {
        params: { ...toParams(q), format: "xlsx" },
        responseType: "blob",
      });
      const filename = parseFilename(
        typeof res.headers["content-disposition"] === "string"
          ? res.headers["content-disposition"]
          : null,
        "TienDo_KhaoSat.xlsx",
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return filename;
    } catch (err: unknown) {
      return rethrowBlobError(err);
    }
  },

  async getConfig(): Promise<ProgressConfigResponse> {
    const res = await api.get<{
      success: boolean;
      data: ProgressConfigResponse;
    }>(`${BASE}/config`);
    return res.data.data;
  },

  async saveConfig(
    content: ProgressReportConfig,
    changeReason: string,
  ): Promise<number> {
    const res = await api.post<{
      success: boolean;
      data: { versionNumber: number };
    }>(`${BASE}/config`, {
      content,
      changeReason,
    });
    return res.data.data.versionNumber;
  },
};
