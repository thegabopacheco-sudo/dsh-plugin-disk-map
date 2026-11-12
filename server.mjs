#!/usr/bin/env node
// dsh-plugin-disk-map — uso de disco por carpeta/archivo.
// Tools: status, map.

import path from 'node:path';
import os from 'node:os';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

const VERSION = '0.1.0';
const DSH_HOME = (() => {
  const v = process.env.DSH_HOME && process.env.DSH_HOME.trim();
  return v || path.join(process.env.USERPROFILE || process.env.HOME || os.homedir(), '.dsh');
})();
const CONFIG_FILE = path.join(DSH_HOME, 'disk-map', 'config.json');
const CACHE_DIR = path.join(DSH_HOME, 'cache', 'disk-map');
const MAX_FILES = 50000;
const MAX_DEPTH = 6;
const log = (m) => process.stderr.write(`[diskmap] ${m}\n`);

function loadConfig() { try { if (existsSync(CONFIG_FILE)) return { allowedPaths: [], ...(JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) || {}) }; } catch { /* defaults */ } return { allowedPaths: [] }; }
function allowedRoots() { const configured = loadConfig().allowedPaths; return (Array.isArray(configured) && configured.length ? configured : [process.env.USERPROFILE || process.env.HOME || os.homedir()]).map((item) => path.resolve(item)); }
function isAllowed(target) { const resolved = path.resolve(target); return resolved === CACHE_DIR || resolved.startsWith(CACHE_DIR + path.sep) || allowedRoots().some((root) => resolved === root || resolved.startsWith(root + path.sep)); }
function fmt(bytes) { if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`; if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`; return `${bytes} B`; }
function dirSize(dir, depth, stats) {
  let total = 0;
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const entry of entries) {
    if (stats.files >= MAX_FILES) break;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (depth < MAX_DEPTH) total += dirSize(full, depth + 1, stats); continue; }
    try { const info = statSync(full); total += info.size; stats.files++; stats.total += info.size; } catch { /* ignora */ }
  }
  return total;
}
function mapDisk(rootInner, depth, top) {
  const root = path.resolve(rootInner);
  if (!existsSync(root)) throw new Error(`la ruta no existe: ${root}`);
  if (!statSync(root).isDirectory()) throw new Error(`no es un directorio: ${root}`);
  if (!isAllowed(root)) throw new Error(`ruta no permitida (revisa allowedPaths): ${root}`);
  const stats = { files: 0, total: 0 };
  const entries = [];
  for (const entry of (() => { try { return readdirSync(root, { withFileTypes: true }); } catch { return []; } })()) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) { const size = dirSize(full, 1, stats); entries.push({ name: entry.name, type: 'dir', size }); }
    else { try { const info = statSync(full); entries.push({ name: entry.name, type: 'file', size: info.size }); stats.files++; stats.total += info.size; } catch { /* ignora */ } }
  }
  entries.sort((a, b) => b.size - a.size);
  return { root, files: stats.files, total: stats.total, entries: entries.slice(0, top), depth };
}
function textResult(text) { return { content: [{ type: 'text', text }] }; }

function buildInstructions() {
  return [
    'Disk Map: mide el uso de disco por carpeta/archivo.',
    '',
    'Herramientas: status, map.',
    '',
    'Reglas:',
    '- Solo lectura; respeta allowedPaths.',
    '- Profundidad máxima ' + MAX_DEPTH + ' y hasta ' + MAX_FILES + ' archivos por escaneo.',
    '- Reporta tamaños reales; no inventes ahorros.',
  ].join('\n');
}

function buildServer() {
  const server = new McpServer({ name: 'dsh-plugin-disk-map', version: VERSION }, { capabilities: { tools: {} }, instructions: buildInstructions() });
  server.registerTool('status', { title: 'Estado', description: 'Rutas permitidas y límites.', inputSchema: z.object({}) }, async () => textResult([`Rutas permitidas: ${allowedRoots().join(', ')}`, `Límites: ${MAX_DEPTH} niveles · ${MAX_FILES} archivos`, 'Modo: solo lectura'].join('\n')));
  server.registerTool('map', { title: 'Mapa de disco', description: 'Tamaño por entrada de una carpeta (top).', inputSchema: z.object({ path: z.string().min(2), top: z.number().int().min(1).max(100).optional(), depth: z.number().int().min(1).max(MAX_DEPTH).optional() }) }, async (args) => {
    const result = mapDisk(args.path, args.depth ?? 4, args.top ?? 15);
    if (result.entries.length === 0) return textResult('Carpeta vacía o sin permisos.');
    return textResult([
      `Ruta: ${result.root}`,
      `Total: ${fmt(result.total)} · archivos: ${result.files}`,
      '',
      ...result.entries.map((entry) => `- ${entry.type === 'dir' ? '📁' : '📄'} ${entry.name} · ${fmt(entry.size)}${result.total > 0 ? ` (${((entry.size / result.total) * 100).toFixed(1)}%)` : ''}`),
    ].join('\n'));
  });
  return server;
}

try { mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* ignora */ }
log('disk-map listo');
serveStdio(buildServer, { onerror: (e) => log(`serveStdio: ${e.message}`) });
process.on('uncaughtException', (e) => log(`excepción: ${e.message}`));
process.on('unhandledRejection', (e) => log(`rechazo: ${e && e.message ? e.message : String(e)}`));
