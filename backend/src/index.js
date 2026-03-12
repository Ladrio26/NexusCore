import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import 'dotenv/config';
import { buildApp } from './app.js';

const PORT = Number(process.env.PORT || 3000);
function parsePortFallbacks(rawValue) {
  return String(rawValue || '')
    .split(',')
    .flatMap((chunk) => {
      const value = chunk.trim();
      if (!value) return [];
      const rangeMatch = value.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = Number(rangeMatch[2]);
        if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
          return [];
        }
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
      }
      const port = Number(value);
      return Number.isInteger(port) && port > 0 ? [port] : [];
    });
}

const FALLBACK_PORTS = parsePortFallbacks(process.env.PORT_FALLBACKS || '');
const PORT_CANDIDATES = [...new Set([PORT, ...FALLBACK_PORTS])];
const RUNTIME_DIR = path.resolve(process.cwd(), '..', '.runtime');
const RUNTIME_FILE = path.join(RUNTIME_DIR, 'backend-port.json');

async function writeRuntimePort(port) {
  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(
    RUNTIME_FILE,
    JSON.stringify(
      {
        port,
        apiTarget: `http://127.0.0.1:${port}`
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

async function startServer() {
  const fastify = await buildApp();

  try {
    for (const candidate of PORT_CANDIDATES) {
      try {
        if (candidate !== PORT) {
          fastify.log.warn(`Port ${PORT} occupé, tentative sur ${candidate}...`);
        }
        await fastify.listen({ port: candidate, host: '0.0.0.0' });
        await writeRuntimePort(candidate);
        fastify.log.info(`Nexus Core Arena backend listening on ${candidate}`);
        return;
      } catch (err) {
        if (err?.code !== 'EADDRINUSE' || candidate === PORT_CANDIDATES.at(-1)) {
          throw err;
        }
      }
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

startServer();

