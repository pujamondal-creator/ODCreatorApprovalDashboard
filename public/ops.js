window.startOps = function () {
  var app = document.getElementById('app');
  var D = null;
  var S = { search: '', period: 'all', f1: { od: '', conf: '', cleared: '' }, f2: { creator: '', od: '', signed: '' }, shown: 15 };
  var PERIODS = [['week', 'Weekly', 7], ['month', 'Monthly', 30], ['ten', '3 times a month', 10], ['quarter', 'Quarterly', 90], ['year', 'Yearly', 365], ['all', 'All time', 0]];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(n) { return Number(n).toLocaleString('en-GB'); }
  function time(iso) { return iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never'; }
  function dshort(iso) { return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function ig(h) { return 'https://instagram.com/' + String(h).replace(/^@/, ''); }
  function api(path, body) {
    var opt = body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch('/api/ops/' + path, opt).then(function (r) { return r.json().then(function (j) { if (!r.ok) { j.status = r.status; throw j; } return j; }); });
  }

  function loginView(msg) {
    app.innerHTML =
      '<div class="login stack" style="gap:16px"><h1>OD approvals</h1><p class="muted">Sign in with your work email to see the review progress and the cleared list.</p>' +
      '<form id="f" class="stack"><label class="stack small muted" style="gap:6px">Work email<input type="email" id="email" placeholder="you@welearncreators.com" autocomplete="email" required></label>' +
      (msg ? '<p class="err">' + esc(msg) + '</p>' : '') +
      '<button class="btn dark" type="submit" style="height:48px">Sign in</button></form>' +
      '<p class="small muted">Demo build: this checks the email domain only. The live version uses single sign-on with your work account.</p></div>';
    document.getElementById('f').addEventListener('submit', function (e) {
      e.preventDefault();
      api('login', { email: document.getElementById('email').value }).then(refresh).catch(function (er) { loginView(er.error); });
    });
  }

  function refresh() {
    return api('summary').then(function (d) { var first = !D; D = d; if (first || !document.getElementById('t1')) skeleton(); renderAll(); })
      .catch(function (e) { if (e.status === 401) { D = null; loginView(); } else app.innerHTML = '<p class="wrap err">' + esc(e.error || 'Could not load.') + '</p>'; });
  }

  function skeleton() {
    var periods = PERIODS.map(function (p) { return '<button class="chip' + (S.period === p[0] ? ' on' : '') + '" data-act="period" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('');
    app.innerHTML =
      '<div class="wrap wide">' +
      '<div class="spread"><div><h1>OD approvals</h1><p class="muted" style="margin-top:4px">Outreach may only use the Cleared to contact export.</p></div>' +
      '<div class="row"><span class="small muted">' + esc(D.user) + '</span><button class="btn small" data-act="logout">Sign out</button><button class="btn dark" data-act="export">Export cleared list</button></div></div>' +
      '<div class="tiles" id="tiles"></div>' +
      '<input type="text" id="gsearch" placeholder="Search ODs and creators across both tables" value="' + esc(S.search) + '" autocomplete="off">' +
      '<div id="exportbox"></div>' +
      '<div class="ops-grid"><div class="stack" style="gap:24px;min-width:0">' +
      '<div class="card"><div class="spread" style="margin-bottom:8px"><h2>OD review progress</h2><span class="small muted" id="t1count"></span></div><div class="scroll"><table id="t1"><thead>' +
      '<tr><th>Run sync</th><th>OD</th><th>Full list confirmed</th><th>Cleared to contact</th><th></th></tr>' +
      '<tr class="filters"><th></th><th><input type="text" data-f1="od" placeholder="Filter OD"></th>' +
      '<th><select data-f1="conf"><option value="">All</option><option value="yes">Confirmed</option><option value="no">Yet to be confirmed</option></select></th>' +
      '<th><input type="text" data-f1="cleared" placeholder="Min number"></th><th></th></tr></thead><tbody></tbody></table></div></div>' +
      '<div class="card"><div class="spread" style="margin-bottom:8px"><div><h2>Creators signed (BD Creators Tracker)</h2><p class="small muted" id="t2sub"></p></div></div>' +
      '<div class="row" style="gap:8px;margin-bottom:10px">' + periods + '</div>' +
      '<div class="scroll"><table id="t2"><thead>' +
      '<tr><th>Run sync now</th><th>Creator</th><th>OD</th><th>Signed</th></tr>' +
      '<tr class="filters"><th></th><th><input type="text" data-f2="creator" placeholder="Filter creator"></th>' +
      '<th><select data-f2="od"><option value="">All ODs</option>' + D.ods.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.name) + '</option>'; }).join('') + '</select></th>' +
      '<th><select data-f2="signed"><option value="">All</option><option value="yes">Yes</option><option value="progress">In progress</option><option value="no">No</option></select></th></tr></thead><tbody></tbody></table></div>' +
      '<div id="more"></div></div></div>' +
      '<aside class="stack" style="gap:24px"><div class="card stack"><h2>Activity</h2><div class="feed small" id="feed"></div></div>' +
      '<div class="card stack"><h2>Demo tools</h2><select id="simod">' + D.ods.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.name) + '</option>'; }).join('') + '</select>' +
      '<button class="btn" data-act="simulate">Simulate signing</button><button class="btn small" data-act="reset">Reset demo data</button><p class="small muted" id="simmsg"></p></div></aside></div></div>';
  }

  function inPeriod(iso) {
    var p = PERIODS.filter(function (x) { return x[0] === S.period; })[0];
    if (!p[2]) return true;
    return Date.now() - new Date(iso).getTime() <= p[2] * 86400000;
  }

  function renderAll() { renderTiles(); renderT1(); renderT2(); document.getElementById('feed').innerHTML = D.activity.map(function (a) { return '<div><time>' + time(a.at) + '</time>' + esc(a.text) + '</div>'; }).join(''); }

  function signedCount() {
    var seen = {};
    D.pairs.forEach(function (p) { if (p.status === 'yes' && inPeriod(p.date)) seen[p.key] = 1; });
    return Object.keys(seen).length;
  }
  function renderTiles() {
    var t = D.tiles;
    document.getElementById('tiles').innerHTML = [['Cleared to contact', num(t.cleared)], ['Do not contact', num(t.doNotContact)], ['Waiting for OD', num(t.awaiting)], ['Creators signed', num(signedCount())]].map(function (x) {
      return '<div class="tile"><span class="small muted">' + x[0] + '</span><b>' + x[1] + '</b></div>';
    }).join('');
  }

  function renderT1() {
    var g = S.search.toLowerCase(), f = S.f1;
    var list = D.ods.filter(function (o) {
      var hay = (o.name + ' ' + o.handle).toLowerCase();
      if (g && hay.indexOf(g) < 0) return false;
      if (f.od && hay.indexOf(f.od.toLowerCase()) < 0) return false;
      if (f.conf === 'yes' && !o.confirmed) return false;
      if (f.conf === 'no' && o.confirmed) return false;
      if (f.cleared && o.cleared < Number(f.cleared)) return false;
      return true;
    });
    document.getElementById('t1count').textContent = list.length + ' of ' + D.ods.length + ' ODs';
    document.querySelector('#t1 tbody').innerHTML = list.length ? list.map(function (o) {
      var conf = !o.synced ? '<span class="pill muted">Not synced yet</span>' :
        '<div><span class="pill ' + (o.confirmed ? 'ok' : 'warn') + '">' + (o.confirmed ? 'Yes' : 'Yet to be confirmed') + '</span> <span class="small muted">' + o.pctReviewed + '% of leads reviewed</span></div>' +
        '<div class="small muted" style="margin-top:4px">Yes ' + num(o.yes) + ' · No ' + num(o.no) + ' · Friend ' + num(o.friend) + ' · Yet to confirm ' + num(o.pending) + '</div>';
      return '<tr><td><button class="btn small' + (o.synced ? '' : ' dark') + '" data-act="syncod" data-id="' + esc(o.id) + '">' + (o.synced ? 'Run sync' : 'Run sync') + '</button></td>' +
        '<td><div style="font-weight:500">' + esc(o.name) + '</div><div class="small muted">' + esc(o.handle) + '</div><a class="small" href="' + ig(o.handle) + '" target="_blank" rel="noopener">View profile</a></td>' +
        '<td>' + conf + '</td><td>' + (o.synced ? num(o.cleared) : '-') + '</td>' +
        '<td><button class="btn small" data-act="open" data-token="' + esc(o.token) + '">Open</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="muted">No ODs match.</td></tr>';
  }

  function renderT2() {
    var g = S.search.toLowerCase(), f = S.f2;
    var rows = D.pairs.filter(function (p) {
      if (!inPeriod(p.date)) return false;
      var hay = (p.name + ' ' + p.handle + ' ' + p.odName + ' ' + p.odHandle).toLowerCase();
      if (g && hay.indexOf(g) < 0) return false;
      if (f.creator && (p.name + ' ' + p.handle).toLowerCase().indexOf(f.creator.toLowerCase()) < 0) return false;
      if (f.od && p.odId !== f.od) return false;
      if (f.signed && p.status !== f.signed) return false;
      return true;
    }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var label = PERIODS.filter(function (x) { return x[0] === S.period; })[0];
    document.getElementById('t2sub').textContent = rows.length + ' creator and OD pairs · ' + label[1] + (label[2] ? ' (last ' + label[2] + ' days)' : '') + ' · last tracker sync ' + time(D.lastTrackerSyncAt);
    var pill = { yes: '<span class="pill ok">Yes</span>', progress: '<span class="pill warn">In progress</span>', no: '<span class="pill muted">No</span>' };
    document.querySelector('#t2 tbody').innerHTML = rows.length ? rows.slice(0, S.shown).map(function (p) {
      return '<tr><td><button class="btn small" data-act="synctracker" data-key="' + esc(p.key) + '">Run sync now</button></td>' +
        '<td><div style="font-weight:500">' + esc(p.name) + '</div><a class="small" href="' + ig(p.handle) + '" target="_blank" rel="noopener">' + esc(p.handle) + '</a></td>' +
        '<td><div>' + esc(p.odName) + '</div><div class="small muted">' + esc(p.odHandle) + '</div></td>' +
        '<td>' + pill[p.status] + '<div class="small muted" style="margin-top:2px">' + dshort(p.date) + '</div></td></tr>';
    }).join('') : '<tr><td colspan="4" class="muted">Nothing in this period.</td></tr>';
    document.getElementById('more').innerHTML = rows.length > S.shown ? '<button class="btn" style="margin-top:12px" data-act="more">Show more (' + (rows.length - S.shown) + ' left)</button>' : '';
  }

  app.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'gsearch') S.search = t.value;
    else if (t.dataset.f1 !== undefined) S.f1[t.dataset.f1] = t.value;
    else if (t.dataset.f2 !== undefined) S.f2[t.dataset.f2] = t.value;
    else return;
    S.shown = 15; renderT1(); renderT2();
  });

  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var a = b.dataset.act;
    if (a === 'logout') api('logout', {}).then(function () { D = null; loginView(); });
    else if (a === 'period') { S.period = b.dataset.v; S.shown = 15; [].forEach.call(document.querySelectorAll('[data-act=period]'), function (x) { x.classList.toggle('on', x === b); }); renderTiles(); renderT2(); }
    else if (a === 'more') { S.shown += 15; renderT2(); }
    else if (a === 'open') window.openOd(b.dataset.token);
    else if (a === 'syncod') { b.disabled = true; b.textContent = 'Syncing'; api('sync-leads', { odId: b.dataset.id }).then(refresh); }
    else if (a === 'synctracker') { b.disabled = true; b.textContent = 'Checking'; api('sync-tracker', {}).then(refresh); }
    else if (a === 'simulate') {
      var sel = document.getElementById('simod');
      api('simulate-sign', { odId: sel.value }).then(function (r) { document.getElementById('simmsg').textContent = 'Signed ' + r.handle + '. Open that OD to see the confetti.'; return refresh(); })
        .catch(function (er) { document.getElementById('simmsg').textContent = er.error || 'Failed'; });
    }
    else if (a === 'reset') { api('reset', {}).then(function () { D = null; S.shown = 15; return refresh(); }); }
    else if (a === 'export') {
      fetch('/api/ops/export.csv').then(function (r) { return r.text(); }).then(function (txt) {
        var url = '';
        try { url = URL.createObjectURL(new Blob([txt], { type: 'text/csv' })); } catch (x) {}
        var n = Math.max(0, txt.split('\n').length - 1);
        document.getElementById('exportbox').innerHTML = '<div class="card stack"><div class="spread"><h2>Cleared list (' + num(n) + ' creators)</h2><div class="row"><button class="btn small" data-act="copycsv">Copy CSV</button>' +
          (url ? '<a class="btn small" style="display:inline-flex;align-items:center;text-decoration:none" href="' + url + '" download="cleared-to-contact.csv">Download</a>' : '') +
          '<button class="btn small" data-act="closeexport">Close</button></div></div><textarea id="csvtxt" readonly rows="6" style="width:100%;font:12px monospace;border:1px solid var(--line);border-radius:8px;padding:8px"></textarea></div>';
        document.getElementById('csvtxt').value = txt;
      });
    }
    else if (a === 'copycsv') { var ta = document.getElementById('csvtxt'); ta.select(); try { document.execCommand('copy'); b.textContent = 'Copied'; } catch (x) {} }
    else if (a === 'closeexport') document.getElementById('exportbox').innerHTML = '';
  });

  refresh();
};
