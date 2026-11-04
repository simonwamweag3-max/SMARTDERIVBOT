import type { Config } from "tailwindcss";
const config: Config = { content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { mint: "#32d6a0", panel: "#0d1725", line: "#1d2b3d" } } }, plugins: [] };
export default config;