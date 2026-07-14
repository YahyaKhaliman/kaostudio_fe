/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        white: '#FAF9F6', // Putih elegan (Warm Alabaster)
        slate: {
          305: '#d3dbe6',
          350: '#abbacb',
          355: '#a6b6c8',
          450: '#7c8ba1',
          455: '#76859b',
          650: '#3d4b5f',
          750: '#253141',
          850: '#151e2e',
          855: '#121a28',
          955: '#080c14',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
