# OD creator approval dashboard (demo build)

Stops outreach to creators an OD does not want contacted. Runs on dummy data. Needs only Node 18 or newer, no installs.

    npm start

- Internal ops (work email login): http://localhost:3000/ops (allowed domain: welearncreators.com, set with ALLOWED_DOMAINS)
- OD dashboards (no login, private link per OD): the links printed in the terminal

Change the port with `PORT=4000 npm start`. Reset the demo data with `npm run reset` or the Reset button on the ops page.

## How it works

1. Ops press Run sync on an OD row. All Fit leads for that OD are imported from the central leads sheet, highest follower count first.
2. The OD opens their private link and marks each creator Yes, No or Friend. A search box lets them find anyone they do not want contacted.
3. The OD presses Confirm your list. Cleared to contact counts only Yes answers on confirmed lists.
4. Ops run sync on the BD Creators Tracker table. Creators signed through an OD appear there, and the OD sees a confetti celebration on their dashboard.

Ops view: tiles (Cleared to contact, Do not contact, Waiting for OD, Creators signed), OD review progress table, signed creators table with weekly, monthly, 3 times a month (last 10 days), quarterly, yearly and all time views, per column filters and a global search, and a cleared list export.

## BD Creators Tracker mapping (lib/config.js)

- Creator IG handle: column C
- Outreach 1 to 4 (holds the OD's IG handle): columns U, AB, AI, AP
- Status: column AV. "AM Allocation" or "Handed-over" means signed.
- Handles are normalised (case, @, instagram.com URLs, spaces) before matching.
- A signed creator is credited to every OD whose handle appears in an outreach column.

## What is simulated

- The two Google Sheets are dummy data. lib/sheets.js is the single place to swap in a real Google Sheets reader (service account plus the real leads sheet columns).
- Ops login only checks the email domain. The live version should use Google sign-in restricted to the company domain.
- OD links use a private token in the URL. Treat links like passwords.
- No WhatsApp or email notifications are sent.

## Single file demo

demo/index.html is the whole app in one file (dummy data, runs in the browser, no server). Open it in Chrome. A dark bar at the top switches between the internal ops view and any OD dashboard.

## Layout

- lib/api.js: all endpoints, shared by the Node server and the single file hosted demo
- lib/sync.js, lib/stats.js, lib/seed.js, lib/sheets.js, lib/config.js
- public/: od.html, ops.html, od.js, ops.js, style.css
