/* Keeps the "next gathering" promos current. Reads the public event list that
   theziongathering.com itself renders from and swaps in the soonest gathering
   that has not ended yet. The HTML ships with a hand-written gathering, so if
   this request fails the page still shows that. */
(function () {
  'use strict';

  // The gathering site's publishable key — public by design, the same one its own pages ship.
  var FEED = 'https://hnxkdtuisagmzhgjpxol.supabase.co/rest/v1/rpc/event_showcase';
  var KEY = 'sb_publishable_7PPF5DhTU-K2x-y8xy5IaA_sK9mesxI';
  var SITE = 'https://www.theziongathering.com';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var slots = document.querySelectorAll('[data-ng]');
  if (!slots.length || !window.fetch) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parse(iso) {
    var p = String(iso).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  // "Oct 22–25" · "Jul 28 – Aug 7"
  function shortRange(a, b) {
    var s = parse(a), e = parse(b);
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return MONTHS[s.getMonth()] + ' ' + s.getDate() + '–' + e.getDate();
    }
    return MONTHS[s.getMonth()] + ' ' + s.getDate() + ' – ' + MONTHS[e.getMonth()] + ' ' + e.getDate();
  }
  // "Thursday Oct 22 — Sunday Oct 25, 2026"
  function longRange(a, b) {
    var s = parse(a), e = parse(b);
    var start = DAYS[s.getDay()] + ' ' + MONTHS[s.getMonth()] + ' ' + s.getDate();
    if (s.getFullYear() !== e.getFullYear()) start += ', ' + s.getFullYear();
    return start + ' — ' + DAYS[e.getDay()] + ' ' + MONTHS[e.getMonth()] + ' ' + e.getDate() + ', ' + e.getFullYear();
  }
  function money(n) {
    return '$' + (n % 1 ? n.toFixed(2) : n.toLocaleString('en-US'));
  }
  function price(ev) {
    var open = (ev.options || []).filter(function (o) { return !o.sold_out; });
    if (!open.length) return 'Sold out — join the waitlist';
    var amounts = open.map(function (o) {
      return Number(o.current_price != null ? o.current_price : o.price);
    }).filter(function (n) { return isFinite(n) && n > 0; });
    if (!amounts.length) return 'See the gathering page';
    var low = Math.min.apply(null, amounts);
    return open.length === 1 ? money(low) + ' per person' : 'From ' + money(low);
  }
  // "The Monster Mansion · Bear Lake, Idaho" → venue + town
  function place(ev) {
    var parts = String(ev.location || '').split(/\s+[—·–-]\s+/);
    return { venue: parts[0] || '', town: parts.slice(1).join(', ') || parts[0] || '' };
  }
  function shortName(ev) {
    return String(ev.name || '').replace(/\s+gathering$/i, '');
  }

  function render(ev) {
    var where = place(ev);
    var name = shortName(ev);
    var url = SITE + '/g/' + encodeURIComponent(ev.slug);
    var rows = [
      ['When', longRange(ev.starts_on, ev.ends_on)],
      ['Where', where.venue && where.town !== where.venue ? where.venue + ', ' + where.town : where.town],
      ['Price', price(ev)],
      ['Capacity', 'Limited — reservation required']
    ];
    slots.forEach(function (el) {
      switch (el.getAttribute('data-ng')) {
        case 'line':
          el.textContent = 'Next gathering — ' + name + ', ' + where.town + ' · ' + shortRange(ev.starts_on, ev.ends_on);
          break;
        case 'link':
          el.setAttribute('href', url);
          break;
        case 'title':
          el.innerHTML = esc(name) + '.<br><em>' + esc(shortRange(ev.starts_on, ev.ends_on)) + '.</em>';
          break;
        case 'copy':
          if (ev.tagline) el.textContent = ev.tagline;
          break;
        case 'rows':
          el.innerHTML = rows.map(function (r) {
            return '<div class="gathering__row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
          }).join('');
          break;
      }
    });
  }

  function renderNone() {
    slots.forEach(function (el) {
      switch (el.getAttribute('data-ng')) {
        case 'line': el.textContent = 'New gatherings are announced on theziongathering.com'; break;
        case 'link': el.setAttribute('href', SITE + '/upcoming'); break;
        case 'title': el.innerHTML = 'More soon.<br><em>Stay close.</em>'; break;
        case 'copy': el.textContent = 'The next gathering is being planned. See every upcoming and past gathering, or leave your email to hear first.'; break;
        case 'rows': el.innerHTML = ''; break;
      }
    });
  }

  fetch(FEED, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
    body: '{}'
  })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (list) {
      if (!Array.isArray(list)) return;
      var today = todayIso();
      var next = list
        .filter(function (e) { return e && e.slug && e.starts_on && e.ends_on >= today && e.status !== 'draft'; })
        .sort(function (a, b) { return a.starts_on < b.starts_on ? -1 : a.starts_on > b.starts_on ? 1 : 0; })[0];
      if (next) render(next); else renderNone();
    })
    .catch(function () {});
})();
