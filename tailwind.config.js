
/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        red: '#FF3D4A',
        'red-text': '#FF3D4A',
        yellow: '#F2C94C',
        medium: '#BABEC4',
        low: '#767F8C',
        disabled: '#555555',
        brand: '#2D8DED',
        green: '#00D36C',
        'input-field': '#121314',
        'box-secondary': '#09090A',
        'box-small': '#28292E'
      },
      fontFamily: {
        'line-seed-sans': ['LINESeedJP-Regular'],
        'line-seed-sans-bold': ['LINESeedJP-Bold'],
        geist: ['Geist-Regular'],
        'geist-medium': ['Geist-Medium'],
        'geist-bold': ['Geist-Bold']
      },
      borderColor: {
        'box-small': '#28292E',
        low: '#767F8C',
        'input-field': '#121314'
      },
      backgroundColor: {
        'box-secondary': '#09090A'
      }
    }
  },
  plugins: []
}
