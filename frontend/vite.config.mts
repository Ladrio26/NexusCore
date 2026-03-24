import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/** Écrit `dist/build-id.json` à chaque build — utilisé par le SPA pour proposer une mise à jour sans reload forcé. */
function buildIdPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'nexus-write-build-id',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const buildId =
        process.env.BUILD_ID?.trim()
        || process.env.CI_COMMIT_SHORT_SHA?.trim()
        || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const dir = path.isAbsolute(outDir) ? outDir : path.resolve(__dirname, outDir);
      const file = path.join(dir, 'build-id.json');
      fs.writeFileSync(file, `${JSON.stringify({ buildId })}\n`, 'utf8');
    }
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveApiTarget() {
  const explicitTarget = process.env.VITE_API_TARGET?.trim();
  if (explicitTarget && explicitTarget.toLowerCase() !== 'auto') {
    return explicitTarget;
  }

  const runtimeFile = path.resolve(__dirname, '../.runtime/backend-port.json');
  try {
    const runtime = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    const port = Number(runtime?.port);
    if (Number.isInteger(port) && port > 0) {
      return `http://127.0.0.1:${port}`;
    }
  } catch {}

  return 'http://127.0.0.1:3000';
}

const apiTarget = resolveApiTarget();
const vitePort = Number(process.env.VITE_PORT || 5173);
const allowedHosts = [
  'localhost',
  '127.0.0.1',
  'nexuscore.goodloss.fr',
  ...(process.env.VITE_ALLOWED_HOSTS
    ? process.env.VITE_ALLOWED_HOSTS.split(',').map((host) => host.trim()).filter(Boolean)
    : [])
];
const hmrHost = process.env.VITE_HMR_HOST?.trim();
const hmrPort = Number(process.env.VITE_HMR_PORT || 0);
const hmrProtocol = process.env.VITE_HMR_PROTOCOL?.trim();

export default defineConfig({
  plugins: [vue(), buildIdPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@engine': path.resolve(__dirname, '../core')
    }
  },
  server: {
    fs: {
      allow: ['..']
    },
    port: vitePort,
    host: true,
    allowedHosts,
    ...(hmrHost
      ? {
          hmr: {
            host: hmrHost,
            ...(hmrPort > 0 ? { clientPort: hmrPort } : {}),
            ...(hmrProtocol ? { protocol: hmrProtocol } : {})
          }
        }
      : {}),
    watch: {
      // Le polling reste activable à la demande pour les environnements lents ou virtualisés.
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/.env*',
        '**/*.md',
        '**/package-lock.json',
        '**/pnpm-lock.yaml',
        '**/yarn.lock',
      ],
      // Si CHOKIDAR_USEPOLLING est utilisé, intervalle plus raisonnable (ms)
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
      interval: 1000,
    },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true
      },
      '/personnages': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
});

