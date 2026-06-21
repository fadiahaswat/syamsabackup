/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./*.js",
    "./core/**/*.js",
    "./managers/**/*.js",
    "./tahfizh/**/*.js",
  ],
  safelist: [
    "ring-emerald-500",
    "ring-blue-500",
    "ring-amber-500",
    "ring-red-500",
    "ring-purple-500",
    "ring-cyan-500",
    "ring-slate-400",
    {
      pattern: /^(bg|text|border|ring)-(syamsa|status)-(deep|blue|cyan|mint|background|card|muted|border|foreground|muted-foreground|hadir|telat|sakit|izin|pulang|alpa|tidak|ya)$/,
    },
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "sans-serif"],
        mono: ['"DM Mono"', "monospace"],
        rubik: ["Rubik", "sans-serif"],
      },
      colors: {
        syamsa: {
          deep: "#0C4E8C",
          blue: "#0C81E4",
          cyan: "#17C3D4",
          mint: "#4FE7AF",
          background: "#F8FAFC",
          card: "#FFFFFF",
          muted: "#F1F5F9",
          border: "rgba(148, 163, 184, 0.22)",
          foreground: "#0C1F3D",
          "muted-foreground": "#5B7099",
        },
        status: {
          hadir: "#10B981",
          telat: "#17C3D4",
          sakit: "#F59E0B",
          izin: "#3B82F6",
          pulang: "#A855F7",
          alpa: "#EF4444",
          tidak: "#64748B",
          ya: "#10B981",
        },
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
          cyan: "#17C3D4",
          mint: "#4FE7AF",
        },
        dark: {
          bg: "#0f172a",
          card: "#1e293b",
          text: "#f1f5f9",
        },
      },
      /* ============================================================
         MOTION SYSTEM — SYAMSA DESIGN SYSTEM v1.0.0
         Duration tokens following CSS custom properties
         ============================================================ */
      transitionDuration: {
        // Motion tokens
        'micro': '100ms',
        'fast': '150ms',
        'standard': '200ms',
        'comfortable': '250ms',
        'large': '300ms',
        'page': '350ms',
        'emphasis': '400ms',
        'celebration': '600ms',
      },
      transitionTimingFunction: {
        // Easing tokens
        'standard': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'enter': 'cubic-bezier(0, 0, 0.2, 1)',
        'exit': 'cubic-bezier(0.4, 0, 1, 1)',
        'emphasized': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'decelerate': 'cubic-bezier(0, 0, 0.2, 1)',
        'accelerate': 'cubic-bezier(0.4, 0, 1, 1)',
      },
      animation: {
        // Updated to use motion tokens
        "slide-up": "slideUp 250ms cubic-bezier(0, 0, 0.2, 1)",
        "fade-in": "fadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1)",
        blob: "blob 10s infinite alternate",
        "spin-slow": "spin 3s linear infinite",
        // Toast animations
        "toast-enter": "toastEnter 250ms cubic-bezier(0, 0, 0.2, 1) forwards",
        "toast-exit": "toastExit 200ms cubic-bezier(0.4, 0, 1, 1) forwards",
        // View transitions
        "view-enter": "viewEnter 350ms cubic-bezier(0, 0, 0.2, 1) forwards",
        "view-exit": "viewExit 200ms cubic-bezier(0.4, 0, 1, 1) forwards",
        // Success/Error
        "success-pop": "successPop 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "error-shake": "errorShake 300ms ease-in-out",
        // List items
        "item-insert": "itemInsert 300ms cubic-bezier(0, 0, 0.2, 1) forwards",
        "item-delete": "itemDelete 200ms cubic-bezier(0.4, 0, 1, 1) forwards",
        // Skeleton
        skeleton: "skeleton-wave 1.5s ease-in-out infinite",
        // Spinner
        spinner: "spin 0.8s linear infinite",
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
        // Toast animations
        toastEnter: {
          from: { opacity: 0, transform: "translateY(-20px) scale(0.95)" },
          to: { opacity: 1, transform: "translateY(0) scale(1)" },
        },
        toastExit: {
          from: { opacity: 1, transform: "translateY(0) scale(1)" },
          to: { opacity: 0, transform: "translateY(-20px) scale(0.95)" },
        },
        // View transitions
        viewEnter: {
          from: { opacity: 0, transform: "translateX(24px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        viewExit: {
          to: { opacity: 0, transform: "translateX(-16px)" },
        },
        // Success animation
        successPop: {
          "0%": { transform: "scale(0.8)", opacity: 0 },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        // Error shake
        errorShake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-4px)" },
          "40%, 80%": { transform: "translateX(4px)" },
        },
        // List item animations
        itemInsert: {
          from: { opacity: 0, transform: "translateY(-16px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        itemDelete: {
          to: { opacity: 0, transform: "translateY(-8px)" },
        },
        // Skeleton wave
        skeletonWave: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
    },
  },
  plugins: [],
};
