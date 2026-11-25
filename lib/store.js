// Storage on Vercel Blob. Every write creates a new file (no overwrites, so no stale CDN reads):
//   <prefix>/guests/<timestamp>.json  – the whole guest list (latest file wins)
//   <prefix>/rsvp/<code>/<timestamp>.json – one file per reply (latest per guest wins)
// Set STORE=fs to use a local folder instead (for testing without Vercel).
import { SEED } from './seed.js';

const PREFIX = (process.env.DATA_PREFIX || 'data').replace(/[^a-zA-Z0-9_-]/g, '');
const useFs = process.env.STORE === 'fs';

let blob = null;
async function B() { if (!blob) blob = await import('@vercel/blob'); return blob; }

// ---------- low-level ----------
async function listAll(prefix) {
  if (useFs) {
    const fs = await import('node:fs/promises'); const path = await import('node:path');
    const root = path.join(process.cwd(), '.data');
    const out = [];
    async function walk(dir) {
      let ents = []; try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) await walk(p);
        else { const rel = path.relative(root, p).split(path.sep).join('/'); if (rel.startsWith(prefix)) { const st = await fs.stat(p); out.push({ pathname: rel, url: p, uploadedAt: st.mtime }); } }
      }
    }
    await walk(root); return out;
  }
  const { list } = await B();
  const out = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return out;
}
async function readJson(item) {
  if (useFs) { const fs = await import('node:fs/promises'); return JSON.parse(await fs.readFile(item.url, 'utf8')); }
  const r = await fetch(item.url + (item.url.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('read failed ' + r.status);
  return r.json();
}
async function writeJson(pathname, data) {
  const body = JSON.stringify(data);
  if (useFs) {
    const fs = await import('node:fs/promises'); const path = await import('node:path');
    const p = path.join(process.cwd(), '.data', pathname); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, body); return;
  }
  const { put } = await B();
  await put(pathname, body, { access: 'public', contentType: 'application/json', addRandomSuffix: true, cacheControlMaxAge: 60 });
}
async function remove(items) {
  if (!items.length) return;
  if (useFs) { const fs = await import('node:fs/promises'); await Promise.all(items.map(i => fs.unlink(i.url).catch(() => {}))); return; }
  const { del } = await B(); await del(items.map(i => i.url));
}
const ts = () => new Date().toISOString().replace(/[:.]/g, '-');
const newest = arr => arr.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];

// ---------- guests ----------
export async function getGuests() {
  const files = await listAll(`${PREFIX}/guests/`);
  if (!files.length) return SEED.map(g => ({ ...g }));
  return readJson(newest(files));
}
export async function saveGuests(guests) {
  await writeJson(`${PREFIX}/guests/${ts()}.json`, guests);
  // keep the last 5 versions as a safety net
  const files = (await listAll(`${PREFIX}/guests/`)).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  await remove(files.slice(5));
}

// ---------- replies ----------
export async function saveRsvp(code, rsvp) {
  await writeJson(`${PREFIX}/rsvp/${code}/${ts()}.json`, { ...rsvp, code, at: new Date().toISOString() });
}
export async function getRsvp(code) {
  const files = await listAll(`${PREFIX}/rsvp/${code}/`);
  return files.length ? readJson(newest(files)) : null;
}
export async function getAllRsvps() {
  const files = await listAll(`${PREFIX}/rsvp/`);
  const byCode = {};
  for (const f of files) {
    const code = f.pathname.slice(`${PREFIX}/rsvp/`.length).split('/')[0];
    if (!byCode[code] || new Date(f.uploadedAt) > new Date(byCode[code].uploadedAt)) byCode[code] = f;
  }
  const entries = await Promise.all(Object.entries(byCode).map(async ([code, f]) => { try { return [code, await readJson(f)]; } catch { return [code, null]; } }));
  return Object.fromEntries(entries.filter(e => e[1]));
}
export async function clearRsvp(code) {
  await remove(await listAll(`${PREFIX}/rsvp/${code}/`));
}
