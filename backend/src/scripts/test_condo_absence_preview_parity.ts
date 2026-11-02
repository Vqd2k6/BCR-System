/**
 * Đối chiếu xem trước ở frontend với kết luận của resolver backend trên toàn bộ tổ hợp cờ, không cần DB:
 *   cd frontend && npm run test:condo-absence-parity
 */
import assert from 'assert';
import { resolveCondoUnitAbsence } from '../modules/audit/condo/condo-absence.resolver';
import {
  needsCondoAbsenceDecision,
  previewCondoAbsence,
  resolvePendingCondoAbsenceState,
} from '../../../frontend/src/features/zone-management/components/review-queue/condo/unit-studio/condo-unit.adapters';
import {
  getCondoUnitSaveBlockReason,
  normalizeCondoUnitData,
} from '../../../frontend/src/features/zone-management/components/review-queue/condo/unit-studio/condo-unit.normalizer';
import type { AuditStepwiseData } from '../../../frontend/src/features/zone-management/components/review-queue/stepwise/types';

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

// Lớp phủ định danh: ô đã xóa phải trống, không rơi về chủ tòa mẹ; bản gốc KSV vẫn đọc được
const garbageUnit = (overrides?: Record<string, unknown>) =>
  normalizeCondoUnitData({
    condoAbsence: resolveCondoUnitAbsence(
      buildInput(false, 0, 0, { residentStatus: 'VẮNG_MẶT_KHÓA_CỬA', ownerName: 'Không rõ', adminIdentityOverrides: overrides })
    ),
    ownerName: 'Chủ Tòa Mẹ',
    ownerPhone: '0916459189',
    unitInfo: { owner_name: 'Không rõ', owner_phone: '0987654321', owner_id_card: '1111', resident_status: 'VẮNG_MẶT_KHÓA_CỬA' },
    surveyJson: {
      ownerName: 'Không rõ',
      ownerPhone: '0987654321',
      ownerIdCard: '1111',
      unitAreaM2: 0,
      residentStatus: 'VẮNG_MẶT_KHÓA_CỬA',
      ...(overrides ? { adminIdentityOverrides: overrides } : {}),
    },
  } as unknown as AuditStepwiseData);

const untouched = garbageUnit();
assert.strictEqual(untouched.ownerIdCard, '1111');
assert.deepStrictEqual(untouched.identityOverrideKeys, []);

const cleaned = garbageUnit({ ownerName: null, ownerPhone: null, ownerIdCard: null, unitAreaM2: 65.5, updatedBy: 'admin' });
assert.strictEqual(cleaned.ownerName, '');
assert.strictEqual(cleaned.ownerPhone, '');
assert.strictEqual(cleaned.ownerIdCard, '');
assert.strictEqual(cleaned.signatures.ownerName, '');
assert.strictEqual(cleaned.unitAreaM2, 65.5);
assert.strictEqual(cleaned.ksvOriginalIdentity.ownerIdCard, '1111');
assert.strictEqual(cleaned.ksvOriginalIdentity.ownerName, 'Không rõ');
assert.deepStrictEqual(cleaned.identityOverrideKeys, ['ownerName', 'ownerPhone', 'ownerIdCard', 'unitAreaM2']);

// Rời nhóm vắng phải chốt; khớp validateBeforeModify ở backend
assert.strictEqual(untouched.loadedAbsenceState, 'ABSENT');
const leaving = { ...untouched, residentStatus: 'CHỦ_HỘ_Ở' };
assert.match(String(getCondoUnitSaveBlockReason(leaving)), /Đã Khảo Sát/);
assert.strictEqual(getCondoUnitSaveBlockReason(untouched), null);
const decided = {
  ...leaving,
  absenceDecision: { decision: 'NOT_ABSENT' as const, reason: 'Admin đối chiếu ảnh', decidedAt: '', decidedBy: '' },
};
assert.strictEqual(getCondoUnitSaveBlockReason(decided), null);
assert.strictEqual(needsCondoAbsenceDecision(untouched.absence, 'CHỦ_HỘ_Ở', 'CHỦ_HỘ_Ở', 'ABSENT'), false);

// Cảnh báo thiếu tên ở thanh trên phải theo trạng thái đang sửa (U-010: căn thường vừa đổi sang vắng)
const normalUnit = { condoAbsence: resolveCondoUnitAbsence(buildInput(false, 0, 0, { ownerName: 'Không rõ', residentStatus: 'CHỦ_HỘ_Ở' })) };
assert.notStrictEqual(resolvePendingCondoAbsenceState(normalUnit, {}), 'ABSENT');
assert.strictEqual(resolvePendingCondoAbsenceState(normalUnit, { residentStatus: 'VẮNG_MẶT_KHÓA_CỬA', ownerName: '' }), 'ABSENT');
assert.notStrictEqual(resolvePendingCondoAbsenceState(normalUnit, { ownerName: '' }), 'ABSENT', 'Chỉ xóa tên thì vẫn cảnh báo');
assert.strictEqual(resolvePendingCondoAbsenceState(normalUnit, { absenceDecision: { decision: 'ABSENT' } }), 'ABSENT');

console.log(`✅ test_condo_absence_preview_parity: ${checked} tổ hợp khớp resolver`);
process.exit(0);
