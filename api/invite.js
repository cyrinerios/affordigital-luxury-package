// GET /api/invite?g=CODE  → the guest's own invitation details and their latest reply
import { getGuests, getRsvp } from '../lib/store.js';
import { send, str } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  const code = str(new URL(req.url, 'http://x').searchParams.get('g'), 60).toLowerCase();
  if (!code) return send(res, 400, { error: 'Missing guest code' });
  try {
    const guest = (await getGuests()).find(g => g.code === code);
    if (!guest) return send(res, 404, { error: 'Invitation not found' });
    const rsvp = await getRsvp(code);
    const { name, dear, seats, events } = guest;
    send(res, 200, { guest: { code, name, dear, seats, events }, rsvp });
  } catch (e) { console.error(e); send(res, 500, { error: 'Could not load the invitation' }); }
}
