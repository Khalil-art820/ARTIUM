/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // The landing page's own palette — light, editorial, champagne metal —
      // named for what each token is used for on that page rather than the
      // hex itself, since "gold" and "champagne" are two different golds and
      // get confused if only one is named.
      colors: {
        gold: "#C49339",
        champagne: "#E5C47B",
        "gold-pale": "#F3E8D0",
        ink: "#111923",
        muted: "#687078",
        border: "#EEE7DA",
        "warm-white": "#FFFDF9",
        card: "#FFFFFF",
      },
    },
  },
  plugins: [],
};
