// Test end-to-end de disk-map.
import path from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const packageDir = path.resolve(import.meta.dirname, '..');
const tmpDir = path.join(packageDir, 'test', 'tmp');
rmSync(tmpDir, { recursive: true, force: true });
const home = path.join(tmpDir, 'dsh-home');
const dataDir = path.join(tmpDir, 'data');
mkdirSync(path.join(home, 'disk-map'), { recursive: true });
mkdirSync(path.join(dataDir, 'sub'), { recursive: true });
writeFileSync(path.join(home, 'disk-map', 'config.json'), JSON.stringify({ allowedPaths: [tmpDir] }), 'utf8');
writeFileSync(path.join(dataDir, 'grande.bin'), Buffer.alloc(300 * 1024, 1));
writeFileSync(path.join(dataDir, 'chico.bin'), Buffer.alloc(10 * 1024, 1));
writeFileSync(path.join(dataDir, 'sub', 'mediano.bin'), Buffer.alloc(200 * 1024, 1));

function makeClient() {
  const entry = process.env.DISKMAP_SERVER ? path.resolve(process.env.DISKMAP_SERVER) : path.join(packageDir, 'server.mjs');
  const transport = new StdioClientTransport({ command: process.execPath, args: [entry], env: { SystemRoot: process.env.SystemRoot || 'C:\\Windows', PATH: process.env.PATH, USERPROFILE: process.env.USERPROFILE, HOME: process.env.HOME || process.env.USERPROFILE, TEMP: process.env.TEMP, TMP: process.env.TMP, DSH_HOME: home }, stderr: 'pipe' });
  transport.stderr?.on('data', (c) => process.stderr.write(`[server] ${c}`));
  const client = new Client({ name: 'diskmap-test', version: '1.0.0' }, { capabilities: {}, versionNegotiation: { mode: 'auto' } });
  return client.connect(transport).then(() => ({ client, transport }));
}
const textOf = (r) => (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');

const { client, transport } = await makeClient();
console.log('tools:', (await client.listTools()).tools.map((t) => t.name).join(', '));
console.log('--- status ---'); console.log(textOf(await client.callTool({ name: 'status', arguments: {} })));
const map = textOf(await client.callTool({ name: 'map', arguments: { path: dataDir } }));
console.log('--- map ---'); console.log(map);
console.log('total ~510 KB:', /Total: 5\d\d KB/.test(map));
console.log('lista grande y sub:', map.includes('grande.bin') && map.includes('sub'));
console.log('ordena por tamaño:', map.indexOf('grande.bin') < map.indexOf('chico.bin'));
const top = textOf(await client.callTool({ name: 'map', arguments: { path: dataDir, top: 1 } }));
console.log('top 1:', top.split('\n').filter((line) => line.startsWith('- ')).length === 1);
const outside = await client.callTool({ name: 'map', arguments: { path: 'C:\\Windows' } });
console.log('ruta fuera isError:', outside.isError === true);
await client.close(); try { await transport.close?.(); } catch {}
console.log('OK');
