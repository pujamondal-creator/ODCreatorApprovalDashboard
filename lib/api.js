// All app endpoints in one place. Used by the Node server and by the single-file hosted demo.
// route(method, pathname, searchParams, body, ctx) -> { status, json | text, contentType, login, logout }
// ctx.user = the signed-in ops email or null.
const store = require('./db');
const cfg = require('./config');
const sync = require('./sync');
const { isCleared, odStats } = require('./stats');

const J = (status, json, extra) => Object.assign({ status, json }, extra || {});
const csvCell = (v) => '"' + String(v).replace(/"/g, '""') + '"';
const PAGE = 25;

function route(method, p, q, body, ctx) {
  const db = store.get();
  const now = new Date().toISOString();
  let m;

  // ---------- OD dashboard (no login, private link token) ----------
  m = p.match(/^\/api\/od\/([\w-]+)(?:\/(\w+))?$/);
  if (m) {
    const od = db.ods.find((o) => o.token === m[1]);
    if (!od) return J(404, { error: 'This link is not valid.' });
    const sub = m[2];
    const mine = db.leads.filter((l) => l.odId === od.id && l.fit).sort((a, b) => b.followers - a.followers);

    if (method === 'GET' && !sub) {
      const unseen = (od.signed || []).filter((s) => !s.seen);
      return J(200, {
        od: { name: od.name, firstName: od.name.split(' ')[0], handle: od.handle, confirmedAt: od.confirmedAt },
        synced: !!od.leadsSyncedAt,
        total: mine.length,
        decided: mine.filter((l) => l.decision).length,
        signed: (od.signed || []).slice().sort((a, b) => new Date(b.at) - new Date(a.at)).map((s) => ({ handle: s.handle, at: s.at })),
        unseen: unseen.map((s) => s.handle),
      });
    }
    if (method === 'GET' && sub === 'list') {
      const needle = sync.norm(q.get('q') || '');
      const page = Math.max(0, Number(q.get('page')) || 0);
      const all = mine.filter((l) => !needle || l.key.includes(needle));
      return J(200, {
        items: all.slice(page * PAGE, page * PAGE + PAGE).map((l) => ({ id: l.id, handle: l.handle, decision: l.decision })),
        total: all.length,
        hasMore: (page + 1) * PAGE < all.length,
      });
    }
    if (method === 'POST') {
      const lead = body.leadId ? db.leads.find((l) => l.id === body.leadId && l.odId === od.id) : null;
      if (sub === 'decide' && lead) {
        lead.decision = ['yes', 'no', 'friend'].includes(body.decision) ? body.decision : null;
        db.log.unshift({ at: now, text: od.name + ' marked ' + lead.handle + ' as ' + (lead.decision || 'undecided') });
        db.log.length = Math.min(db.log.length, 200);
        store.save();
        return J(200, { ok: true });
      }
      if (sub === 'confirm') {
        od.confirmedAt = now;
        db.log.unshift({ at: now, text: od.name + ' confirmed their list' });
        store.save();
        return J(200, { ok: true, confirmedAt: now });
      }
      if (sub === 'seen') {
        (od.signed || []).forEach((s) => (s.seen = true));
        store.save();
        return J(200, { ok: true });
      }
    }
    return J(400, { error: 'Bad request' });
  }

  // ---------- Ops login ----------
  if (p === '/api/ops/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const domain = email.split('@')[1] || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J(400, { error: 'Enter a valid work email.' });
    if (!cfg.ALLOWED_DOMAINS.includes(domain)) return J(403, { error: 'Use your work email (' + cfg.ALLOWED_DOMAINS.map((d) => '@' + d).join(', ') + ').' });
    return J(200, { ok: true, email }, { login: email });
  }
  if (p === '/api/ops/logout' && method === 'POST') return J(200, { ok: true }, { logout: true });

  if (p.startsWith('/api/ops/')) {
    if (!ctx.user) return J(401, { error: 'Sign in with your work email.' });

    if (p === '/api/ops/summary' && method === 'GET') {
      const rows = db.ods.map((o) => odStats(db, o));
      const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
      return J(200, {
        user: ctx.user,
        tiles: { cleared: sum('cleared'), doNotContact: sum('no') + sum('friend'), awaiting: sum('pending') },
        ods: rows,
        pairs: db.trackerView || [],
        activity: db.log.slice(0, 12),
        lastTrackerSyncAt: db.lastTrackerSyncAt || null,
      });
    }
    if (p === '/api/ops/export.csv' && method === 'GET') {
      const lines = [['OD', 'OD handle', 'Creator handle', 'Followers'].map(csvCell).join(',')];
      for (const od of db.ods) {
        db.leads.filter((l) => l.odId === od.id && isCleared(od, l)).sort((a, b) => b.followers - a.followers)
          .forEach((l) => lines.push([od.name, od.handle, l.handle, l.followers].map(csvCell).join(',')));
      }
      return { status: 200, text: lines.join('\n'), contentType: 'text/csv; charset=utf-8' };
    }
    if (method === 'POST') {
      if (p === '/api/ops/sync-leads') {
        // Run sync for one OD: imports all Fit leads for that OD from the central leads sheet.
        const od = db.ods.find((o) => o.id === body.odId);
        if (!od) return J(404, { error: 'Unknown OD' });
        const r = sync.run(db, { odIds: [od.id] });
        db.log.unshift({ at: now, text: 'Run sync for ' + od.name + ': ' + r.leadsAdded + ' new leads imported' });
        store.save();
        return J(200, r);
      }
      if (p === '/api/ops/sync-tracker') {
        // Re-checks the BD Creators Tracker: who was signed through which OD.
        const r = sync.run(db, { odIds: null });
        db.log.unshift({ at: now, text: 'Tracker sync: ' + r.newSigned + ' newly signed' });
        store.save();
        return J(200, r);
      }
      if (p === '/api/ops/simulate-sign') {
        // Demo helper: marks a creator as AM Allocation in the dummy tracker, then syncs, as the real sheet would.
        const od = db.ods.find((o) => o.id === body.odId);
        if (!od) return J(404, { error: 'Unknown OD' });
        const taken = new Set((db.trackerView || []).filter((x) => x.odId === od.id).map((x) => x.key));
        const pool = db.sheets.leads.filter((r) => r.od === od.handle && String(r.fit).toLowerCase() === 'fit' && !taken.has(sync.norm(r.handle)));
        const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 10))];
        if (!pick) return J(400, { error: 'No creators left to sign for this OD.' });
        db.sheets.tracker.push({ C: pick.handle, U: od.handle, AB: '', AI: '', AP: '', AV: 'AM Allocation', date: now });
        const r = sync.run(db, { odIds: null });
        store.save();
        return J(200, { ok: true, handle: pick.handle, result: r });
      }
      if (p === '/api/ops/reset') { store.reset(); return J(200, { ok: true }); }
    }
    return J(404, { error: 'Not found' });
  }
  return J(404, { error: 'Not found' });
}

module.exports = { route };
