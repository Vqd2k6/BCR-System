import L from 'leaflet';

/**
 * Custom handle icon for draggable polygon handles
 */
export const createHandleIcon = (num: number) => {
  return L.divIcon({
    className: 'custom-handle-marker',
    html: `<div style="
      width: 22px;
      height: 22px;
      background-color: #f59e0b;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      color: #ffffff;
      font-weight: 800;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
    ">${num}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

/**
 * Interpolation helper between 2 points
 */
export const interpolatePoint = (
  pA: [number, number],
  pB: [number, number],
  ratio: number
): [number, number] => {
  return [
    pA[0] + (pB[0] - pA[0]) * ratio,
    pA[1] + (pB[1] - pA[1]) * ratio,
  ];
};

/**
 * Shoelace area calculation in square meters (spherical projection approx on WGS84)
 */
export const computePolygonAreaM2 = (coords: [number, number][]): number => {
  if (!coords || coords.length < 3) return 0;
  const R = 6378137;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = (coords[i][0] * Math.PI) / 180;
    const lat2 = (coords[j][0] * Math.PI) / 180;
    const dLng = ((coords[j][1] - coords[i][1]) * Math.PI) / 180;
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * R * R) / 2);
  return Math.round(area * 10) / 10;
};
