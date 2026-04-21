import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('xlsx')) return 'vendor-xlsx';
          if (id.includes('@supabase') || id.includes('supabase')) return 'vendor-supabase';
          if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('date-fns')) return 'vendor-date-fns';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('react-dom')) return 'vendor-react-dom';
          if (id.includes('/react/')) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
}));
