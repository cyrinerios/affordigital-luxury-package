// POST /api/rsvp {g, events:[0|1,...], count, message} → saves the guest's reply
import { getGuests, saveRsvp } from '../lib/store.js';
import { send, body, str } from '../lib/http.js';
import { EVENT_COUNT } from '../lib/config.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  try {
    const b = await body(req);
    const code = str(b.g, 60).toLowerCase();
    const guest = (await getGuests()).find(g => g.code === code);
    if (!guest) return send(res, 404, { error: 'Invitation not found' });
    const ev = Array.from({ length: EVENT_COUNT }, (_, i) => (guest.events[i] && Number(b.events?.[i]) === 1 ? 1 : 0));
    const attending = ev.some(Boolean);
    let count = Math.round(Number(b.count) || 0);
    count = attending ? Math.min(Math.max(count, 1), guest.seats) : 0;
    const rsvp = { events: ev, attending, count, message: str(b.message, 600) };
    await saveRsvp(code, rsvp);
    send(res, 200, { ok: true, rsvp });
  } catch (e) { console.error(e); send(res, 500, { error: 'Could not save your reply. Please try again.' }); }
}
