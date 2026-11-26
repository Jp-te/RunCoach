/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.4)', opacity: '0' }, '60%': { transform: 'scale(1.15)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        floatUp: { '0%': { transform: 'translate(-50%, 12px)', opacity: '0' }, '15%': { transform: 'translate(-50%, 0)', opacity: '1' }, '80%': { transform: 'translate(-50%, -8px)', opacity: '1' }, '100%': { transform: 'translate(-50%, -24px)', opacity: '0' } },
        glow: { '0%,100%': { boxShadow: '0 0 0 0 rgba(249,115,22,.55)' }, '50%': { boxShadow: '0 0 0 14px rgba(249,115,22,0)' } },
        bounceY: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        wiggle: { '0%,100%': { transform: 'rotate(-6deg)' }, '50%': { transform: 'rotate(6deg)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        flame: { '0%,100%': { transform: 'scale(1) rotate(-3deg)' }, '50%': { transform: 'scale(1.12) rotate(3deg)' } },
      },
      animation: {
        pop: 'pop .5s cubic-bezier(.2,.9,.3,1.2) both',
        floatUp: 'floatUp 2.4s ease-out both',
        glow: 'glow 1.8s ease-out infinite',
        bounceY: 'bounceY 1.1s ease-in-out infinite',
        wiggle: 'wiggle .9s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        flame: 'flame 1.2s ease-in-out infinite',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)',
      },
    },
  },
  plugins: [],
};
