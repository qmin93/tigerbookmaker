import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        tiger: {
          orange: "#f97316",
          "orange-soft": "#fb923c",
          dark: "#0a0a0a",
          bg: "#fafaf9",
        },
        ink: {
          950: "#050505",
          900: "#0a0a0a",
          850: "#0e0e0e",
          800: "#111111",
          750: "#161616",
          700: "#1a1a1a",
          600: "#262626",
          500: "#3f3f46",
          400: "#71717a",
          300: "#a1a1aa",
          200: "#d4d4d8",
          100: "#f4f4f5",
          50:  "#fafafa",
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', '"Pretendard"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter2: "-0.06em",
      },
      boxShadow: {
        "glow-orange": "0 0 60px -10px rgba(249,115,22,0.45)",
        "glow-orange-sm": "0 0 30px -5px rgba(249,115,22,0.35)",
        "inset-hairline": "inset 0 1px 0 0 rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "radial-orange": "radial-gradient(circle at 50% 0%, rgba(249,115,22,0.18), transparent 60%)",
        "radial-spot":   "radial-gradient(circle at 50% 50%, rgba(249,115,22,0.12), transparent 70%)",
        "grid-faint":    "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-32": "32px 32px",
      },
      keyframes: {
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(249,115,22,0.4)" },
          "50%":      { boxShadow: "0 0 0 12px rgba(249,115,22,0)" },
        },
      },
      animation: {
        "fade-up":    "fade-up 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-in":    "fade-in 1.2s ease-out forwards",
        "scale-glow": "scale-glow 2.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
