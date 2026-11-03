/**
 * Hợp đồng dữ liệu của CAD Lab: đồ thị đỉnh–cạnh vẽ lại từ ảnh phác thảo tay.
 * Mọi tọa độ tính bằng pixel của ảnh làm việc (đã xoay và thu nhỏ), gốc ở góc trên trái.
 */

export interface CadVertex {
  id: string;
  x: number;
  y: number;
}

/** ORTHO: đã nắn về trục nhà. SLANT: giữ xiên. SLANT_SUSPECT: lệch nhẹ, chờ người dùng chọn. */
export type CadAngleClass = 'ORTHO' | 'SLANT' | 'SLANT_SUSPECT';

/** SINGLE: nét đơn (tường, biên). BEAM_PAIR: một nét của cặp nét đôi dầm. */
export type CadEdgeKind = 'SINGLE' | 'BEAM_PAIR';

export interface CadEdge {
  id: string;
  a: string;
  b: string;
  kind: CadEdgeKind;
  angleClass: CadAngleClass;
  pairId?: string;
  beamWidthPx?: number;
}

export interface CadColumn {
  id: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface CadTextBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  source: 'DETECTED' | 'MANUAL';
}

export interface CadRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CadGraph {
  width: number;
  height: number;
  /** Góc trục chính của nhà so với trục ảnh, độ. Cạnh ORTHO nằm trên trục này. */
  axisAngleDeg: number;
  /** Góc đã xoay cả bản vẽ quanh tâm ảnh; ảnh lót xoay theo để vẫn khớp. */
  underlayRotateDeg: number;
  vertices: CadVertex[];
  edges: CadEdge[];
  columns: CadColumn[];
  textBoxes: CadTextBox[];
}

export interface CadLabParams {
  /** Cửa sổ nhị phân hóa Bradley-Roth, px (số lẻ). */
  thresholdWindowPx: number;
  /** Độ nhạy tách mực, %: điểm tối hơn trung bình cục bộ chừng này thì là mực. */
  thresholdBiasPct: number;
  /** Thành phần mực nhỏ hơn số điểm này bị bỏ như bụi. */
  minComponentPx: number;
  rdpEpsilonPx: number;
  /** Lệch trục không quá ngưỡng này thì ép vuông. */
  orthoToleranceDeg: number;
  /** Cạnh dài lệch trong khoảng (orthoTolerance, slantSuspectMax] được đánh dấu chờ chọn. */
  slantSuspectMaxDeg: number;
  /** Cạnh ngắn hơn thì lệch nhẹ vẫn ép vuông vì gần như chắc chắn là rung tay. */
  longEdgePx: number;
  weldRadiusPx: number;
  beamGapMinPx: number;
  beamGapMaxPx: number;
  /** Tỉ lệ mực trong lòng ô giao hai dầm nét đôi để coi là cột gạch chéo, 0..1. */
  columnDensity: number;
  /** Nét thẳng đứng riêng dài hơn ngưỡng này được giữ là nét vẽ, ngắn hơn coi là chữ. */
  strokeMinLengthPx: number;
  /** Vùng người dùng khoanh để xóa nét (chữ dính vào khung). */
  eraseRects: CadRect[];
}

export interface CadLabStats {
  vertexCount: number;
  edgeCount: number;
  beamPairCount: number;
  columnCount: number;
  slantCount: number;
  slantSuspectCount: number;
  textCandidateCount: number;
  computeTimeMs: number;
}

export interface CadLabResult {
  graph: CadGraph;
  stats: CadLabStats;
}

export interface CadLabWorkerRequest {
  type: 'VECTORIZE';
  requestId: number;
  width: number;
  height: number;
  grayBuffer: ArrayBuffer;
  params: CadLabParams;
}

export type CadLabWorkerResponse =
  | { type: 'VECTORIZE_SUCCESS'; requestId: number; result: CadLabResult }
  | { type: 'WORKER_ERROR'; requestId: number; errorMessage: string };

/** Loại bản vẽ CAD lấy từ dự án. */
export type CadProjectSketchType = 'CAD_ARCH' | 'CAD_STRUCT' | 'CAD_BLUEPRINT';

export interface CadProjectSketch {
  url: string;
  cadType: CadProjectSketchType;
  parcelCode: string;
  floorName: string;
  zoneId: string | null;
  reportStatus: string | null;
}

export interface CadProjectSketchPage {
  total: number;
  items: CadProjectSketch[];
}
