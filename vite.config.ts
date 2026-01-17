
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file based on current mode
    const env = loadEnv(mode, process.cwd(), '');
    
    // Support multiple naming conventions for the API Key
    const apiKey = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || env.GEMINI_API_KEY || "";

    return {
      base: './', 
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        outDir: 'dist',
        target: 'es2015',
        minify: 'esbuild',
        sourcemap: false
      },
      define: {
        // This injects the key into your frontend code as process.env.API_KEY
        'process.env.API_KEY': JSON.stringify(apiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      }
    };
});
