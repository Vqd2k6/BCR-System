import type { PoolClient } from 'pg';

type JsonRecord = Record<string, unknown>;

// Do server ghi, form KSV không gửi lại nên lưu đè toàn bộ JSON sẽ làm mất hiệu chỉnh của Admin
const SERVER_MANAGED_SURVEY_KEYS = ['adminIdentityOverrides', 'archivedAdminIdentityOverrides'];

/** Giá trị đang lưu luôn thắng, nên client không thêm, sửa hay xóa được các khóa này. */
export function carryServerManagedSurveyKeys(existing: JsonRecord, incoming: JsonRecord): JsonRecord {
  const next = { ...incoming };
  for (const key of SERVER_MANAGED_SURVEY_KEYS) {
    if (existing[key] === undefined) delete next[key];
    else next[key] = existing[key];
  }
  return next;
}

/** Dùng cho các câu UPDATE ghi đè cả `survey_data_json`; null nghĩa là lượt lưu không đổi JSON. */
export async function mergeServerManagedKeysInTx(
  client: PoolClient,
  reportId: string,
  surveyDataJson: unknown
): Promise<string | null> {
  if (!surveyDataJson) return null;
  const incoming = typeof surveyDataJson === 'string' ? JSON.parse(surveyDataJson) : surveyDataJson;
  const res = await client.query<{ survey_data_json: JsonRecord | null }>(
    `SELECT survey_data_json FROM base_survey_reports WHERE id = $1 FOR UPDATE;`,
    [reportId]
  );
  return JSON.stringify(carryServerManagedSurveyKeys(res.rows[0]?.survey_data_json ?? {}, incoming as JsonRecord));
}
