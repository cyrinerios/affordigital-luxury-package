# AfforDigital · Luxury personalised invitation

A wedding invitation website where every guest gets their own link, plus a host dashboard.

- **Guest link** `/i/<code>`: an envelope addressed to the guest opens into their invitation, showing their name, reserved seats and only the events they are invited to. Their RSVP is saved and can be changed later.
- **Host dashboard** `/host` (password protected): live replies per event, guest messages, a **WhatsApp** button and **Copy link** button for each guest, add / edit / delete guests, **import from Excel** (paste rows), **export** to Excel, and an editable WhatsApp message.
- **Home** `/`: a general page asking guests to use their personal link (shows demo links while `demo: true` in `public/config.js`).

## Setting it up for a client
1. Edit `public/config.js` (couple, dates, events, story, WhatsApp message) and set `demo: false`.
2. Keep `lib/config.js` `EVENT_COUNT` equal to the number of events.
3. In Vercel, set a new `ADMIN_KEY` (the host password) and a new random `DATA_PREFIX` per client.
4. Add guests in the dashboard or import them from Excel, then send each link from the dashboard.

## How it works
- Static pages in `public/`, serverless functions in `api/` (Node), data in **Vercel Blob**.
- Every save writes a new file (guest list versions and one file per reply), so reads are never stale.
- Environment variables: `BLOB_READ_WRITE_TOKEN` (added by Vercel when the Blob store is connected), `ADMIN_KEY`, `DATA_PREFIX`.
- Local testing without Vercel: `STORE=fs ADMIN_KEY=test node` with any small server that maps `/api/*` to the handlers.
