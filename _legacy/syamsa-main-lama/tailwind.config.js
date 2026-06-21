/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./script.js", "./*.js"],
  safelist: [
    "ring-emerald-500",
    "ring-teal-400",
    "ring-blue-500",
    "ring-amber-500",
    "ring-red-500",
    "ring-purple-500",
    "ring-slate-400",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
      },
      colors: {
        brand: {
          50: "#e6f5ff",
          100: "#cceeff",
          500: "#0C81E4", // Vibrant Blue
          600: "#0C4E8C", // Deep Blue
          900: "#062a4d",
        },
        palette: {
          deep: "#0C4E8C",
          blue: "#0C81E4",
          cyan: "#11C4D4",
          mint: "#4FE7AF",
        },
        dark: {
          bg: "#0f172a",
          card: "#1e293b",
          text: "#f1f5f9",
        },
      },
      animation: {
        "slide-up": "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fadeIn 0.3s ease-out",
        blob: "blob 10s infinite alternate",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        blob: {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "100%": { transform: "translate(20px, -20px) scale(1.1)" },
        },
      },
    },
  },
  plugins: [],
};
