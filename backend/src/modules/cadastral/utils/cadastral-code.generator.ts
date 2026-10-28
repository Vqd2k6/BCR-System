import { randomInt } from 'crypto';

/**
 * Bộ sinh "Mã ĐC" (official_cadastral_code) tạm cấp cho thửa công trình phát sinh do tách / gộp thửa.
 * Định dạng: "R" + 7 chữ số ngẫu nhiên (VD: R1234567).
 */

export const RANDOM_CADASTRAL_CODE_REGEX = /^R\d{7}$/;
const MAX_ATTEMPTS = 20;

/** Tối thiểu cần hàm query (tương thích PoolClient của pg và mock trong test). */
export interface CadastralCodeQueryClient {
  query(text: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
}

export function randomCadastralCode(): string {
  return `R${randomInt(0, 10_000_000).toString().padStart(7, '0')}`;
}

export function isRandomCadastralCode(code: string | null | undefined): boolean {
  return RANDOM_CADASTRAL_CODE_REGEX.test((code ?? '').trim());
}

/**
 * Sinh mã chưa tồn tại trong bảng parcels (kiểm tra trong cùng transaction).
 * Partial unique index uq_parcels_random_cadastral_code chặn tuyệt đối khi có giao dịch song song.
 */
export async function generateUniqueCadastralCode(
  client: CadastralCodeQueryClient,
  generate: () => string = randomCadastralCode
): Promise<string> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = generate();
    const dup = await client.query(`SELECT 1 FROM parcels WHERE official_cadastral_code = $1 LIMIT 1;`, [code]);
    if (!dup.rowCount) return code;
  }
  throw new Error(`Không sinh được Mã ĐC ngẫu nhiên duy nhất sau ${MAX_ATTEMPTS} lần thử`);
}

/** Dùng mã nhập tay nếu có, ngược lại sinh mã R####### mới. */
export async function resolveCadastralCode(
  client: CadastralCodeQueryClient,
  provided: string | null | undefined
): Promise<string> {
  const trimmed = (provided ?? '').trim();
  return trimmed || generateUniqueCadastralCode(client);
}

