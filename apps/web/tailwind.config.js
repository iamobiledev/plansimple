/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        plansimple: {
          navy: "#0f172a",
          steel: "#334155",
          blue: "#2563eb",
          sky: "#38bdf8",
          sand: "#f8fafc",
        },
      },
      boxShadow: {
        panel: "0 24px 60px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
