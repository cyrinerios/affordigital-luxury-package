// Host dashboard API (requires the x-admin-key header)
// GET  /api/admin                         → { guests, rsvps }
// POST /api/admin {action:'save', guests} → replaces the guest list
// POST /api/admin {action:'clearRsvp', code} → removes a guest's reply
import { getGuests, saveGuests, getAllRsvps, clearRsvp } from '../lib/store.js';
import { send, body, isAdmin, str } from '../lib/http.js';
import { EVENT_COUNT, MAX_SEATS } from '../lib/config.js';

const clean = g => ({
  code: str(g.code, 60).toLowerCase().replace(/[^a-z0-9-]/g, ''),
  name: str(g.name, 120),
  dear: str(g.dear || g.name, 120),
  phone: str(g.phone, 30).replace(/[^\d+]/g, ''),
  seats: Math.min(Math.max(Math.round(Number(g.seats) || 1), 1), MAX_SEATS),
  group: str(g.group, 40),
  events: Array.from({ length: EVENT_COUNT }, (_, i) => (Number(g.events?.[i]) === 1 ? 1 : 0)),
  sentAt: g.sentAt ? str(g.sentAt, 40) : null
});

export default async function handler(req, res) {
  if (!isAdmin(req)) return send(res, 401, { error: 'Wrong host password' });
  try {
    if (req.method === 'GET') {
      const [guests, rsvps] = await Promise.all([getGuests(), getAllRsvps()]);
      return send(res, 200, { guests, rsvps });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
    const b = await body(req);
    if (b.action === 'save') {
      if (!Array.isArray(b.guests) || b.guests.length > 3000) return send(res, 400, { error: 'Invalid guest list' });
      const guests = b.guests.map(clean).filter(g => g.code && g.name);
      const codes = new Set();
      for (const g of guests) { if (codes.has(g.code)) return send(res, 400, { error: 'Duplicate guest code: ' + g.code }); codes.add(g.code); }
      await saveGuests(guests);
      return send(res, 200, { ok: true, guests });
    }
    if (b.action === 'clearRsvp') { await clearRsvp(str(b.code, 60).toLowerCase()); return send(res, 200, { ok: true }); }
    send(res, 400, { error: 'Unknown action' });
  } catch (e) { console.error(e); send(res, 500, { error: 'Server error' }); }
}
