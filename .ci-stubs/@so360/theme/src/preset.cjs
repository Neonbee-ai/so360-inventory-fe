/**
 * SO360 Tailwind preset — redefines slate + gray to read from CSS variables.
 * This is the single change that makes light/dark switching work for the entire
 * platform without touching any component className strings.
 *
 * Usage in tailwind.config.js:
 *   const themePreset = require('@so360/theme/preset')  // CJS
 *   import themePreset from './packages/theme/src/preset.cjs'  // ESM shell
 *   export default { presets: [themePreset], ... }
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Slate scale — backed by CSS variables so the whole scale flips when
        // .light is added to <html>. The <alpha-value> placeholder preserves
        // opacity utilities like bg-slate-900/50.
        slate: {
          50:  'rgb(var(--s-50)  / <alpha-value>)',
          100: 'rgb(var(--s-100) / <alpha-value>)',
          200: 'rgb(var(--s-200) / <alpha-value>)',
          300: 'rgb(var(--s-300) / <alpha-value>)',
          400: 'rgb(var(--s-400) / <alpha-value>)',
          500: 'rgb(var(--s-500) / <alpha-value>)',
          600: 'rgb(var(--s-600) / <alpha-value>)',
          700: 'rgb(var(--s-700) / <alpha-value>)',
          800: 'rgb(var(--s-800) / <alpha-value>)',
          900: 'rgb(var(--s-900) / <alpha-value>)',
          950: 'rgb(var(--s-950) / <alpha-value>)',
        },
        // Gray scale — used in ~7 repos
        gray: {
          50:  'rgb(var(--g-50)  / <alpha-value>)',
          100: 'rgb(var(--g-100) / <alpha-value>)',
          200: 'rgb(var(--g-200) / <alpha-value>)',
          300: 'rgb(var(--g-300) / <alpha-value>)',
          400: 'rgb(var(--g-400) / <alpha-value>)',
          500: 'rgb(var(--g-500) / <alpha-value>)',
          600: 'rgb(var(--g-600) / <alpha-value>)',
          700: 'rgb(var(--g-700) / <alpha-value>)',
          800: 'rgb(var(--g-800) / <alpha-value>)',
          900: 'rgb(var(--g-900) / <alpha-value>)',
          950: 'rgb(var(--g-950) / <alpha-value>)',
        },
      },
    },
  },
};
