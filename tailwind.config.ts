import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Semantic theme tokens — resolve to light/dark values via globals.css.
        // bg-surface (cards), bg-base (page), bg-muted (subtle fills),
        // text-strong / text-body / text-soft, border-line.
        surface: "var(--surface)",
        base: "var(--base)",
        muted: "var(--muted)",
        strong: "var(--text-strong)",
        body: "var(--text-body)",
        soft: "var(--text-soft)",
        line: "var(--line)",
      },
    },
  },
  plugins: [],
};
export default config;
