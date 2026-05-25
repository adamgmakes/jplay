/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        jblue: '#060CE9',
        jblueDark: '#04099B',
        jblueDeep: '#02044A',
        jgold: '#FFCC00',
        jchrome: '#0A0A2E',
        jgreen: '#27AE60',
        jred: '#C0392B',
      },
      fontFamily: {
        jeopardy: ['"Anton"', '"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
