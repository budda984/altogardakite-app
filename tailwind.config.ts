import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand AGK - guidati da variabili CSS (tema scuro/chiaro)
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          surface: "rgb(var(--bg-surface) / <alpha-value>)",
          elevated: "rgb(var(--bg-elevated) / <alpha-value>)",
          input: "rgb(var(--bg-input) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        text: {
          DEFAULT: "rgb(var(--text) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
          dim: "rgb(var(--text-dim) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          dim: "rgb(var(--accent-dim) / <alpha-value>)",
        },
        danger: "#ef4444",
        warning: "#f59e0b",
        success: "#22c55e",
      },
      fontFamily: {
        display: ['"Syne"', "ui-sans-serif", "system-ui"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui"],
        mono: ['"JetBrains Mono"', "ui-monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};

export default config;
