/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"DM Serif Display"', "serif"],
        mono: ['"DM Mono"', "monospace"],
        sans: ["Syne", "sans-serif"],
      },
      colors: {
        bg: "#0d0e12",
        surface: "#13141a",
        surface2: "#1e2029",
        border: "#22252f",
        border2: "#2a2d38",
        accent: "#f0c040",
        danger: "#e05a3a",
        ok: "#4ec9a0",
        muted: "#7a7f94",
        text: "#e8eaf0",
        textSoft: "#c8cad4",
      },
    },
  },
  plugins: [],
};
