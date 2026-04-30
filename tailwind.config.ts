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
        // Brand AGK
        bg: {
          DEFAULT: "#0a0a0a",
          surface: "#141414",
          elevated: "#1c1c1c",
          input: "#0f0f0f",
        },
        border: {
          DEFAULT: "#262626",
          strong: "#3a3a3a",
        },
        text: {
          DEFAULT: "#f5f5f5",
          muted: "#a3a3a3",
          dim: "#737373",
        },
        accent: {
          DEFAULT: "#5dceaa",
          hover: "#4dbf99",
          dim: "#3d8c75",
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
