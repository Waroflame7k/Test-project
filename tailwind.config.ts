import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef5ff",
          100: "#d9e8ff",
          600: "#0a4ba8",
          700: "#073b84",
          800: "#042b63",
          900: "#022255"
        },
        action: {
          500: "#ff6a00",
          600: "#e85f00"
        }
      },
      boxShadow: {
        soft: "0 10px 28px rgba(2, 34, 85, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
