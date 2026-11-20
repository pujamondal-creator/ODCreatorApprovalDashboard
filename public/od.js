window.startOd = function (token) {
  var app = document.getElementById('app');
  var S = { data: null, q: '', page: 0, items: [], hasMore: false, total: 0, showSigned: false, celebrate: false };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function api(path, body) {
    var opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch('/api/od/' + token + path, opt).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; return j; }); });
  }
  function day(iso) { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function profile(h) { return '<a href="https://instagram.com/' + esc(h.slice(1)) + '" target="_blank" rel="noopener">View profile</a>'; }

  function load() {
    return api('').then(function (d) {
      S.data = d;
      if (d.unseen.length) S.celebrate = true;
      return d.synced ? loadList(true) : null;
    }).then(function () { render(); if (S.celebrate) confetti(); }).catch(function () {
      app.innerHTML = '<div class="card"><h2>This link is not valid</h2><p class="muted" style="margin-top:6px">Ask your contact at WeLearn for a fresh link.</p></div>';
    });
  }
  function loadList(reset) {
    if (reset) { S.page = 0; S.items = []; }
    return api('/list?q=' + encodeURIComponent(S.q) + '&page=' + S.page).then(function (r) {
      S.items = S.items.concat(r.items); S.hasMore = r.hasMore; S.total = r.total;
    });
  }

  function rows() {
    if (!S.items.length) return '<p class="muted" style="padding:24px 0;text-align:center">No creators match that handle.</p>';
    return S.items.map(function (c) {
      function b(v, label) { return '<button class="btn ' + v + (c.decision === v ? ' on' : '') + '" data-act="decide" data-id="' + esc(c.id) + '" data-v="' + v + '">' + label + '</button>'; }
      return '<div class="item"><div class="grow"><div class="name">' + esc(c.handle) + '</div><div class="small">' + profile(c.handle) + '</div></div>' +
        '<div class="row" style="gap:8px">' + b('yes', 'Yes') + b('no', 'No') + b('friend', 'Friend') + '</div></div>';
    }).join('');
  }

  function signedCard(d) {
    var n = d.signed.length;
    return '<div class="card stack"><div class="row"><div class="grow"><p style="font-size:28px;font-weight:500;line-height:1.2">' + n + ' <span class="muted" style="font-size:15px;font-weight:400">creators signed through your account</span></p>' +
      '<p class="muted small" style="margin-top:4px">' + (n ? 'Latest: ' + esc(d.signed[0].handle) + ', ' + day(d.signed[0].at) : 'We will let you know the moment we sign someone.') + '</p></div>' +
      (n ? '<button class="btn" data-act="togglesigned">' + (S.showSigned ? 'Hide the list' : 'Tap here to see the list') + '</button>' : '') + '</div>' +
      (S.showSigned && n ? '<div class="list" style="border-radius:8px">' + d.signed.map(function (s) {
        return '<div class="item" style="padding:10px 0"><div class="grow"><div class="name">' + esc(s.handle) + '</div><div class="small">' + profile(s.handle) + '</div></div><span class="small muted">Signed ' + day(s.at) + '</span></div>';
      }).join('') + '</div>' : '') + '</div>';
  }

  function render() {
    var d = S.data;
    var focusQ = document.activeElement && document.activeElement.id === 'q';
    var caret = focusQ ? document.activeElement.selectionStart : 0;
    var confirmed = !!d.od.confirmedAt;
    var pct = d.total ? Math.round(d.decided / d.total * 100) : 0;
    var cele = S.celebrate ? '<div class="celebrate" role="status"><h2>We just signed ' + esc((d.unseen[d.unseen.length - 1] || (d.signed[0] && d.signed[0].handle) || 'a new creator')) + '</h2><p>That one came through your account. Thank you, ' + esc(d.od.firstName) + '.</p><button class="btn" data-act="closecele">Close</button></div>' : '';

    var list;
    if (!d.synced) {
      list = '<div class="card"><h2>Your list is being prepared</h2><p class="muted" style="margin-top:6px">We will let you know as soon as it is ready for you to review.</p></div>';
    } else {
      list = '<section class="stack"><div><h2>Your priority creators</h2></div>' +
        '<label class="stack small muted" style="gap:6px">Search for anyone you do not want us to contact, like friends, collaborators or fellow creators' +
        '<input type="text" id="q" placeholder="Search by handle" value="' + esc(S.q) + '" autocomplete="off"></label>' +
        '<div class="list">' + rows() + '</div>' +
        (S.hasMore ? '<button class="btn" data-act="more">Show more</button>' : '') +
        '</section>' +
        (confirmed
          ? '<div class="banner">Thanks, ' + esc(d.od.firstName) + '. Your list is confirmed. We will only contact creators you want us to contact.</div>'
          : '<button class="btn dark" style="height:52px;font-size:16px" data-act="confirm">Confirm your list</button>');
    }

    app.innerHTML = cele +
      '<div class="stack" style="gap:6px"><h1>Hi ' + esc(d.od.firstName) + ', who should we reach out to?</h1>' +
      '<p class="muted">Mark yes, no or friend for each creator. Nobody is contacted from your account until you confirm your list.</p></div>' +
      (d.synced ? '<div class="card stack" style="gap:10px"><div class="spread muted small"><span>Review progress</span><span>' + d.decided + ' of ' + d.total + ' done</span></div><div class="bar"><i style="width:' + pct + '%"></i></div></div>' : '') +
      signedCard(d) + list;

    if (focusQ) { var q = document.getElementById('q'); q.focus(); q.setSelectionRange(caret, caret); }
  }

  var timer;
  app.addEventListener('input', function (e) {
    if (e.target.id === 'q') {
      S.q = e.target.value;
      clearTimeout(timer);
      timer = setTimeout(function () { loadList(true).then(render); }, 200);
    }
  });
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.dataset.act;
    if (act === 'decide') {
      var c = S.items.filter(function (x) { return x.id === b.dataset.id; })[0];
      var next = c.decision === b.dataset.v ? null : b.dataset.v;
      if (!c.decision && next) S.data.decided++;
      if (c.decision && !next) S.data.decided--;
      c.decision = next; render();
      api('/decide', { leadId: c.id, decision: next });
    } else if (act === 'more') { S.page++; loadList(false).then(render); }
    else if (act === 'confirm') api('/confirm', {}).then(function (r) { S.data.od.confirmedAt = r.confirmedAt; render(); });
    else if (act === 'togglesigned') { S.showSigned = !S.showSigned; render(); }
    else if (act === 'closecele') { S.celebrate = false; S.data.unseen = []; render(); api('/seen', {}); }
  });

  function confetti() {
    var cv = document.getElementById('confetti'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    var cols = ['#0F6E56', '#185FA5', '#BA7517', '#D4537E', '#534AB7', '#D85A30'];
    var parts = [];
    for (var i = 0; i < 160; i++) parts.push({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * 0.25, vx: (Math.random() - .5) * 16, vy: -Math.random() * 14 - 3, r: Math.random() * 5 + 3, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - .5) * .4 });
    (function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      var alive = 0;
      parts.forEach(function (p) {
        p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += p.va;
        if (p.y < cv.height + 20) { alive++; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      });
      if (alive) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  load();
};
