/* HANGAR renderer — shared by the full Electron app and the static view-only export. */
(function () {
  'use strict';
  const API = window.hangar || null;                 // present only in the Electron full version
  const VIEW = !API;                                 // view-only snapshot (no prices, no editing)
  const M = window.Match;
  const $app = document.getElementById('app');
  const GRADE_ORDER = ['PG', 'MG', 'RG', 'HG', 'FM', 'Mega', 'EG', 'AG', 'SD', 'Other'];

  let DB = { items: [], settings: {} };
  const state = loadUI();

  function loadUI() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('hangar-ui') || '{}'); } catch (e) {}
    return Object.assign({ q: '', grade: 'All', sort: 'grade', dir: 1, view: 'grid', review: false }, s);
  }
  function saveUI() { try { localStorage.setItem('hangar-ui', JSON.stringify(state)); } catch (e) {} }

  // ---------- helpers ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gbp = (n, dp = 0) => n == null || isNaN(n) ? '—' : (n < 0 ? '−£' : '£') + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const yen = (n) => n == null ? '—' : '¥' + Number(n).toLocaleString('en-GB');
  const signed = (n) => n == null ? '—' : (n > 0 ? '+' : '') + gbp(n);
  const pct = (n) => n == null || !isFinite(n) ? '' : (n > 0 ? '+' : '') + n.toFixed(0) + '%';
  const rate = () => (DB.settings && DB.settings.jpyPerGbp) || 200;
  const rrpGbp = (it) => it.rrpJpy ? it.rrpJpy / rate() : null;
  const rrpUnknown = (it) => !it.rrpJpy;
  // green if you paid under RRP, red if over, plain if about the same
  const rrpCls = (it) => rrpUnknown(it) || it.gift || it.paid == null ? '' : Math.abs(cost(it) - rrpGbp(it)) < 0.5 ? '' : cost(it) > rrpGbp(it) ? 'loss' : 'gain';
  const rrpText = (it) => rrpUnknown(it) ? '—' : gbp(rrpGbp(it));
  const cost = (it) => it.gift ? 0 : (it.paid || 0);
  const value = (it) => it.current && it.current.gbp != null ? it.current.gbp : null;
  const pl = (it) => value(it) == null ? null : value(it) - cost(it);
  const plPct = (it) => cost(it) > 0 && pl(it) != null ? (pl(it) / cost(it)) * 100 : null;
  const gradeName = (g) => (M.GRADE_INFO[g] || M.GRADE_INFO.Other).name;
  const needsCheck = (i) => !!(i.imageReview || !i.image);
  const cls = (n) => n == null ? '' : n > 0 ? 'gain' : n < 0 ? 'loss' : '';
  function imgSrc(it) {
    if (!it.image) return null;
    if (it.image.local) return VIEW ? it.image.local : 'hangar://' + it.image.local;
    return it.image.url || it.image.thumb || null;
  }
  function imgTag(it, extra = '') {
    const src = imgSrc(it);
    if (!src) return `<div class="noimg">${ICON.camera}No photo yet</div>`;
    const fb = it.image && it.image.thumb && !it.image.local ? ` data-fallback="${esc(it.image.thumb)}"` : '';
    return `<img src="${esc(src)}"${fb} alt="${esc(it.title)}" loading="lazy" referrerpolicy="no-referrer" ${extra}>`;
  }
  document.addEventListener('error', (e) => {
    const el = e.target;
    if (el.tagName !== 'IMG') return;
    if (el.dataset.fallback && el.src !== el.dataset.fallback) { el.src = el.dataset.fallback; delete el.dataset.fallback; return; }
    if (!el.dataset.dead) { el.dataset.dead = 1; el.replaceWith(Object.assign(document.createElement('div'), { className: 'noimg', innerHTML: ICON.camera + 'Photo unavailable' })); }
  }, true);
  function toast(msg, ms = 2600) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }
  const ICON = {
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    camera: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>',
    list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3"/><rect x="3" y="10.5" width="18" height="3"/><rect x="3" y="17" width="18" height="3"/></svg>',
    sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    back: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 18l-6-6 6-6"/></svg>',
  };

  // ---------- theme ----------
  const themeBtn = document.getElementById('theme-btn');
  function paintThemeBtn() { themeBtn.innerHTML = document.documentElement.dataset.theme === 'dark' ? ICON.sun : ICON.moon; }
  themeBtn.onclick = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('hangar-theme', t); } catch (e) {}
    paintThemeBtn();
  };
  paintThemeBtn();

  // ---------- chrome ----------
  function renderTabs(route) {
    const tabs = [['#/', 'Collection', route === 'collection' || route === 'item'], ['#/wishlist', 'Wishlist', route === 'wishlist']];
    if (!VIEW) tabs.push(['#/settings', 'Settings', route === 'settings']);
    let html = tabs.map(([h, l, on]) => `<a href="${h}" class="${on ? 'active' : ''}">${l}</a>`).join('');
    if (!VIEW) html += `<a href="#/add" class="add ${route === 'add' ? 'active' : ''}">+ Add kit</a>`;
    document.getElementById('tabs').innerHTML = html;
    document.getElementById('mode-pill').textContent = VIEW
      ? 'VIEW ONLY · ' + (DB.exported ? new Date(DB.exported).toLocaleDateString('en-GB') : '')
      : (DB.settings.priceProvider === 'ebay' ? 'LIVE · eBay UK' : 'PRICES: DUMMY DATA');
  }

  // ---------- list views ----------
  function listItems(list) {
    const q = state.q.trim().toLowerCase();
    let items = DB.items.filter((i) => i.list === list);
    const counts = { All: items.length };
    for (const i of items) counts[i.grade] = (counts[i.grade] || 0) + 1;
    if (q) items = items.filter((i) => [i.title, i.series, i.grade, gradeName(i.grade), i.notes, i.scale, rrpUnknown(i) ? 'unknown rrp' : ''].join(' ').toLowerCase().includes(q));
    if (state.grade !== 'All') items = items.filter((i) => i.grade === state.grade);
    if (state.review && !VIEW) items = items.filter(needsCheck);
    const key = {
      grade: (i) => String(GRADE_ORDER.indexOf(i.grade)).padStart(2, '0') + '|' + i.title.toLowerCase(),
      name: (i) => i.title.toLowerCase(),
      series: (i) => (i.series || '').toLowerCase(),
      added: (i) => i.added || '',
      paid: (i) => list === 'wishlist' ? (i.targetPrice || 0) : cost(i),
      value: (i) => value(i) || 0,
      pl: (i) => pl(i) || 0,
      plpct: (i) => plPct(i) || 0,
      rrp: (i) => i.rrpJpy || 0,
    }[state.sort] || ((i) => i.title);
    items.sort((a, b) => { const x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : a.title.localeCompare(b.title)) * state.dir; });
    return { items, counts };
  }

  function statsBar(items) {
    if (VIEW) return '';
    const paid = items.reduce((s, i) => s + cost(i), 0);
    const valued = items.filter((i) => value(i) != null);
    const val = valued.reduce((s, i) => s + value(i), 0);
    const gain = valued.reduce((s, i) => s + pl(i), 0);
    const kits = items.reduce((s, i) => s + (i.qty || 1), 0);
    const gifts = items.filter((i) => i.gift).length;
    return `<section class="stats">
      <div class="stat"><div class="stat-label">Models</div><div class="stat-value">${kits}</div><div class="stat-sub">${items.length} entries · ${gifts} gifts</div></div>
      <div class="stat"><div class="stat-label">Total paid</div><div class="stat-value">${gbp(paid)}</div><div class="stat-sub">gifts counted as £0</div></div>
      <div class="stat"><div class="stat-label">Current value</div><div class="stat-value">${gbp(val)}</div><div class="stat-sub">${valued.length}/${items.length} priced</div></div>
      <div class="stat"><div class="stat-label">Profit / loss</div><div class="stat-value ${cls(gain)}">${signed(gain)}</div><div class="stat-sub ${cls(gain)}">${paid ? pct((gain / paid) * 100) + ' on cost' : ''}</div></div>
    </section>`;
  }

  function toolbar(counts, list, shown) {
    const chips = ['All', ...GRADE_ORDER.filter((g) => counts[g])].map((g) =>
      `<button class="chip ${state.grade === g ? 'on' : ''}" data-grade="${g}">${g === 'All' ? 'All' : `<span class="grade g-${g}" style="height:16px;min-width:26px;font-size:11px">${g}</span>`}<span class="n">${counts[g] || 0}</span></button>`).join('');
    const sorts = [['grade', 'Grade'], ['name', 'Name'], ['series', 'Series'], ['added', 'Date added']];
    if (!VIEW) sorts.push(list === 'wishlist' ? ['paid', 'Target price'] : ['paid', 'Price paid'], ['value', 'Current value'], ['rrp', 'RRP']);
    if (!VIEW && list === 'collection') sorts.push(['pl', 'Profit / loss £'], ['plpct', 'Profit / loss %']);
    return `<div class="toolbar">
      <div class="search">${ICON.search}<input id="q" placeholder="Search ${list === 'wishlist' ? 'wishlist' : 'collection'} — name, series, grade…" value="${esc(state.q)}"></div>
      <div class="chips">${chips}</div>
      <select id="sort">${sorts.map(([v, l]) => `<option value="${v}" ${state.sort === v ? 'selected' : ''}>Sort: ${l}</option>`).join('')}</select>
      <button class="icon-btn" id="dir" title="Reverse order">${state.dir > 0 ? '↑' : '↓'}</button>
      <div class="seg"><button data-view="grid" class="${state.view === 'grid' ? 'on' : ''}" title="Grid">${ICON.grid}</button><button data-view="table" class="${state.view === 'table' ? 'on' : ''}" title="Table">${ICON.list}</button></div>
      ${VIEW ? '' : `<button class="chip ${state.review ? 'on' : ''}" id="review" title="Entries with no photo, or a photo auto-matched with low confidence">Check photos<span class="n">${DB.items.filter((i) => i.list === list && needsCheck(i)).length}</span></button>`}
      <span class="result-count">${shown} shown</span>
    </div>`;
  }

  function card(it) {
    const accent = { PG: '#c9a227', MG: '#4a5a70', RG: '#c4161c', HG: '#1d4ea3', EG: '#13955a', SD: '#e0478f', FM: '#6b3fb8', AG: '#0f8fa3', Mega: '#ef6c00' }[it.grade] || '#5c6575';
    let money = '', plTag = '';
    if (!VIEW) {
      if (it.list === 'wishlist') {
        money = `<div class="card-money"><span><span class="now">${gbp(value(it))}</span> <span class="was">now</span></span><span class="was">target ${gbp(it.targetPrice)}</span></div>`;
      } else {
        const p = pl(it);
        if (p != null) plTag = `<span class="pl-pill on-img ${cls(p)}">${signed(p)}</span>`;
        money = `<div class="card-money cm-row"><span class="now">${gbp(value(it))}</span><span class="was">${it.gift ? 'gift' : 'paid ' + gbp(cost(it))}${rrpUnknown(it) ? '' : ` · RRP ${rrpText(it)}`}</span></div>`;
      }
    }
    return `<a class="card" href="#/item/${it.id}" style="--card-accent:${accent}">
      <div class="card-img${it.limited ? ' ltd' : ''}">${imgTag(it)}<span class="grade g-${it.grade}">${it.grade}</span>${it.scale ? `<span class="scale">${esc(it.scale)}</span>` : ''}${it.limited ? '<span class="flag">LIMITED</span>' : '<span class="flag std">STANDARD</span>'}${plTag}</div>
      <div class="card-body"><div class="card-title">${esc(it.title)}${it.qty > 1 ? ` <span class="model-no">×${it.qty}</span>` : ''}</div><div class="card-series">${esc(it.series || '')}</div>${money}</div>
    </a>`;
  }

  function table(items, list) {
    const cols = [['', null], ['Grade', 'grade'], ['Name', 'name'], ['Scale', null], ['Series', 'series']];
    if (!VIEW) {
      if (list === 'wishlist') cols.push(['Target', 'paid', 1], ['RRP', 'rrp', 1], ['Current', 'value', 1]);
      else cols.push(['Paid', 'paid', 1], ['RRP', 'rrp', 1], ['Current', 'value', 1], ['P/L', 'pl', 1], ['P/L %', 'plpct', 1]);
    }
    const head = cols.map(([l, k, n]) => `<th class="${n ? 'num' : ''}" ${k ? `data-sort="${k}"` : ''}>${l}${state.sort === k ? (state.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('');
    const rows = items.map((it) => {
      const src = imgSrc(it);
      let tds = `<td>${src ? `<img class="thumb" src="${esc(src)}" ${it.image && it.image.thumb && !it.image.local ? `data-fallback="${esc(it.image.thumb)}"` : ''} referrerpolicy="no-referrer" loading="lazy" alt="">` : ''}</td>
        <td><span class="grade g-${it.grade}">${it.grade}</span></td><td>${esc(it.title)}${it.qty > 1 ? ' ×' + it.qty : ''}${it.limited ? ' <span class="model-no">LTD</span>' : ''}</td><td class="model-no">${esc(it.scale || '')}</td><td>${esc(it.series || '')}</td>`;
      if (!VIEW) {
        if (list === 'wishlist') tds += `<td class="num">${gbp(it.targetPrice)}</td><td class="num">${rrpText(it)}</td><td class="num">${gbp(value(it))}</td>`;
        else tds += `<td class="num">${it.gift ? 'Gift' : gbp(cost(it))}</td><td class="num ${rrpCls(it)}">${rrpText(it)}</td><td class="num">${gbp(value(it))}</td><td class="num ${cls(pl(it))}">${signed(pl(it))}</td><td class="num ${cls(pl(it))}">${pct(plPct(it))}</td>`;
      }
      return `<tr data-id="${it.id}">${tds}</tr>`;
    }).join('');
    return `<table class="list"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderList(list) {
    const { items, counts } = listItems(list);
    const all = DB.items.filter((i) => i.list === list);
    let html = '';
    if (list === 'collection') html += statsBar(all);
    else if (!VIEW) html += `<section class="stats" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><div class="stat-label">Wanted</div><div class="stat-value">${all.length}</div><div class="stat-sub">kits on the list</div></div>
        <div class="stat"><div class="stat-label">Target spend</div><div class="stat-value">${gbp(all.reduce((s, i) => s + (i.targetPrice || 0), 0))}</div><div class="stat-sub">from your notes</div></div>
        <div class="stat"><div class="stat-label">Market now</div><div class="stat-value">${gbp(all.reduce((s, i) => s + (value(i) || 0), 0))}</div><div class="stat-sub">${all.some((i) => i.current && i.current.dummy) ? 'dummy data' : 'eBay UK'}</div></div></section>`;
    html += toolbar(counts, list, items.length);
    if (!items.length) html += `<div class="empty">Nothing matches.${!VIEW && list === 'wishlist' ? ' Add a kit with “+ Add kit” and choose Wishlist.' : ''}</div>`;
    else html += state.view === 'table' ? table(items, list) : `<div class="grid">${items.map(card).join('')}</div>`;
    html += foot();
    $app.innerHTML = html;
    bindToolbar(list);
  }
  function foot() {
    return `<div class="foot">${VIEW ? 'View-only snapshot · prices hidden' : 'Data: ' + esc(DB.updated ? new Date(DB.updated).toLocaleString('en-GB') : '')} · Unofficial fan-made tracker, not affiliated with Bandai</div>`;
  }
  function bindToolbar(list) {
    const q = document.getElementById('q');
    q.oninput = () => { state.q = q.value; saveUI(); const pos = q.selectionStart; renderList(list); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos, pos); };
    $app.querySelectorAll('[data-grade]').forEach((b) => b.onclick = () => { state.grade = b.dataset.grade; saveUI(); renderList(list); });
    document.getElementById('sort').onchange = (e) => { state.sort = e.target.value; saveUI(); renderList(list); };
    document.getElementById('dir').onclick = () => { state.dir *= -1; saveUI(); renderList(list); };
    $app.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { state.view = b.dataset.view; saveUI(); renderList(list); });
    const rv = document.getElementById('review'); if (rv) rv.onclick = () => { state.review = !state.review; saveUI(); renderList(list); };
    $app.querySelectorAll('th[data-sort]').forEach((th) => th.onclick = () => { if (state.sort === th.dataset.sort) state.dir *= -1; else { state.sort = th.dataset.sort; state.dir = 1; } saveUI(); renderList(list); });
    $app.querySelectorAll('tr[data-id]').forEach((tr) => tr.onclick = () => location.hash = '#/item/' + tr.dataset.id);
  }

  // ---------- item page ----------
  function renderItem(id, edit) {
    const it = DB.items.find((x) => x.id === id);
    if (!it) { $app.innerHTML = `<div class="empty">Entry not found. <a href="#/">Back to collection</a></div>`; return; }
    const backHref = it.list === 'wishlist' ? '#/wishlist' : '#/';
    const src = it.image && (it.image.title || '');
    const spec = [
      ['Grade', `<span class="grade g-${it.grade}">${it.grade}</span> &nbsp;${esc(gradeName(it.grade))}`],
      ['Scale', esc(it.scale || '—')],
      ['Series', esc(it.series || '—')],
      ['Edition', it.limited ? 'Limited / exclusive' : 'Standard release'],
      ['Quantity', it.qty || 1],
      ['Added', esc(it.added || '—')],
    ];
    if (it.notes) spec.push(['Notes', `<span class="model-no">${esc(it.notes)}</span>`]);
    if (!VIEW && it.list === 'wishlist' && it.whereToBuy) spec.push(['Where', esc(it.whereToBuy)]);

    let money = '';
    if (!VIEW) {
      const c = it.current || {};
      const rrpLine = `<div><div class="k">RRP (Japan list price)</div><div class="v">${rrpText(it)}</div><div class="s">${rrpUnknown(it) ? esc((it.rrpSource || '').replace(/^\[unknown\]\s*–?\s*/, '')) : yen(it.rrpJpy) + (it.rrpSource ? ' · ' + esc(it.rrpSource) : '')}${it.rrpUrl ? ' · <a href="#" id="rrpsrc">source</a>' : ''}${rrpProvisional(it) ? ' · <a href="#" id="rrpok" title="Mark this RRP as checked">OK?</a>' : ''}</div><div class="s"><a href="#" id="findrrp">Update RRP</a></div></div>`;
      const curLine = `<div><div class="k">Current value</div><div class="v">${gbp(value(it))}</div><div class="s">${esc(c.source || 'not priced')}${c.samples ? ' · ' + c.samples + ' listings' : ''}</div></div>`;
      if (it.list === 'wishlist') {
        money = `<div class="money"><div><div class="k">Target price</div><div class="v">${gbp(it.targetPrice)}</div><div class="s">from your list</div></div>${curLine}${rrpLine}</div>`;
      } else {
        const p = pl(it);
        money = `<div class="money"><div><div class="k">Price paid</div><div class="v">${it.gift ? 'Gift' : gbp(cost(it), 2)}</div><div class="s">${it.gift ? 'counted as £0' : ''}</div></div>${curLine}<div class="pl"><span class="k">Profit / loss</span><span class="v ${cls(p)}">${signed(p)} <span style="font-size:14px">${pct(plPct(it))}</span></span></div>${rrpLine}
          <div><div class="k">vs RRP</div><div class="v ${cls(it.rrpJpy && Math.abs(rrpGbp(it) - cost(it)) >= 0.5 ? rrpGbp(it) - cost(it) : null)}" style="font-size:18px">${rrpUnknown(it) ? '—' : it.rrpJpy && !it.gift ? (Math.abs(cost(it) - rrpGbp(it)) < 0.5 ? 'Paid RRP' : cost(it) > rrpGbp(it) ? 'Paid ' + gbp(cost(it) - rrpGbp(it)) + ' over' : 'Paid ' + gbp(rrpGbp(it) - cost(it)) + ' under') : '—'}</div></div></div>`;
      }
    }
    const actions = VIEW ? '' : `<div class="actions">
        <button class="btn primary" id="edit">Edit details</button>
        <button class="btn" id="photo">Change photo</button>
        <button class="btn" id="relookup" title="Re-run the online lookup using the current title">Update from name</button>
        <button class="btn" id="reprice">Refresh value</button>
        ${it.list === 'wishlist' ? '<button class="btn red" id="gotit">Got it! Move to collection</button>' : ''}
      </div>
      <div class="danger-row"><span>Remove this entry from your ${it.list === 'wishlist' ? 'wishlist' : 'collection'}</span><button class="link-danger" id="del">Delete entry</button></div>`;

    $app.innerHTML = `<a class="back" href="${backHref}">${ICON.back} Back to ${it.list === 'wishlist' ? 'wishlist' : 'collection'}</a>
      <div class="item">
        <div class="boxart">
          <div class="frame">${imgTag(it)}</div>
          <i class="corner c1"></i><i class="corner c2"></i><i class="corner c3"></i><i class="corner c4"></i>
          <div class="callout">${esc(it.scale || '')} ${esc(it.grade)} · ${esc(it.id.toUpperCase())}</div>
          ${VIEW ? '' : `<div class="photo-src"><span>${it.image ? (it.image.own ? 'Your own photo' : 'Photo found online' + (src ? ': “' + esc(src.slice(0, 80)) + '”' : '')) : 'No photo'}${it.imageReview ? ' · <b style="color:var(--red)">auto-matched — please check</b>' : ''}</span></div>`}
        </div>
        <div class="spec">
          <div class="spec-head"><div class="model-no">ENTRY ${esc(it.id.toUpperCase())} · ${it.list === 'wishlist' ? 'WISHLIST' : 'IN COLLECTION'}</div><h1>${esc(it.title)}</h1><div class="series">${esc(it.series || '')}</div></div>
          <div class="spec-rows">${spec.map(([k, v]) => `<div class="k">${k}</div><div>${v}</div>`).join('')}</div>
          ${money}
          ${actions}
        </div>
      </div>
      <div id="edit-area"></div>${foot()}`;
    if (VIEW) return;
    document.getElementById('edit').onclick = () => editForm(it);
    document.getElementById('photo').onclick = () => photoPicker(it);
    document.getElementById('relookup').onclick = () => relookup(it);
    const fr = document.getElementById('findrrp'); if (fr) fr.onclick = (e) => { e.preventDefault(); rrpIntro(it.limited, () => rrpPicker(it, async (c) => { await applyRrp(it, c); renderItem(it.id); })); };
    const ok = document.getElementById('rrpok'); if (ok) ok.onclick = async (e) => { e.preventDefault(); await API.saveItem({ ...it, rrpSource: 'verified' }); DB = await API.getDB(); toast('RRP marked as checked'); renderItem(it.id); };
    const rs = document.getElementById('rrpsrc'); if (rs) rs.onclick = (e) => { e.preventDefault(); API.openUrl(it.rrpUrl); };
    document.getElementById('reprice').onclick = async () => { DB = await API.refreshPrices([it.id]); toast('Price refreshed'); renderItem(id); };
    document.getElementById('del').onclick = async () => { if (await API.deleteItem(it.id)) { DB = await API.getDB(); location.hash = backHref; } };
    const g = document.getElementById('gotit');
    if (g) g.onclick = () => gotIt(it);
    if (edit) editForm(it);
  }

  function fieldsHTML(d, list) {
    return `<div class="form">
      <label class="span-6">Title<input class="input" name="title" value="${esc(d.title)}" required></label>
      <label class="span-1">Grade<select name="grade">${M.GRADES.filter((g) => g !== 'PGU').map((g) => `<option ${d.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="span-1">Scale<input class="input" name="scale" value="${esc(d.scale || '')}" placeholder="1/144"></label>
      <label class="span-3">Series<input class="input" name="series" value="${esc(d.series || '')}"></label>
      <label class="span-1">Quantity<input class="input" name="qty" type="number" min="1" value="${d.qty || 1}"></label>
      ${list === 'wishlist'
        ? `<label class="span-2">Target price (£)<input class="input" name="targetPrice" type="number" step="0.01" value="${d.targetPrice ?? ''}"></label>
           <label class="span-2">Where to buy<input class="input" name="whereToBuy" value="${esc(d.whereToBuy || '')}"></label>`
        : `<label class="span-2">Price paid (£)<input class="input" name="paid" type="number" step="0.01" value="${d.gift ? '' : (d.paid ?? '')}"></label>
           <label class="span-2 check"><input type="checkbox" name="gift" ${d.gift ? 'checked' : ''}> Gift (counts as £0)</label>`}
      <label class="span-2">RRP (¥, Japan list price)<input class="input" name="rrpJpy" type="number" step="1" value="${d.rrpJpy ?? ''}" placeholder="—"></label>
      <label class="span-2 check"><input type="checkbox" name="limited" ${d.limited ? 'checked' : ''}> Limited / exclusive</label>
      <label class="span-2 check"><input type="checkbox" name="rrpVerified" ${d.rrpSource === 'verified' ? 'checked' : ''}> RRP checked by me</label>
      <label class="span-2">Date added<input class="input" name="added" type="date" value="${esc(d.added || new Date().toISOString().slice(0, 10))}"></label>
      <label class="span-6">Notes<textarea name="notes" rows="2">${esc(d.notes || '')}</textarea></label>
    </div>`;
  }
  function readFields(form, base) {
    const f = new FormData(form); const o = { ...base };
    o.title = (f.get('title') || '').trim(); o.grade = f.get('grade'); o.scale = (f.get('scale') || '').trim(); o.series = (f.get('series') || '').trim();
    o.qty = Math.max(1, parseInt(f.get('qty') || '1', 10)); o.notes = (f.get('notes') || '').trim(); o.added = f.get('added');
    o.limited = !!f.get('limited');
    const r = f.get('rrpJpy'); o.rrpJpy = r === '' ? null : Number(r);
    if (o.rrpJpy == null) o.rrpSource = '[unknown]';
    else if (f.get('rrpVerified') || o.rrpJpy !== base.rrpJpy) { o.rrpSource = 'verified'; if (o.rrpJpy !== base.rrpJpy) delete o.rrpUrl; }
    else if (o.rrpSource === 'verified' || /^\[unknown\]/.test(o.rrpSource || '')) o.rrpSource = 'entered manually';
    if (o.list === 'wishlist') { const t = f.get('targetPrice'); o.targetPrice = t === '' ? null : Number(t); o.whereToBuy = (f.get('whereToBuy') || '').trim(); }
    else { o.gift = !!f.get('gift'); const p = f.get('paid'); o.paid = o.gift || p === '' ? null : Number(p); }
    return o;
  }
  function editForm(it) {
    const area = document.getElementById('edit-area');
    area.innerHTML = `<form class="panel" style="margin-top:20px" id="ef"><h2>Edit details</h2><p class="hint">Changes save to your local collection file.</p>${fieldsHTML(it, it.list)}
      <div class="row" style="margin-top:16px"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="cancel">Cancel</button></div></form>`;
    area.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('cancel').onclick = () => area.innerHTML = '';
    document.getElementById('ef').onsubmit = async (e) => {
      e.preventDefault();
      const o = readFields(e.target, it);
      const renamed = o.title !== it.title;
      await API.saveItem(o);
      DB = await API.refreshPrices([o.id]);
      toast('Saved'); renderItem(it.id);
      if (renamed) relookup(DB.items.find((x) => x.id === o.id), true);
    };
  }

  // ---------- photo picker ----------
  function photoPicker(it, onPick) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    let cands = (it.imageCandidates || []).slice();
    bg.innerHTML = `<div class="modal"><div class="modal-head"><h3>Choose photo</h3><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-body">
        <div class="row"><input class="input" id="pq" style="flex:1" value="${esc(it.title)}"><button class="btn primary" id="ps">Search online</button><button class="btn" id="pf">Use my own photo…</button></div>
        <div class="row" style="margin-top:10px"><input class="input" id="pu" style="flex:1" placeholder="…or paste an image URL"><button class="btn" id="pub">Use URL</button></div>
        <div class="section-title">Candidates</div><div class="cands" id="pc"></div>
      </div></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.onclick = (e) => { if (e.target === bg) close(); };
    bg.querySelector('#x').onclick = close;
    function paint() {
      bg.querySelector('#pc').innerHTML = cands.length ? cands.map((c, i) => `<button class="cand ${it.image && it.image.url === c.u ? 'sel' : ''}" data-i="${i}"><img src="${esc(c.th || c.u)}" data-fallback="${esc(c.u)}" referrerpolicy="no-referrer" loading="lazy" alt=""><span>${esc(c.t || '')}</span></button>`).join('') : '<div class="empty">No candidates — search above.</div>';
      bg.querySelectorAll('.cand').forEach((b) => b.onclick = async () => { const c = cands[+b.dataset.i]; await pick(c); });
    }
    async function pick(c) {
      if (onPick) { onPick(c); close(); return; }
      toast('Saving photo…');
      const updated = await API.setImage(it.id, c);
      if (updated) { updated.imageCandidates = cands; await API.saveItem(updated); }
      DB = await API.getDB(); close(); renderItem(it.id);
    }
    bg.querySelector('#ps').onclick = async () => {
      const b = bg.querySelector('#ps'); b.disabled = true; b.textContent = 'Searching…';
      try { const r = await API.imageSearch(bg.querySelector('#pq').value); cands = M.rankCandidates(it, r).concat(cands.filter((c) => !r.some((x) => x.u === c.u))).slice(0, 24); } catch (e) { toast('Search failed — check your connection'); }
      b.disabled = false; b.textContent = 'Search online'; paint();
    };
    bg.querySelector('#pub').onclick = () => { const u = bg.querySelector('#pu').value.trim(); if (/^https?:\/\//.test(u)) pick({ u, th: null, t: 'Pasted URL' }); };
    bg.querySelector('#pf').onclick = async () => {
      if (onPick) { toast('Save the kit first, then add your own photo from its page'); return; }
      const r = await API.setImageFromFile(it.id); if (r) { DB = await API.getDB(); close(); renderItem(it.id); }
    };
    paint();
  }

  // ---------- RRP lookup ----------
  const rrpProvisional = (i) => !rrpUnknown(i) && i.rrpSource !== 'verified' && /check|suggested|may differ|grade default/i.test(i.rrpSource || '');
  function rrpIntro(limited, go, title = 'Update RRP', lead = '', yes = 'Continue', no = 'Cancel') {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" style="width:min(480px,100%)"><div class="modal-head"><h3>${title}</h3><button class="icon-btn" id="x">✕</button></div><div class="modal-body">
      <p style="margin-top:0">${lead}${limited ? 'This kit is marked as limited / exclusive, so it probably isn’t listed. ' : ''}RRPs come from Bic Camera, which only lists standard retail kits. Limited editions, event and Gundam Base exclusives, Premium Bandai, gashapon and other non-retail items may not return a price.</p>
      <div class="row" style="margin-top:16px"><button class="btn primary" id="go">${yes}</button><button class="btn" id="no">${no}</button></div></div></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.querySelector('#x').onclick = close; bg.querySelector('#no').onclick = close; bg.onclick = (e) => { if (e.target === bg) close(); };
    bg.querySelector('#go').onclick = () => { close(); go(); };
  }
  async function applyRrp(it, c) {
    const o = { ...DB.items.find((x) => x.id === it.id) || it, rrpJpy: c.priceJpy, rrpSource: 'suggested (Bic Camera)', rrpUrl: c.url };
    await API.saveItem(o); DB = await API.refreshPrices([o.id]); return o;
  }
  function candRow(c, i, best) {
    return `<div class="rrp-cand${i === 0 && best ? ' best' : ''}"><div class="rrp-t">${esc(c.title)}<div class="model-no">${c.released ? 'Released ' + esc(c.released) + ' · ' : ''}match score ${c.score}</div></div>
      <div class="rrp-p">${yen(c.priceJpy)}<div class="model-no">${gbp(c.priceJpy / rate())}</div></div>
      <div class="rrp-b"><button class="btn" type="button" data-view="${i}">View</button><button class="btn primary" type="button" data-use="${i}">Use</button></div></div>`;
  }
  function rrpPicker(it, onUse) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal"><div class="modal-head"><h3>Update RRP</h3><button class="icon-btn" id="x">✕</button></div><div class="modal-body">
      <div class="row"><input class="input" id="rq" style="flex:1" value="${esc(it.title)}"><button class="btn primary" id="rs">Search again</button></div>
      <p class="hint" style="margin:10px 0">Official maker price (tax incl.) from Bic Camera. Check it's the same kit before using it.</p><div id="rl"></div></div></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove(); bg.querySelector('#x').onclick = close; bg.onclick = (e) => { if (e.target === bg) close(); };
    const run = async (title) => {
      const rl = bg.querySelector('#rl'); rl.innerHTML = '<div class="empty">Searching Bic Camera…</div>';
      let r; try { r = await API.findRrp({ ...it, title }); } catch (e) { rl.innerHTML = '<div class="empty">Search failed — check your connection.</div>'; return; }
      if (!document.body.contains(bg)) return;
      if (!r.candidates.length) { rl.innerHTML = `<div class="empty">No priced match found for “${esc(r.query)}”. Try a simpler name, or the Japanese name.</div>`; return; }
      rl.innerHTML = `<div class="model-no" style="margin-bottom:6px">Searched: ${esc(r.query)}</div>` + r.candidates.map((c, i) => candRow(c, i, true)).join('');
      rl.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => API.openUrl(r.candidates[+b.dataset.view].url));
      rl.querySelectorAll('[data-use]').forEach((b) => b.onclick = async () => { b.disabled = true; await onUse(r.candidates[+b.dataset.use]); close(); toast('RRP updated'); });
    };
    bg.querySelector('#rs').onclick = () => run(bg.querySelector('#rq').value.trim());
    run(it.title);
  }
  function bulkRrp() {
    const todo = DB.items.filter((i) => rrpUnknown(i) && !/never sold/.test(i.rrpSource || ''));
    if (!todo.length) { toast('Every kit already has an RRP'); return; }
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" style="width:min(1000px,100%)"><div class="modal-head"><h3>Update missing RRPs</h3><button class="icon-btn" id="x">✕</button></div><div class="modal-body">
      <p class="hint" style="margin-top:0">Looking up ${todo.length} kits on Bic Camera, one at a time (about 10 seconds each). Strong matches are ticked; check each before applying.</p>
      <div class="row" style="margin-bottom:12px"><span class="progress" id="bp">Starting…</span><span class="spacer" style="flex:1"></span><button class="btn" id="stop" disabled>Stop</button><button class="btn primary" id="apply" disabled>Apply ticked</button></div>
      <table class="list" style="box-shadow:none"><thead><tr><th></th><th>Your kit</th><th>Best match on Bic Camera</th><th class="num">RRP</th><th></th></tr></thead><tbody id="bt"></tbody></table></div></div>`;
    document.body.appendChild(bg);
    let stopped = false; const found = {};
    const close = () => { stopped = true; bg.remove(); if (location.hash.startsWith('#/settings')) renderSettings(); };
    bg.querySelector('#x').onclick = close; bg.querySelector('#stop').onclick = (e) => { stopped = true; e.target.disabled = true; };
    const tb = bg.querySelector('#bt');
    tb.innerHTML = todo.map((it) => `<tr data-id="${it.id}"><td><input type="checkbox" disabled></td><td>${esc(it.title)}</td><td class="m model-no">waiting</td><td class="num p"></td><td class="v"></td></tr>`).join('');
    (async () => {
      let n = 0; bg.querySelector('#stop').disabled = false;
      for (const it of todo) {
        if (stopped) break;
        const tr = tb.querySelector(`tr[data-id="${it.id}"]`); tr.querySelector('.m').textContent = 'searching…';
        bg.querySelector('#bp').textContent = `Checking ${++n} of ${todo.length}`;
        try {
          const r = await API.findRrp(it); const c = r.candidates[0];
          if (!document.body.contains(bg)) return;
          if (c) {
            found[it.id] = c; const cb = tr.querySelector('input'); cb.disabled = false; cb.checked = c.score >= 8;
            tr.querySelector('.m').innerHTML = `<span style="font-family:var(--font);font-size:13px;color:var(--ink)">${esc(c.title)}</span><br>score ${c.score}`;
            tr.querySelector('.p').textContent = yen(c.priceJpy);
            tr.querySelector('.v').innerHTML = '<a href="#">view</a>'; tr.querySelector('.v a').onclick = (e) => { e.preventDefault(); API.openUrl(c.url); };
          } else tr.querySelector('.m').textContent = 'no match';
        } catch (e) { tr.querySelector('.m').textContent = 'search failed'; }
        bg.querySelector('#apply').disabled = !Object.keys(found).length;
      }
      if (document.body.contains(bg)) { bg.querySelector('#bp').textContent = stopped ? 'Stopped' : 'Done'; bg.querySelector('#stop').disabled = true; }
    })();
    bg.querySelector('#apply').onclick = async (e) => {
      e.target.disabled = true; let k = 0;
      for (const tr of tb.querySelectorAll('tr')) { const cb = tr.querySelector('input'); const c = found[tr.dataset.id]; if (cb.checked && c) { await applyRrp(DB.items.find((x) => x.id === tr.dataset.id), c); k++; } }
      toast(`${k} RRP${k === 1 ? '' : 's'} applied`); close();
    };
  }

  // ---------- update details from the (corrected) name ----------
  async function relookup(it, afterRename) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal"><div class="modal-head"><h3>Update from name</h3><button class="icon-btn" id="x">✕</button></div>
      <div class="modal-body"><p style="margin-top:0">${afterRename ? 'You changed the title. ' : ''}Looking up <b>${esc(it.title)}</b>…</p></div></div>`;
    document.body.appendChild(bg);
    const close = () => bg.remove();
    bg.querySelector('#x').onclick = close;
    let auto;
    try { auto = await API.autofill(it.title); } catch (e) { auto = { ...M.parseName(it.title), imageCandidates: [] }; }
    auto.rrpJpy = null; // RRP is offered separately after applying
    if (!document.body.contains(bg)) return;
    const fmt = { rrpJpy: yen, limited: (v) => v ? 'Limited' : 'Standard' };
    const rows = [['grade', 'Grade'], ['scale', 'Scale'], ['series', 'Series'], ['limited', 'Edition'], ['rrpJpy', 'RRP']]
      .filter(([k]) => auto[k] !== undefined && auto[k] !== null && auto[k] !== '' && auto[k] !== it[k])
      .map(([k, l]) => {
        // RRP from a lookup is only a grade default: don't pre-tick it if the current one is verified or the grade is unchanged
        const on = true;
        const f = fmt[k] || ((v) => esc(v || '—'));
        return `<tr><td><label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''}> ${l}</label></td><td>${f(it[k])}</td><td><b>${f(auto[k])}</b></td></tr>`;
      }).join('');
    const cands = auto.imageCandidates || [];
    let chosen = cands[0] || null;
    const paint = () => cands.slice(0, 12).map((c, i) => `<button type="button" class="cand ${chosen === c ? 'sel' : ''}" data-i="${i}"><img src="${esc(c.th || c.u)}" data-fallback="${esc(c.u)}" referrerpolicy="no-referrer" alt=""><span>${esc(c.t)}</span></button>`).join('');
    bg.querySelector('.modal-body').innerHTML = `
      <p style="margin-top:0">New details found for <b>${esc(it.title)}</b>. Tick what to apply — the title and price paid stay as you set them.</p>
      ${rows ? `<table class="list" style="box-shadow:none"><thead><tr><th>Field</th><th>Current</th><th>Suggested</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="hint">Grade, scale and series already match.</p>'}
      <div class="section-title">Photo</div>
      <div class="row" style="margin-bottom:10px"><label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="keep"> Keep current photo</label></div>
      <div class="cands" id="rc">${cands.length ? paint() : '<div class="empty">No photos found online — keeping the current one.</div>'}</div>
      <div class="note">Current value will be refreshed after applying.</div>
      <div class="row" style="margin-top:16px"><button class="btn primary" id="apply">Apply</button><button class="btn" id="cancel">Cancel</button></div>`;
    const bind = () => bg.querySelectorAll('#rc .cand').forEach((b) => b.onclick = () => { chosen = cands[+b.dataset.i]; bg.querySelector('#keep').checked = false; bg.querySelector('#rc').innerHTML = paint(); bind(); });
    bind();
    if (!cands.length) bg.querySelector('#keep').checked = true;
    bg.querySelector('#cancel').onclick = close;
    bg.querySelector('#apply').onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'Applying…';
      const o = { ...it };
      bg.querySelectorAll('[data-k]:checked').forEach((cb) => { o[cb.dataset.k] = auto[cb.dataset.k]; });
      if (cands.length) o.imageCandidates = cands;
      await API.saveItem(o);
      if (chosen && !bg.querySelector('#keep').checked) await API.setImage(o.id, chosen);
      DB = await API.refreshPrices([o.id]);
      close(); toast('Updated'); renderItem(o.id);
      const fresh = DB.items.find((x) => x.id === o.id) || o;
      rrpIntro(fresh.limited, () => rrpPicker(fresh, async (c) => { await applyRrp(fresh, c); renderItem(o.id); }), 'Update the RRP too?', 'This takes about 10 seconds. ', 'Update RRP', 'Not now');
    };
  }

  // ---------- wishlist → collection ----------
  function gotIt(it) {
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" style="width:min(460px,100%)"><div class="modal-head"><h3>Got it!</h3><button class="icon-btn" id="x">✕</button></div>
      <form class="modal-body" id="gf"><p style="margin-top:0">Move <b>${esc(it.title)}</b> into your collection.</p>
      <div class="form"><label class="span-3">Price paid (£)<input class="input" name="paid" type="number" step="0.01" value="${it.targetPrice ?? ''}" required></label>
      <label class="span-3">Date<input class="input" name="added" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="span-6 check"><input type="checkbox" name="gift"> It was a gift</label></div>
      <div class="row" style="margin-top:16px"><button class="btn red" type="submit">Move to collection</button></div></form></div>`;
    document.body.appendChild(bg);
    bg.querySelector('#x').onclick = () => bg.remove();
    const gift = bg.querySelector('[name=gift]'), paid = bg.querySelector('[name=paid]');
    gift.onchange = () => { paid.required = !gift.checked; paid.disabled = gift.checked; };
    bg.querySelector('#gf').onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      const o = { ...it, list: 'collection', gift: !!f.get('gift'), paid: f.get('gift') ? null : Number(f.get('paid')), added: f.get('added'), id: newId('c') };
      delete o.targetPrice;
      await API.saveItem(o);
      await API.removeItem(it.id);
      DB = await API.getDB();
      bg.remove(); toast('Added to collection'); location.hash = '#/item/' + o.id;
    };
  }
  function newId(prefix) {
    let n = 1; const ids = new Set(DB.items.map((i) => i.id));
    while (ids.has(prefix + String(n).padStart(3, '0'))) n++;
    return prefix + String(n).padStart(3, '0');
  }

  // ---------- add ----------
  function renderAdd() {
    $app.innerHTML = `<div class="panel" style="max-width:980px">
      <h2>Add a kit</h2><p class="hint">Type the name the way you'd write it (e.g. “HG Gundam Aerial” or “MG3 RX-78-2”) and what you paid. HANGAR fills in the rest, then you check it before saving.</p>
      <form id="af"><div class="form">
        <label class="span-3">Name<input class="input" name="name" required autofocus placeholder="e.g. RG Zaku II"></label>
        <label class="span-1">Price paid (£)<input class="input" name="paid" type="number" step="0.01"></label>
        <label class="span-2">Add to<select name="list"><option value="collection">Collection</option><option value="wishlist">Wishlist (price = target)</option></select></label>
        <label class="span-2 check"><input type="checkbox" name="gift"> Gift</label>
      </div><div class="row" style="margin-top:16px"><button class="btn red" type="submit" id="lk">Look up details</button></div></form>
      <div id="review"></div></div>`;
    document.getElementById('af').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target); const btn = document.getElementById('lk');
      btn.disabled = true; btn.textContent = 'Looking up…';
      let auto;
      try { auto = await API.autofill(f.get('name')); } catch (err) { auto = { ...M.parseName(f.get('name')), imageCandidates: [] }; }
      btn.disabled = false; btn.textContent = 'Look up again';
      const list = f.get('list'); const price = f.get('paid') === '' ? null : Number(f.get('paid'));
      const draft = {
        id: newId(list === 'wishlist' ? 'w' : 'c'), list, title: auto.title, grade: auto.grade, scale: auto.scale, series: auto.series,
        limited: auto.limited, qty: 1, notes: '', original: f.get('name'), rrpJpy: auto.rrpJpy, rrpSource: auto.rrpSource || 'grade default',
        gift: list === 'collection' && !!f.get('gift'), paid: list === 'collection' && !f.get('gift') ? price : null,
        targetPrice: list === 'wishlist' ? price : undefined, image: null, imageCandidates: auto.imageCandidates || [], added: new Date().toISOString().slice(0, 10),
      };
      let chosen = draft.imageCandidates[0] || null;
      const rv = document.getElementById('review');
      const paintCands = () => `<div class="cands">${draft.imageCandidates.slice(0, 12).map((c, i) => `<button type="button" class="cand ${chosen === c ? 'sel' : ''}" data-i="${i}"><img src="${esc(c.th || c.u)}" data-fallback="${esc(c.u)}" referrerpolicy="no-referrer" alt=""><span>${esc(c.t)}</span></button>`).join('') || '<div class="empty">No photos found — you can add one after saving.</div>'}</div>`;
      rv.innerHTML = `<form id="rf"><div class="section-title">Check the details</div>${fieldsHTML(draft, list)}
        <div class="note" id="rrpsug">Looking up RRP on Bic Camera…</div>
        <div class="note">RRP starts blank — enter the Japanese list price if you know it. Current value uses ${DB.settings.priceProvider === 'ebay' ? 'eBay UK listings' : 'dummy data until eBay access is approved'}.</div>
        <div class="section-title">Pick a photo</div><div id="cw">${paintCands()}</div>
        <div class="row" style="margin-top:18px"><button class="btn primary" type="submit">Save to ${list}</button></div></form>`;
      let pickedRrp = null;
      const showSug = (c) => { const el = document.getElementById('rrpsug'); if (!el) return;
        if (!c) { el.innerHTML = 'No RRP found automatically. <a href="#" id="rrpmore">Search manually</a>'; }
        else el.innerHTML = `Suggested RRP <b>${yen(c.priceJpy)}</b> from “${esc(c.title)}” <a href="#" id="rrpuse">Use</a> · <a href="#" id="rrpmore">Other matches</a>`;
        const u = document.getElementById('rrpuse'); if (u) u.onclick = (e) => { e.preventDefault(); setR(c); };
        document.getElementById('rrpmore').onclick = (e) => { e.preventDefault(); rrpPicker({ ...draft, title: document.querySelector('#rf [name=title]').value }, async (cc) => setR(cc)); }; };
      const setR = (c) => { pickedRrp = c; document.querySelector('#rf [name=rrpJpy]').value = c.priceJpy; document.getElementById('rrpsug').innerHTML = `RRP set to <b>${yen(c.priceJpy)}</b> from Bic Camera.`; };
      API.findRrp(draft).then((r) => showSug(r.candidates[0] && r.candidates[0].score >= 4 ? r.candidates[0] : null)).catch(() => showSug(null));
      const bindC = () => document.querySelectorAll('#cw .cand').forEach((b) => b.onclick = () => { chosen = draft.imageCandidates[+b.dataset.i]; document.getElementById('cw').innerHTML = paintCands(); bindC(); });
      bindC();
      document.getElementById('rf').onsubmit = async (ev) => {
        ev.preventDefault();
        const o = readFields(ev.target, draft);
        if (pickedRrp && o.rrpJpy === pickedRrp.priceJpy && !new FormData(ev.target).get('rrpVerified')) { o.rrpSource = 'suggested (Bic Camera)'; o.rrpUrl = pickedRrp.url; }
        await API.saveItem(o);
        if (chosen) await API.setImage(o.id, chosen);
        DB = await API.refreshPrices([o.id]);
        toast('Saved'); location.hash = '#/item/' + o.id;
      };
    };
  }

  // ---------- settings ----------
  async function renderSettings() {
    const s = DB.settings; const paths = await API.paths();
    $app.innerHTML = `<div class="settings-grid">
      <form class="panel" id="sf"><h2>Prices</h2><p class="hint">Where “current value” comes from.</p>
        <div class="form">
          <label class="span-6 check"><input type="radio" name="priceProvider" value="dummy" ${s.priceProvider !== 'ebay' ? 'checked' : ''}> Dummy data (placeholder values derived from RRP)</label>
          <label class="span-6 check"><input type="radio" name="priceProvider" value="ebay" ${s.priceProvider === 'ebay' ? 'checked' : ''}> eBay UK — median asking price of new, Buy It Now listings</label>
          <label class="span-3">eBay App ID (Client ID)<input class="input" name="ebayAppId" value="${esc(s.ebayAppId || '')}" autocomplete="off"></label>
          <label class="span-3">eBay Cert ID (Client Secret)<input class="input" name="ebayCertId" type="password" value="${esc(s.ebayCertId || '')}" autocomplete="off"></label>
          <label class="span-3">Yen per £1<input class="input" name="jpyPerGbp" type="number" step="0.01" value="${s.jpyPerGbp || 200}"></label>
          <div class="span-3" style="align-self:end"><button class="btn" type="button" id="fx">Update rate online</button></div>
        </div>
        <p class="hint" style="margin-top:10px">${s.fxUpdated ? 'Rate updated ' + esc(s.fxUpdated) : 'Rate not yet updated online'} · keys are stored only in your local data file.</p>
        <div class="row"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="rp">Refresh all values</button></div>
      </form>
      <form class="panel" id="gf2"><h2>View-only page</h2><p class="hint">Exports a static web page of your collection with <b>all price data removed</b> (paid, RRP, current values, P&amp;L, wishlist targets).</p>
        <div class="row"><button class="btn red" type="button" id="ex">${s.githubPublish ? 'Export &amp; publish' : 'Export view-only snapshot'}</button><button class="btn" type="button" id="exo">Open folder</button></div>
        <p class="hint" style="margin-top:12px">Saved to: <span class="model-no">${esc(paths.view)}</span></p>
        <div class="section-title">Publish to GitHub</div>
        <div class="form">
          <label class="span-6 check"><input type="checkbox" name="githubPublish" ${s.githubPublish ? 'checked' : ''}> Also publish to GitHub every time I export</label>
          <label class="span-4">Repository (owner/name)<input class="input" name="githubRepo" value="${esc(s.githubRepo || 'tijayfly/personal-gunpla-library')}"></label>
          <label class="span-2">Branch<input class="input" name="githubBranch" value="${esc(s.githubBranch || '')}" placeholder="default"></label>
          <label class="span-6">Access token<input class="input" name="githubToken" type="password" value="${esc(s.githubToken || '')}" autocomplete="off" placeholder="github_pat_…"></label>
        </div>
        <p class="hint" style="margin-top:10px">Use a fine-grained token limited to this one repo with <b>Contents: Read and write</b>. It's stored only in your local data file. Only HANGAR's own files are changed in the repo; anything else (README etc.) is left alone.</p>
        <div class="row"><button class="btn primary" type="submit">Save GitHub settings</button><button class="btn" type="button" id="pub">Publish now</button>${s.githubRepo ? `<button class="btn" type="button" id="ghopen">Open repo</button>` : ''}</div>
        <p class="hint" id="ghstatus" style="margin-top:12px">${s.githubLast ? 'Last published ' + esc(new Date(s.githubLast.at).toLocaleString('en-GB')) + (s.githubLast.changed ? ` · ${s.githubLast.uploaded} file(s) updated${s.githubLast.removed ? ', ' + s.githubLast.removed + ' removed' : ''}` : ' · no changes') : 'Not published yet.'}</p>
      </form>
      <div class="panel"><h2>Photos</h2><p class="hint">Photos are downloaded once and kept with your data so they work offline.</p>
        <div class="row"><button class="btn" id="ci">Download any missing photos</button></div>
        <p class="hint" style="margin-top:12px">Photos to check (missing, or auto-matched with low confidence): <a href="#/" id="chk-c">${DB.items.filter((i) => i.list === 'collection' && needsCheck(i)).length} in collection</a> · <a href="#/wishlist" id="chk-w">${DB.items.filter((i) => i.list === 'wishlist' && needsCheck(i)).length} in wishlist</a>. Picking a new photo clears the flag.</p>
      </div>
      <div class="panel"><h2>RRP lookup</h2><p class="hint">Finds official maker prices (tax incl.) on Bic Camera for kits with no RRP. Works best for standard kits; event exclusives and gashapon usually aren't listed.</p>
        <div class="row"><button class="btn primary" id="bulkrrp">Update missing RRPs</button><span class="model-no">${DB.items.filter((i) => rrpUnknown(i)).length} without an RRP</span></div>
      </div>
      <div class="panel"><h2>Data</h2><p class="hint">Everything lives in one JSON file plus an images folder. A backup of the previous version is kept on every save.</p>
        <div class="row"><button class="btn" id="od">Open data folder</button></div>
        <p class="hint" style="margin-top:12px"><span class="model-no">${esc(paths.data)}</span></p>
      </div>
    </div>${foot()}`;
    document.getElementById('sf').onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      const ns = { priceProvider: f.get('priceProvider'), ebayAppId: f.get('ebayAppId').trim(), ebayCertId: f.get('ebayCertId').trim(), jpyPerGbp: Number(f.get('jpyPerGbp')) || 200 };
      if (ns.priceProvider === 'ebay' && (!ns.ebayAppId || !ns.ebayCertId)) { toast('Add both eBay keys first — staying on dummy data'); ns.priceProvider = 'dummy'; }
      DB.settings = await API.saveSettings(ns); toast('Settings saved'); renderTabs('settings');
    };
    document.getElementById('fx').onclick = async () => { DB.settings = await API.refreshFx(); toast('Rate: ¥' + DB.settings.jpyPerGbp + ' per £'); renderSettings(); };
    document.getElementById('rp').onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Refreshing…'; DB = await API.refreshPrices(); toast('Prices refreshed'); renderSettings(); };
    const doExport = async (publish) => {
      const st = document.getElementById('ghstatus'); st.textContent = publish ? 'Exporting and publishing to GitHub…' : 'Exporting…';
      const r = await API.exportViewOnly(publish === undefined ? undefined : { publish });
      DB = await API.getDB();
      if (r.publishError) { st.innerHTML = '<b style="color:var(--loss)">Publish failed:</b> ' + esc(r.publishError); toast('Exported, but publishing failed'); return; }
      if (r.github) { st.textContent = r.github.changed ? `Published: ${r.github.uploaded} file(s) updated${r.github.removed ? ', ' + r.github.removed + ' removed' : ''}.` : 'Published: GitHub was already up to date.'; toast('Exported & published'); }
      else { st.textContent = `Exported ${r.count} entries.`; toast(`Exported ${r.count} entries`); }
    };
    document.getElementById('ex').onclick = () => doExport();
    document.getElementById('pub').onclick = () => doExport(true);
    const gho = document.getElementById('ghopen'); if (gho) gho.onclick = () => API.openUrl('https://github.com/' + DB.settings.githubRepo);
    document.getElementById('gf2').onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      DB.settings = await API.saveSettings({ githubPublish: !!f.get('githubPublish'), githubRepo: f.get('githubRepo').trim(), githubBranch: f.get('githubBranch').trim(), githubToken: f.get('githubToken').trim() });
      toast('GitHub settings saved'); renderSettings();
    };
    document.getElementById('exo').onclick = () => API.openPath(paths.view);
    document.getElementById('od').onclick = () => API.openPath(paths.data);
    ['chk-c', 'chk-w'].forEach((id) => document.getElementById(id).onclick = () => { state.review = true; state.grade = 'All'; state.q = ''; saveUI(); });
    document.getElementById('bulkrrp').onclick = () => rrpIntro(false, bulkRrp);
    document.getElementById('ci').onclick = () => { API.cacheImages(); toast('Downloading photos in the background'); };
  }

  // ---------- router ----------
  // remember where you were in each list, so Back returns to the same spot
  const listScroll = {}; let lastKey = null;
  const routeKey = (h) => { const [a, b] = h.split('/'); return a === 'item' && b ? 'item' : a === 'wishlist' ? 'wishlist' : a === 'add' || a === 'settings' ? a : 'collection'; };
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [a, b, c] = h.split('/');
    const key = routeKey(h), y = window.scrollY;
    if (lastKey === 'collection' || lastKey === 'wishlist') listScroll[lastKey] = y;
    const fromItem = lastKey === 'item', same = key === lastKey && key !== 'item';
    lastKey = key;
    if (a === 'item' && b) { renderTabs('item'); renderItem(b, c === 'edit'); }
    else if (a === 'wishlist') { renderTabs('wishlist'); renderList('wishlist'); }
    else if (a === 'add' && !VIEW) { renderTabs('add'); renderAdd(); }
    else if (a === 'settings' && !VIEW) { renderTabs('settings'); renderSettings(); }
    else { renderTabs('collection'); renderList('collection'); }
    const target = same ? y : fromItem && listScroll[key] ? listScroll[key] : 0;
    window.scrollTo(0, target);
    if (target) { requestAnimationFrame(() => window.scrollTo(0, target)); setTimeout(() => window.scrollTo(0, target), 250); }
  }

  async function boot() {
    if (VIEW) { DB = window.HANGAR_SNAPSHOT || { items: [] }; DB.settings = {}; }
    else {
      DB = await API.getDB();
      API.on('db-changed', async () => { DB = await API.getDB(); if (!document.querySelector('.modal-bg') && !document.getElementById('rf') && !document.getElementById('ef')) route(); });
      API.on('progress', (p) => { const el = document.getElementById('progress'); el.textContent = p.done < p.total ? (p.kind === 'github' ? `Uploading to GitHub ${p.done}/${p.total}` : `Downloading photos ${p.done}/${p.total}`) : ''; });
    }
    DB.items = DB.items.filter((i) => i.list === 'collection' || i.list === 'wishlist');
    window.addEventListener('hashchange', route);
    // floating back-to-top button
    const top = document.createElement('button');
    top.className = 'to-top'; top.title = 'Back to top'; top.setAttribute('aria-label', 'Back to top'); top.textContent = '↑';
    top.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.appendChild(top);
    const onScroll = () => top.classList.toggle('show', window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    route(); onScroll();
  }
  boot();
})();
