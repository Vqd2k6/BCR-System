import plugin from 'tailwindcss/plugin.js';
import { buildThemeTokens, writeThemeVarsCss } from './theme/themeTokens.js';

// Đồng bộ file theme-vars.css phục vụ Rule §7
writeThemeVarsCss();

/**
 * Token màu theo thuộc tính (bg / text / border) cho Dark Mode toàn cục — xem theme/themeTokens.js.
 * Chế độ Sáng giữ nguyên hex gốc Tailwind; `html.dark` remap qua CSS variables.
 */
const themeTokens = buildThemeTokens();

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  safelist: ['dark', 'force-light'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
      },
      backgroundColor: themeTokens.backgroundColor,
      gradientColorStops: themeTokens.backgroundColor,
      boxShadowColor: themeTokens.backgroundColor,
      textColor: themeTokens.textColor,
      placeholderColor: themeTokens.textColor,
      fill: themeTokens.textColor,
      stroke: themeTokens.textColor,
      borderColor: themeTokens.borderColor,
      divideColor: themeTokens.borderColor,
      ringColor: themeTokens.borderColor,
      outlineColor: themeTokens.borderColor,
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ':root': themeTokens.lightVars,
        '.dark': themeTokens.darkVars,
        '.dark .force-light, .force-light': { ...themeTokens.lightVars, colorScheme: 'light' },
      });
    }),
  ],
};
