import type { Config } from "tailwindcss";

const rgb = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        md: "2rem",
        lg: "2.5rem",
        xl: "3rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1200px",
        "2xl": "1320px",
      },
    },
    extend: {
      colors: {
        forest: {
          50: rgb("--forest-50"),
          100: rgb("--forest-100"),
          200: rgb("--forest-200"),
          300: rgb("--forest-300"),
          400: rgb("--forest-400"),
          500: rgb("--forest-500"),
          600: rgb("--forest-600"),
          700: rgb("--forest-700"),
          800: rgb("--forest-800"),
          900: rgb("--forest-900"),
          950: rgb("--forest-950"),
        },
        sun: {
          50: rgb("--sun-50"),
          100: rgb("--sun-100"),
          200: rgb("--sun-200"),
          300: rgb("--sun-300"),
          400: rgb("--sun-400"),
          500: rgb("--sun-500"),
          600: rgb("--sun-600"),
        },
        wave: {
          400: rgb("--wave-400"),
          500: rgb("--wave-500"),
          600: rgb("--wave-600"),
        },
        cream: {
          DEFAULT: rgb("--page"),
          50: rgb("--page"),
          100: rgb("--surface"),
          200: rgb("--surface-2"),
        },
        ink: {
          DEFAULT: rgb("--ink"),
          muted: rgb("--ink-muted"),
          subtle: rgb("--ink-subtle"),
        },
        border: {
          soft: rgb("--border-soft"),
          DEFAULT: rgb("--border"),
        },
        page: rgb("--page"),
        card: rgb("--card"),
        surface: {
          DEFAULT: rgb("--surface"),
          2: rgb("--surface-2"),
        },
        inverse: rgb("--inverse-fg"),
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        /* Italianno — single-weight script for the "Luxury" accent on
           hero titles. Used as `font-script italicianno` in components. */
        script: ["var(--font-italianno)", "cursive"],
      },
      fontSize: {
        base: ["1.0625rem", { lineHeight: "1.55" }],
        sm: ["0.9375rem", { lineHeight: "1.5" }],
        lg: ["1.1875rem", { lineHeight: "1.5" }],
        xl: ["1.375rem", { lineHeight: "1.4" }],
        "2xl": ["1.6875rem", { lineHeight: "1.3" }],
        "3xl": ["2.125rem", { lineHeight: "1.2" }],
        "4xl": ["2.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "5xl": ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "6xl": ["4.5rem", { lineHeight: "1.0", letterSpacing: "-0.03em" }],
        "7xl": ["5.5rem", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
      },
      borderRadius: {
        pill: "9999px",
        xl: "var(--radius-md)",
        "2xl": "var(--radius-md)",
        "3xl": "var(--radius-card)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        lift: "var(--shadow-lift)",
        glass: "var(--shadow-glass)",
        "glass-lg": "var(--shadow-glass)",
        "glass-tint": "var(--shadow-glass)",
        glow: "var(--shadow-glow)",
      },
      backgroundImage: {
        "hero-gradient": "var(--hero-wash)",
        "nav-gradient":
          "linear-gradient(180deg, rgb(var(--card) / 0.85) 0%, rgb(var(--card) / 0.6) 100%)",
        "card-glass": "var(--glass-bg)",
        "glass-light":
          "linear-gradient(180deg, rgb(255 255 255 / 0.45) 0%, rgb(255 255 255 / 0.15) 35%, rgb(255 255 255 / 0) 100%)",
        "glass-tint-forest":
          "linear-gradient(135deg, rgb(255 255 255 / 0.35) 0%, rgb(var(--forest-50) / 0.35) 100%)",
        "glass-tint-sun":
          "linear-gradient(135deg, rgb(255 255 255 / 0.35) 0%, rgb(var(--sun-50) / 0.4) 100%)",
        "liquid-sheen":
          "linear-gradient(105deg, transparent 30%, rgb(255 255 255 / 0.4) 50%, transparent 70%)",
      },
      backdropBlur: {
        xs: "4px",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "spring-smooth": "cubic-bezier(0.22, 1, 0.36, 1)",
        "spring-bounce": "cubic-bezier(0.68, -0.55, 0.27, 1.55)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "liquid-sheen": {
          "0%": { transform: "translateX(-150%) skewX(-12deg)" },
          "60%": { transform: "translateX(150%) skewX(-12deg)" },
          "100%": { transform: "translateX(150%) skewX(-12deg)" },
        },
        "liquid-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "spring-press": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(0.94)" },
          "100%": { transform: "scale(1)" },
        },
        "glow-drift": {
          "0%, 100%": { opacity: "0.5", transform: "translate(0, 0) scale(1)" },
          "33%": { opacity: "0.8", transform: "translate(20px, -10px) scale(1.05)" },
          "66%": { opacity: "0.6", transform: "translate(-15px, 15px) scale(0.95)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.5s ease-out both",
        "scale-in": "scale-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 2s linear infinite",
        "liquid-sheen": "liquid-sheen 5s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        "liquid-float": "liquid-float 6s ease-in-out infinite",
        "spring-press": "spring-press 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "glow-drift": "glow-drift 12s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
