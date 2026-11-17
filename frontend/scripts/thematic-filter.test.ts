import assert from 'node:assert/strict';
import {
  countActivePrecisionRules,
  describeActiveFilterChips,
  hasActivePrecisionFilter,
  matchesPrecisionFilter,
  sanitizeStoredFilter,
} from '../src/features/gis-visualization/registry/thematicFilter';
import type { ParcelThematicMetrics } from '../src/features/gis-visualization/types';

const base: ParcelThematicMetrics = {
  parcelId: 'p1',
  reportStatus: 'APPROVED',
  isCondoMaster: false,
  isVacantLand: false,
  constructionYear: 1992,
  isYearEstimated: false,
  buildingAge: 34,
  yearCohort: 'AGE_26_40',
  foundationType: 'Móng băng',
  foundationBucket: 'SHALLOW',
  foundationCatScore: 3,
  structureSystem: 'Khung BTCT',
  structureClass: 'RC',
  ecsClass: 'DEFICIENT',
  totalEcs: 12,
  burlandMaxGrade: 3,
  viClass: 'HIGH',
  avgViScore: 2.8,
  braLevel: 'HIGH',
  impactCode: 'I3',
  aboveFloors: 4,
  basementFloors: 0,
  floorTier: 'F4_5',
};
const m = (patch: Partial<ParcelThematicMetrics>): ParcelThematicMetrics => ({ ...base, ...patch });

// Bộ lọc rỗng: mọi thửa khớp, kể cả chưa có số liệu
assert.equal(hasActivePrecisionFilter({}), false);
assert.equal(matchesPrecisionFilter(undefined, {}), true);
assert.equal(matchesPrecisionFilter(base, { foundationBuckets: [], braLevels: [], basementMode: 'ALL' }), true);

// Đang lọc mà thửa chưa có hồ sơ ⇒ không khớp
assert.equal(matchesPrecisionFilter(undefined, { yearMin: 1980 }), false);

// Khoảng năm: đầu mút bao gồm, null ⇒ loại
assert.equal(matchesPrecisionFilter(base, { yearMin: 1980, yearMax: 2000 }), true);
assert.equal(matchesPrecisionFilter(m({ constructionYear: 2000 }), { yearMin: 1980, yearMax: 2000 }), true);
assert.equal(matchesPrecisionFilter(m({ constructionYear: 2001 }), { yearMin: 1980, yearMax: 2000 }), false);
assert.equal(matchesPrecisionFilter(m({ constructionYear: null }), { yearMax: 2000 }), false);
assert.equal(matchesPrecisionFilter(m({ isYearEstimated: true }), { yearMin: 1980, excludeEstimatedYear: true }), false);
assert.equal(matchesPrecisionFilter(m({ isYearEstimated: true }), { yearMin: 1980 }), true);

// Burland 2–5: cấp 0 không khớp (0 không phải "trống")
assert.equal(matchesPrecisionFilter(base, { burlandMin: 2, burlandMax: 5 }), true);
assert.equal(matchesPrecisionFilter(m({ burlandMaxGrade: 0 }), { burlandMin: 2, burlandMax: 5 }), false);
assert.equal(matchesPrecisionFilter(m({ burlandMaxGrade: 0 }), { burlandMax: 1 }), true);
assert.equal(matchesPrecisionFilter(m({ burlandMaxGrade: null }), { burlandMax: 1 }), false);

// ECS ≥ 11
assert.equal(matchesPrecisionFilter(base, { ecsMin: 11 }), true);
assert.equal(matchesPrecisionFilter(m({ totalEcs: 10 }), { ecsMin: 11 }), false);

// Tầng hầm
assert.equal(matchesPrecisionFilter(base, { basementMode: 'NO_BASEMENT' }), true);
assert.equal(matchesPrecisionFilter(base, { basementMode: 'HAS_BASEMENT' }), false);
assert.equal(matchesPrecisionFilter(m({ basementFloors: null }), { basementMode: 'NO_BASEMENT' }), false);
assert.equal(matchesPrecisionFilter(m({ basementFloors: 2 }), { basementMode: 'HAS_BASEMENT' }), true);

// Tập chọn: OR trong tập, AND giữa tiêu chí
assert.equal(matchesPrecisionFilter(base, { braLevels: ['HIGH', 'VERY_HIGH'] }), true);
assert.equal(matchesPrecisionFilter(base, { braLevels: ['HIGH'], impactCodes: ['I1'] }), false);
assert.equal(matchesPrecisionFilter(m({ braLevel: null }), { braLevels: ['LOW'] }), false);
assert.equal(
  matchesPrecisionFilter(base, { yearMin: 1980, yearMax: 2000, aboveFloorsMin: 3, burlandMin: 2, reportStatuses: ['APPROVED'] }),
  true
);
assert.equal(matchesPrecisionFilter(base, { yearMin: 1980, yearMax: 2000, aboveFloorsMin: 5 }), false);

// VI số thực
assert.equal(matchesPrecisionFilter(base, { viMin: 2.5, viMax: 3.25 }), true);
assert.equal(matchesPrecisionFilter(m({ avgViScore: 3.26 }), { viMin: 2.5, viMax: 3.25 }), false);

// Chip & đếm tiêu chí
const f = { yearMin: 1980, yearMax: 2000, burlandMin: 2, burlandMax: 5, aboveFloorsMin: 4, braLevels: ['HIGH' as const] };
const chips = describeActiveFilterChips(f);
assert.deepEqual(
  chips.map((c) => c.label),
  ['Năm XD: 1980–2000', 'Số tầng nổi: ≥ 4', 'Burland: Cấp 2–5', 'BRA: Cao']
);
assert.equal(countActivePrecisionRules(f), 4);
const cleared = chips[0].clear(f);
assert.equal(cleared.yearMin, null);
assert.equal(cleared.burlandMin, 2);
assert.equal(countActivePrecisionRules(cleared), 3);
// excludeEstimatedYear một mình không phải tiêu chí
assert.equal(countActivePrecisionRules({ excludeEstimatedYear: true }), 0);

// sessionStorage hỏng / lạ
assert.deepEqual(sanitizeStoredFilter(null), {});
assert.deepEqual(sanitizeStoredFilter('xx'), {});
const s = sanitizeStoredFilter({ yearMin: '1990', yearMax: 2000, braLevels: ['HIGH', 'BOGUS', 1], basementMode: 'X', viMin: NaN });
assert.equal(s.yearMin, null);
assert.equal(s.yearMax, 2000);
assert.deepEqual(s.braLevels, ['HIGH']);
assert.equal(s.basementMode, 'ALL');
assert.equal(s.viMin, null);
assert.equal(countActivePrecisionRules(s), 2);

console.log('thematic-filter: OK');
