import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import path from 'path';
import fs from 'fs';

// Plugin to copy prompt templates to build directory
function copyPromptsPlugin() {
  return {
    name: 'copy-prompts',
    closeBundle() {
      const src = path.resolve(__dirname, 'src/main/engine/prompts');
      const dest = path.resolve(__dirname, 'dist-electron/main/prompts');
      
      // Copy directory recursively
      if (fs.existsSync(src)) {
        fs.mkdirSync(dest, { recursive: true });
        copyRecursive(src, dest);
        console.log('✓ Copied prompt templates to dist-electron/main/prompts');
      }
    }
  };
}

function copyRecursive(src: string, dest: string) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['electron']
            }
          },
          plugins: [copyPromptsPlugin()]
        }
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ]),
    electronRenderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist'
  }
});
