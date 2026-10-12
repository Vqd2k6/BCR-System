/**
 * METRO 2 BCS — Hệ Token Màu Theo Thuộc Tính (Property-aware Theme Tokens)
 * ---------------------------------------------------------------------------
 * Nguồn chân lý duy nhất cho Dark Mode toàn cục (Rule §7).
 *
 * Ý tưởng: Tailwind cho phép cấu hình riêng `backgroundColor`, `textColor`,
 * `borderColor`. Ta chỉ remap những sắc độ "dành cho nền sáng" của từng thuộc tính
 * sang CSS variable; các sắc độ vốn dành cho nền tối (VD: `bg-slate-900`,
 * `text-white`, badge `bg-amber-950 text-amber-300`) được giữ nguyên hex tĩnh.
 *
 * - Chế độ Sáng: mỗi biến = đúng hex gốc Tailwind  →  giao diện giống hệt từng pixel.
 * - Chế độ Tối (`html.dark`): biến nhận giá trị tối theo quy tắc bên dưới.
 * - `.force-light`: đặt lại biến về giá trị sáng cho vùng "giấy kỹ thuật".
 *
 * Tên biến: `--{bg|text|border}-{palette}-{shade}` và `--{bg|border}-white`,
 * giá trị dạng kênh "r g b" để dùng `rgb(var(--bg-slate-50) / <alpha-value>)`.
 */
import fs from 'node:fs';
import colors from 'tailwindcss/colors.js';

const PALETTES = [
  'slate', 'amber', 'emerald', 'indigo', 'sky', 'red', 'teal', 'purple', 'rose',
  'blue', 'orange', 'violet', 'cyan', 'green', 'yellow', 'lime', 'pink', 'fuchsia',
];

/** Nền thẻ ở chế độ tối — dùng làm nền pha cho các tint accent. */
const DARK_SURFACE = '#0f172a';

/** Quy tắc cho thang trung tính (slate + white). */
const NEUTRAL_RULES = {
  bg: {
    white: '#0f172a',
    50: '#0b1222',
    100: '#1e293b',
    200: '#263247',
    300: '#334155',
    400: '#475569',
  },
  text: {
    500: '#94a3b8',
    600: '#a3b1c4',
    700: '#cbd5e1',
    800: '#e2e8f0',
    900: '#f1f5f9',
    950: '#f8fafc',
  },
  border: {
    white: '#1e293b',
    50: '#1e293b',
    100: '#1e293b',
    200: '#2b3a52',
    300: '#3b4a61',
    400: '#4b5b73',
  },
};

/** Quy tắc cho các bảng màu accent (amber, emerald, sky...). */
const ACCENT_RULES = {
  bg: (p) => ({
    50: mix(p[500], DARK_SURFACE, 0.12),
    100: mix(p[500], DARK_SURFACE, 0.18),
    200: mix(p[500], DARK_SURFACE, 0.28),
  }),
  text: (p) => ({
    600: p[400],
    700: p[300],
    800: p[200],
    900: p[100],
    950: p[50],
  }),
  border: (p) => ({
    100: mix(p[500], DARK_SURFACE, 0.25),
    200: mix(p[500], DARK_SURFACE, 0.35),
    300: mix(p[500], DARK_SURFACE, 0.45),
  }),
};

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** Pha màu `fg` lên nền `bg` với tỉ lệ `ratio` (0..1). */
function mix(fg, bg, ratio) {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  return rgbToHex(a.map((v, i) => v * ratio + b[i] * (1 - ratio)));
}

function channels(hex) {
  return hexToRgb(hex).join(' ');
}

/**
 * Sinh token Tailwind theo thuộc tính + 2 bộ CSS variables (sáng / tối).
 * @returns {{
 *   backgroundColor: Record<string, unknown>,
 *   textColor: Record<string, unknown>,
 *   borderColor: Record<string, unknown>,
 *   lightVars: Record<string, string>,
 *   darkVars: Record<string, string>,
 *   varIndex: Record<string, Record<string, string>>
 * }}
 */
export function buildThemeTokens() {
  const lightVars = {};
  const darkVars = {};
  /** varIndex[prop][lightHex] = tên biến — dùng cho codemod inline style. */
  const varIndex = { bg: {}, text: {}, border: {} };
  const out = { bg: {}, text: {}, border: {} };

  const register = (prop, key, lightHex, darkHex) => {
    const name = `--${prop}-${key}`;
    lightVars[name] = channels(lightHex);
    darkVars[name] = channels(darkHex);
    varIndex[prop][rgbToHex(hexToRgb(lightHex))] = name;
    return `rgb(var(${name}) / <alpha-value>)`;
  };

  for (const prop of ['bg', 'text', 'border']) {
    // white
    const whiteDark = NEUTRAL_RULES[prop].white;
    if (whiteDark) out[prop].white = register(prop, 'white', colors.white, whiteDark);

    for (const palette of PALETTES) {
      const scale = colors[palette];
      const rules = palette === 'slate' ? NEUTRAL_RULES[prop] : ACCENT_RULES[prop](scale);
      const mapped = {};
      let touched = false;
      for (const [shade, lightHex] of Object.entries(scale)) {
        const darkHex = rules[shade];
        if (darkHex) {
          mapped[shade] = register(prop, `${palette}-${shade}`, lightHex, darkHex);
          touched = true;
        }
      }
      if (touched) out[prop][palette] = mapped;
    }
  }

  return {
    backgroundColor: out.bg,
    textColor: out.text,
    borderColor: out.border,
    lightVars,
    darkVars,
    varIndex,
  };
}

export function writeThemeVarsCss() {
  try {
    const { lightVars, darkVars } = buildThemeTokens();
    const toLines = (obj) => Object.entries(obj).map(([k, v]) => `  ${k}: ${v};`).join('\n');
    const css = `/* 
 * METRO 2 BCS — CSS Theme Variables (Rule §7)
 * Tu dong sinh tu theme/themeTokens.js — KHONG SUA TRUC TIEP FILE NAY
 */
:root {
${toLines(lightVars)}
}

html.dark,
.dark {
${toLines(darkVars)}
}

.force-light,
html.dark .force-light,
.dark .force-light {
  color-scheme: light;
${toLines(lightVars)}
}
`;
    const outPath = new URL('../src/styles/theme-vars.css', import.meta.url);
    fs.writeFileSync(outPath, css, 'utf8');
  } catch (err) {
    console.error('[ThemeTokens] writeThemeVarsCss failed:', err);
  }
}
