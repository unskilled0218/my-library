import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172019',
        paper: '#f4f0e5',
        moss: '#3f6247',
        rust: '#b65332',
        gold: '#d8a63f',
      },
      boxShadow: {
        card: '0 18px 50px rgba(23, 32, 25, 0.11)',
      },
    },
  },
  plugins: [],
} satisfies Config
