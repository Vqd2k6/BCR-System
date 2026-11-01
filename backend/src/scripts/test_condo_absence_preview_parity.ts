/**
 * Đối chiếu xem trước ở frontend với kết luận của resolver backend trên toàn bộ tổ hợp cờ, không cần DB:
 *   cd frontend && npm run test:condo-absence-parity
 */
import assert from 'assert';
import { resolveCondoUnitAbsence } from '../modules/audit/condo/condo-absence.resolver';
import { previewCondoAbsence } from '../../../frontend/src/features/zone-management/components/review-queue/condo/unit-studio/condo-unit.adapters';

type Decision = 'ABSENT' | 'NOT_ABSENT' | null;

const DECISIONS: Decision[] = [null, 'ABSENT', 'NOT_ABSENT'];
const RESIDENT_STATUSES = ['CHỦ_HỘ_Ở', 'CHO_THUÊ', 'BỎ_TRỐNG_CHƯA_VỀ_Ở', 'VẮNG_MẶT_KHÓA_CỬA'];
const SOFT_FIXTURES: Record<string, unknown>[] = [
  {},
  { isAbsentee: true },
  { surveyCaseType: 'ABSENTEE' },
  { absenteeInfo: { notes: 'Gõ cửa không ai mở' } },
];
const SUSPICION_FIXTURES: Record<string, unknown>[] = [{ ownerName: 'Nguyễn Văn A' }, { ownerName: 'Không rõ' }];

function buildInput(isHard: boolean, ownLogCount: number, roomDefectCount: number, json: Record<string, unknown>) {
  return {
    isRefusedOrAbsent: isHard,
    unitStatus: null,
    reportStatus: null,
    surveyJson: json,
    ownLogCount,
    zoneCount: 1,
    roomDefectCount,
  };
}

let checked = 0;
for (const isHard of [false, true]) {
  for (const ownLogCount of [0, 2]) {
    for (const roomDefectCount of [0, 3]) {
      for (const soft of SOFT_FIXTURES) {
        for (const suspicion of SUSPICION_FIXTURES) {
          for (const loadedStatus of RESIDENT_STATUSES) {
            for (const loadedDecision of DECISIONS) {
              const loadedJson: Record<string, unknown> = {
                ...soft,
                ...suspicion,
                residentStatus: loadedStatus,
                ...(loadedDecision ? { absenceDecision: { decision: loadedDecision } } : {}),
              };
              const base = resolveCondoUnitAbsence(buildInput(isHard, ownLogCount, roomDefectCount, loadedJson));

              for (const nextStatus of RESIDENT_STATUSES) {
                for (const nextDecision of DECISIONS) {
                  const savedJson: Record<string, unknown> = {
                    ...loadedJson,
                    residentStatus: nextStatus,
                    ...(nextDecision ? { absenceDecision: { decision: nextDecision } } : { absenceDecision: undefined }),
                  };
                  const saved = resolveCondoUnitAbsence(buildInput(isHard, ownLogCount, roomDefectCount, savedJson));
                  const preview = previewCondoAbsence(base, { decision: nextDecision, residentStatus: nextStatus });
                  assert.strictEqual(
                    preview.state,
                    saved.state,
                    `Lệch: ${JSON.stringify({ isHard, ownLogCount, roomDefectCount, loadedJson, nextStatus, nextDecision })}`
                  );
                  checked += 1;
                }
              }

              // Không đổi gì thì xem trước phải trùng kết luận lúc tải, kể cả khi bảng căn hộ lệch JSON
              const unchanged = previewCondoAbsence(base, { decision: loadedDecision });
              assert.strictEqual(unchanged.state, base.state);
            }
          }
        }
      }
    }
  }
}

console.log(`✅ test_condo_absence_preview_parity: ${checked} tổ hợp khớp resolver`);
process.exit(0);
