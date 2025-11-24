import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          // Fix: `__dirname` is not available in ES modules. Replaced with `process.cwd()` to get the project root directory.
          // Fix: `process.cwd()` was causing a TypeScript type error. Using an ESM-compatible `__dirname` as a reliable alternative.
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
