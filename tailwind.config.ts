import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette — matte, warm dark, underground
        strava: "#c8956c",    // dusty terracotta (replaces bright orange)
        dark:   "#0c0b0a",    // near-black warm
        card:   "#1a1715",    // dark surface
        secondary: "#262220", // slightly raised

        // Accent palette
        sage:   "#8daa89",    // dusty sage green
        mauve:  "#a89098",    // dusty mauve
        slate:  "#7898a8",    // dusty blue-slate
        cream:  "#e4ddd8",    // warm off-white
        muted:  "#6a6460",    // muted text
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
