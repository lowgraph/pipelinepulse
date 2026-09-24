import { defineConfig } from 'vite';
import vinext from 'vinext';
import { cloudflare } from '@cloudflare/vite-plugin';
import { copyFileSync, mkdirSync } from 'node:fs';

process.env.NEXT_PUBLIC_BASE_PATH = '/pipeline';

export default defineConfig({
  plugins: [vinext(), cloudflare({ viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] } }), {
    name: 'pipeline-public-assets',
    closeBundle() {
      mkdirSync('dist/client/pipeline', { recursive: true });
      copyFileSync('public/favicon.svg', 'dist/client/pipeline/favicon.svg');
    },
  }],
});
