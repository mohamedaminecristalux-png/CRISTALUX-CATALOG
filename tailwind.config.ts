import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "#080808",
        gold: {
          DEFAULT: "#c5a059",
          dark: "#b8860b",
          soft: "#e8d0a3",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        serif: ["var(--font-crimson-pro)", "serif"],
        ui: ["var(--font-public-sans)", "sans-serif"],
      },
      letterSpacing: {
        ultra: "0.3em",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.19, 1, 0.22, 1)",
      },
      keyframes: {
        revealUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        revealUp: "revealUp 1.2s cubic-bezier(0.19, 1, 0.22, 1) forwards",
      },
    },
  },
  plugins: [],
};

export default config;
