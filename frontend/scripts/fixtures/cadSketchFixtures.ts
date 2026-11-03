/**
 * Bộ sinh ảnh phác thảo tổng hợp cho test CAD Lab. Chỉ dùng trong scripts, không đóng gói vào app.
 */

export interface SketchImage {
  width: number;
  height: number;
  gray: Uint8Array;
}

export function blankSketch(width: number, height: number, paper = 235): SketchImage {
  const gray = new Uint8Array(width * height);
  // Bóng giấy: góc dưới phải tối dần như ảnh chụp điện thoại
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shade = Math.round(60 * (x / width) * (y / height));
      gray[y * width + x] = paper - shade;
    }
  }
  return { width, height, gray };
}

/** Nét bút dày `thickness`, mực tối hơn nền khoảng 120. */
export function drawLine(
  img: SketchImage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thickness = 3
): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(len * 2));
  const r = thickness / 2;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x1 + (x2 - x1) * t;
    const cy = y1 + (y2 - y1) * t;
    for (let dy = Math.floor(-r); dy <= Math.ceil(r); dy++) {
      for (let dx = Math.floor(-r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy > r * r + 0.25) continue;
        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
        const idx = y * img.width + x;
        img.gray[idx] = Math.min(img.gray[idx], 70);
      }
    }
  }
}

/** Đường gấp khúc kín qua các đỉnh. */
export function drawPolygon(img: SketchImage, pts: [number, number][], thickness = 3): void {
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    drawLine(img, x1, y1, x2, y2, thickness);
  }
}

/** Ô cột tô kín. */
export function fillRect(img: SketchImage, x: number, y: number, w: number, h: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      img.gray[yy * img.width + xx] = 70;
    }
  }
}

/** Mô phỏng chữ "20x20": vài nét cong và chéo ngắn sát nhau. */
export function drawPseudoText(img: SketchImage, x: number, y: number, size = 14): void {
  const s = size;
  // "2"
  drawLine(img, x, y, x + s * 0.6, y, 2);
  drawLine(img, x + s * 0.6, y, x + s * 0.6, y + s * 0.5, 2);
  drawLine(img, x + s * 0.6, y + s * 0.5, x, y + s, 2);
  drawLine(img, x, y + s, x + s * 0.6, y + s, 2);
  // "0"
  const ox = x + s * 0.9;
  drawPolygon(img, [[ox, y], [ox + s * 0.6, y], [ox + s * 0.6, y + s], [ox, y + s]], 2);
  // "x"
  const xx = x + s * 1.8;
  drawLine(img, xx, y + s * 0.4, xx + s * 0.5, y + s, 2);
  drawLine(img, xx + s * 0.5, y + s * 0.4, xx, y + s, 2);
}
