import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        nb: {
          black:  '#0A0A0A',
          bg:     '#FEFAE0',
          paper:  '#FFFFFF',
          yellow: '#FFE53D',
          pink:   '#FF6B9D',
          cyan:   '#5BC0EB',
          lime:   '#A6E22E',
          orange: '#FF8C42',
          purple: '#B388EB',
          red:    '#FF5252',
          gray:   '#9CA3AF',
        },
      },
      boxShadow: {
        'nb':    '6px 6px 0 0 #0A0A0A',
        'nb-sm': '4px 4px 0 0 #0A0A0A',
        'nb-lg': '8px 8px 0 0 #0A0A0A',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        screen: '1920px',
      },
    },
  },
  plugins: [],
};

export default config;
