export default {
  content: ["./index.html","./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: { primary: "#4a9b8e", text: "#333333", sub: "#666666", bg: "#f5f5f5" },
      boxShadow: { soft: "0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)" },
    },
  },
  plugins: [],
}
