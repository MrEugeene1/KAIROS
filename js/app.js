/* KAIROS — the app. */
(function () {
  'use strict';
  const T = window.KTime;
  const P = window.KParser;
  const store = new window.KStore.Store();

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#1F6F5C');
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  const COLORS = ['#E76F51', '#3A86FF', '#8338EC', '#2A9D8F', '#F72585', '#6A994E', '#FF9F1C', '#4D5BCE', '#C2185B', '#00897B'];
  const EMOJI = ['🦊', '🌻', '🐢', '🐻', '🐱', '🐶', '🐼', '🦁', '🐸', '🦄', '🐝', '🐙', '🌈', '⭐', '🌙', '🍀', '🍓', '⚽', '🎸', '📚', '👵', '👴', '👶', '❤️'];
  const REPEAT_LABEL = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };
  const REPEAT_SHORT = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
  const REMIND_LABEL = { 0: 'now', 10: 'in 10 min', 30: 'in 30 min', 60: 'in 1 hour', 1440: 'tomorrow' };

  const ui = {
    selected: T.toKey(new Date()),
    weekStart: T.startOfWeek(new Date()),
    filter: null,
    justAdded: null,
    lastMinute: null,
    today: T.toKey(new Date()),
    timelineSig: '',
    momentIds: new Set(),
  };

  // ---------- Formatting ----------
  const hhmm = (d) => `${T.pad(d.getHours())}:${T.pad(d.getMinutes())}`;
  const shortDay = (key) => { const d = T.fromKey(key); return `${T.WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${T.MONTHS[d.getMonth()].slice(0, 3)}`; };
  const longDay = (key) => { const d = T.fromKey(key); return `${T.WEEKDAYS[d.getDay()]} ${d.getDate()} ${T.MONTHS[d.getMonth()]}`; };
  function relDay(key) {
    const diff = T.daysBetween(ui.today, key);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    return null;
  }
  function inMinutes(ms) {
    const m = Math.max(1, Math.ceil(ms / 60000));
    if (m < 60) return `In ${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `In ${h} h ${r} min` : `In ${h} h`;
  }
  const timeRange = (ev) => (ev.start ? `${ev.start} – ${ev.end || T.fromMin(T.toMin(ev.start) + 60)}` : 'All day');

  // ---------- People & faces ----------
  const person = (id) => store.person(id);
  function faceHTML(p, extra = '') {
    if (!p) return '';
    const inner = p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(p.emoji || initials(p.name));
    return `<span class="face${!p.photo && p.emoji ? ' is-emoji' : ''} ${extra}" style="--c:${safeColor(p.color)}" title="${esc(p.name)}">${inner}</span>`;
  }
  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function facesHTML(ids, max = 4) {
    const ps = ids.map(person).filter(Boolean);
    if (!ps.length) return '';
    const more = ps.length > max ? `<span class="faces-more">+${ps.length - max}</span>` : '';
    return `<span class="faces" aria-label="${esc(namesOf(ids))}">${ps.slice(0, max).map((p) => faceHTML(p)).join('')}${more}</span>`;
  }
  function namesOf(ids) {
    const ps = ids.map(person).filter(Boolean);
    if (ps.length && ps.length === store.state.people.length && ps.length > 2) return 'Everyone';
    const n = ps.map((p) => p.name);
    return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`;
  }
  const eventColor = (ev) => safeColor((person(ev.people[0]) || {}).color || '#1F6F5C');
  const visibleEvents = () => (ui.filter ? store.state.events.filter((e) => e.people.includes(ui.filter)) : store.state.events);

  // ---------- Theme ----------
  function applyTheme(choice) {
    const root = document.documentElement;
    if (choice === 'light' || choice === 'dark') root.dataset.theme = choice; else delete root.dataset.theme;
    ls.set('kairos.theme', choice);
    $$('[data-theme-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice)));
  }
  const isDark = () => document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

  // ---------- Sky ----------
  // [hour, top colour, bottom colour, stars]
  const SKY = [
    [0, '#0B1633', '#26335E', 1], [4.5, '#141F45', '#3E416F', 1], [6, '#F3A98C', '#FCE0CC', 0], [8, '#FBD3B8', '#FDEFE3', 0],
    [10, '#A8D8F6', '#E6F3FB', 0], [12.5, '#5DB4EF', '#C8E9FF', 0], [15.5, '#7FC3F0', '#F1E7CB', 0], [17.5, '#F7A25E', '#FCD7A6', 0],
    [19, '#E4733F', '#F8B77E', 0], [20.3, '#4A3A78', '#B8657B', 0.5], [21.3, '#0F1A3D', '#2A3663', 1], [24, '#0B1633', '#26335E', 1],
  ];
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`; };
  const lum = (h) => { const [r, g, b] = hex2rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

  function renderSky(now) {
    const h = now.getHours() + now.getMinutes() / 60;
    let i = SKY.findIndex((k) => k[0] > h) - 1;
    if (i < 0) i = SKY.length - 2;
    const [h0, t0, b0, s0] = SKY[i], [h1, t1, b1, s1] = SKY[i + 1];
    const t = (h - h0) / (h1 - h0);
    const top = mix(t0, t1, t), bottom = mix(b0, b1, t);
    const root = document.documentElement.style;
    root.setProperty('--sky-top', top);
    root.setProperty('--sky-bottom', bottom);
    root.setProperty('--stars', (s0 + (s1 - s0) * t).toFixed(2));
    $('#logoHand').style.transform = `rotate(${(((now.getHours() % 12) * 60 + now.getMinutes()) / 720) * 360}deg)`;
    $('#greeting').textContent = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Good night';
    $('#clock').textContent = hhmm(now);
    $('#heroDate').textContent = longDay(T.toKey(now));
  }

  // ---------- Live now & starting soon ----------
  function renderMoment(now) {
    const events = visibleEvents();
    const live = T.liveAt(events, now);
    const soon = T.startingSoon(events, now, 10);
    const cards = [];
    for (const o of live) {
      const pct = Math.min(100, Math.max(0, ((now - o.start) / (o.end - o.start)) * 100));
      const endsTomorrow = T.toKey(o.end) !== T.toKey(now);
      cards.push({
        id: `live:${o.ev.id}:${o.key}`,
        html: `<button type="button" class="moment-card live" data-edit="${esc(o.ev.id)}">
          <span class="moment-kicker"><span class="pulse" aria-hidden="true"></span>Live now</span>
          <span class="moment-title">${esc(o.ev.title)}</span>
          <span class="moment-big">Until ${hhmm(o.end)}${endsTomorrow ? '<small> tmrw</small>' : ''}</span>
          <span class="moment-meta">${facesHTML(o.ev.people)}<span>${esc(namesOf(o.ev.people) || 'For everyone')}</span></span>
          <span class="progress" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></span>
        </button>`,
      });
    }
    for (const o of soon) {
      cards.push({
        id: `soon:${o.ev.id}:${o.key}`,
        html: `<button type="button" class="moment-card soon" data-edit="${esc(o.ev.id)}">
          <span class="moment-kicker">Starting soon</span>
          <span class="moment-title">${esc(o.ev.title)}</span>
          <span class="moment-big">${inMinutes(o.start - now)}</span>
          <span class="moment-meta">${facesHTML(o.ev.people)}<span>Starts ${hhmm(o.start)}${o.ev.people.length ? ` · ${esc(namesOf(o.ev.people))}` : ''}</span></span>
        </button>`,
      });
    }
    const el = $('#moment');
    const html = cards.map((c) => c.html.replace('class="moment-card', `class="moment-card${ui.momentIds.has(c.id) ? '' : ' enter'}`)).join('');
    const sig = cards.map((c) => c.html).join('').replace(/width:[\d.]+%/g, '');
    if (el.dataset.sig !== sig) {
      el.innerHTML = html;
      el.dataset.sig = sig;
    } else {
      const bars = $$('.moment-card.live .progress > span', el);
      live.forEach((o, i) => { if (bars[i]) bars[i].style.width = `${Math.min(100, ((now - o.start) / (o.end - o.start)) * 100).toFixed(1)}%`; });
    }
    ui.momentIds = new Set(cards.map((c) => c.id));

    // Tab title
    if (live.length) document.title = `● Live: ${live[0].ev.title} – KAIROS`;
    else if (soon.length) document.title = `${inMinutes(soon[0].start - now)}: ${soon[0].ev.title} – KAIROS`;
    else document.title = 'KAIROS';
  }

  // ---------- Countdowns ----------
  function renderCountdowns() {
    const items = store.state.events
      .filter((e) => e.pinned)
      .map((e) => ({ e, next: T.nextOccurrence(e, ui.today) }))
      .filter((x) => x.next)
      .map((x) => ({ ...x, days: T.daysBetween(ui.today, x.next) }))
      .sort((a, b) => a.days - b.days);
    $('#countdowns').innerHTML = items.map(({ e, next, days }) => {
      const [num, unit] = days === 0 ? ['Today', 'It’s here'] : days === 1 ? ['1', 'day to go'] : [String(days), 'days to go'];
      return `<button type="button" class="countdown${days === 0 ? ' is-today' : ''}" style="--c:${eventColor(e)}" data-goto="${next}"
        aria-label="${esc(e.title)}: ${num} ${unit}">
        <span class="countdown-title">${esc(e.title)}</span>
        <span class="countdown-num">${num}</span>
        <span class="countdown-unit">${unit}</span>
      </button>`;
    }).join('');
  }

  // ---------- Composer ----------
  const quick = $('#quickInput');
  const parseQuick = () => P.parse(quick.value, { now: new Date(), baseDate: ui.selected, people: store.state.people });

  function renderPreview() {
    const txt = quick.value.trim();
    $('#quickAdd').disabled = !txt;
    const el = $('#preview');
    if (!txt) { el.innerHTML = ''; return; }
    const r = parseQuick();
    const chips = [];
    chips.push(r.title ? `<span class="chip title">${esc(r.title)}</span>` : '<span class="chip guess"><b>What</b> type a name</span>');
    const rel = relDay(r.date);
    chips.push(`<span class="chip${r.found.day ? '' : ' guess'}"><b>Day</b> ${esc(rel ? `${rel}, ${shortDay(r.date)}` : shortDay(r.date))}</span>`);
    chips.push(`<span class="chip${r.found.time ? '' : ' guess'}"><b>Time</b> ${r.start ? `${r.start} – ${r.end}` : 'All day'}</span>`);
    if (r.people.length) chips.push(`<span class="chip"><b>Who</b> ${facesHTML(r.people, 5)} ${esc(namesOf(r.people))}</span>`);
    if (r.repeat !== 'none') chips.push(`<span class="chip"><b>Repeat</b> ${REPEAT_LABEL[r.repeat]}</span>`);
    el.innerHTML = chips.join('');
  }

  function markNew(id) {
    ui.justAdded = id;
    clearTimeout(markNew.t);
    markNew.t = setTimeout(() => { ui.justAdded = null; }, 2000);
  }

  function addFromQuick() {
    const r = parseQuick();
    if (!r.title) { toast('What’s it called? Type a name too.'); quick.focus(); return; }
    const ev = { id: window.KStore.uid(), title: r.title, date: r.date, start: r.start, end: r.end, people: r.people, repeat: r.repeat, reminder: null, note: '', pinned: false };
    markNew(ev.id);
    store.upsertEvent(ev);
    quick.value = '';
    renderPreview();
    selectDay(ev.date);
    toast(`Added “${ev.title}” · ${relDay(ev.date) || shortDay(ev.date)}${ev.start ? `, ${ev.start}` : ''}`);
  }

  // ---------- People bar ----------
  function renderPeopleBar() {
    const ps = store.state.people;
    if (ui.filter && !person(ui.filter)) ui.filter = null;
    if (!ps.length) {
      $('#peopleBar').innerHTML = '<button type="button" class="person-chip all" data-open-people>+ Add your people</button>';
      return;
    }
    $('#peopleBar').innerHTML =
      `<button type="button" class="person-chip all" data-filter="" aria-pressed="${!ui.filter}">Everyone</button>` +
      ps.map((p) => `<button type="button" class="person-chip" data-filter="${esc(p.id)}" aria-pressed="${ui.filter === p.id}">${faceHTML(p)}${esc(p.name)}</button>`).join('');
  }

  // ---------- Week strip ----------
  function renderWeek(anim) {
    const start = ui.weekStart;
    const end = T.addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    $('#monthLabel').textContent = sameMonth
      ? `${T.MONTHS[start.getMonth()]} ${start.getFullYear()}`
      : `${T.MONTHS[start.getMonth()].slice(0, 3)} – ${T.MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
    const events = visibleEvents();
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = T.addDays(start, i), key = T.toKey(d);
      const occ = T.occurrencesOn(events, key);
      const dots = occ.slice(0, 4).map((o) => `<span class="dot" style="--c:${eventColor(o.ev)}"></span>`).join('');
      const mini = occ.slice(0, 3).map((o) => `<span class="mini-ev" style="--c:${eventColor(o.ev)}">${o.allDay ? '' : `<span class="mini-time">${o.ev.start} </span>`}${esc(o.ev.title)}</span>`).join('') +
        (occ.length > 3 ? `<span class="mini-more">+${occ.length - 3} more</span>` : '');
      const cls = ['day-pill', key === ui.today && 'is-today', key < ui.today && 'past'].filter(Boolean).join(' ');
      const label = `${longDay(key)}${key === ui.today ? ', today' : ''}: ${occ.length ? `${occ.length} event${occ.length > 1 ? 's' : ''}` : 'nothing planned'}`;
      html += `<button type="button" role="tab" class="${cls}" data-day="${key}" aria-selected="${key === ui.selected}" aria-label="${esc(label)}">
        <span class="dow">${T.WEEKDAYS[d.getDay()].slice(0, 3)}</span><span class="num">${d.getDate()}</span><span class="dots">${dots}</span><span class="mini" aria-hidden="true">${mini}</span>
      </button>`;
    }
    const strip = $('#weekStrip');
    strip.innerHTML = html;
    if (anim) { strip.classList.remove('slide-l', 'slide-r'); void strip.offsetWidth; strip.classList.add(anim); }
  }

  function selectDay(key) {
    ui.selected = key;
    const ws = T.startOfWeek(T.fromKey(key));
    const anim = ws > ui.weekStart ? 'slide-l' : ws < ui.weekStart ? 'slide-r' : null;
    ui.weekStart = ws;
    renderWeek(anim);
    renderDay();
  }
  function shiftWeek(n) {
    const offset = T.daysBetween(T.toKey(ui.weekStart), ui.selected);
    ui.weekStart = T.addDays(ui.weekStart, 7 * n);
    const containsToday = T.toKey(T.startOfWeek(T.fromKey(ui.today))) === T.toKey(ui.weekStart);
    ui.selected = containsToday ? ui.today : T.toKey(T.addDays(ui.weekStart, Math.min(6, Math.max(0, offset))));
    renderWeek(n > 0 ? 'slide-l' : 'slide-r');
    renderDay();
  }

  // ---------- Day: title, notes, timeline ----------
  function renderDay() {
    const key = ui.selected;
    const rel = relDay(key);
    $('#dayTitle').innerHTML = rel ? `${rel} <small>${esc(shortDay(key))}</small>` : esc(longDay(key));
    renderNotes();
    const hint = $('#filterHint');
    const fp = person(ui.filter);
    hint.hidden = !fp;
    if (fp) hint.innerHTML = `<span>Showing ${esc(fp.name)}’s events</span><button type="button" class="link-btn" data-filter="">Show everyone</button>`;
    ui.timelineSig = '';
    renderTimeline(new Date());
  }

  function renderNotes() {
    const notes = store.state.notes[ui.selected] || [];
    $('#notes').innerHTML = notes.map((n) => {
      const p = person(n.by);
      return `<div class="note">
        <p>${esc(n.text)}</p>
        ${p ? `<span class="note-by">${faceHTML(p)}${esc(p.name)}</span>` : ''}
        <button type="button" class="note-del" data-del-note="${esc(n.id)}" aria-label="Remove note">×</button>
      </div>`;
    }).join('');
  }

  const gapPx = (min, floor = 14) => Math.round(Math.min(110, Math.max(floor, 8 + Math.sqrt(Math.max(0, min)) * 6.5)));

  function timelineEntries(now) {
    const key = ui.selected;
    const occ = T.occurrencesOn(visibleEvents(), key);
    const allDay = occ.filter((o) => o.allDay);
    const timed = occ.filter((o) => !o.allDay);
    const isToday = key === T.toKey(now);
    const entries = timed.map((o) => ({ type: 'ev', o, t: o.start, end: o.end }));
    if (isToday) {
      const idx = entries.filter((e) => e.t <= now).length;
      entries.splice(idx, 0, { type: 'now', t: now, end: now });
    }
    return { key, allDay, timed, entries, isToday, occ };
  }

  function stateOf(o, now) {
    if (o.end <= now) return 'past';
    if (o.start <= now) return 'live';
    if (o.start - now <= 10 * 60000) return 'soon';
    return 'upcoming';
  }

  function evCard(o) {
    const ev = o.ev;
    const isNew = ui.justAdded === ev.id;
    return `<button type="button" class="ev${isNew ? ' is-new' : ''}" data-edit="${esc(ev.id)}" style="--c:${eventColor(ev)}">
      <span class="ev-title">${esc(ev.title)}</span>
      ${facesHTML(ev.people, 3)}
      <span class="ev-when"><span>${timeRange(ev)}</span>${ev.repeat !== 'none' ? `<span class="tag repeat">${REPEAT_SHORT[ev.repeat]}</span>` : ''}${ev.pinned ? '<span class="tag repeat">Countdown</span>' : ''}<span class="ev-status"></span></span>
      ${ev.note ? `<span class="ev-note">${esc(ev.note)}</span>` : ''}
      <span class="progress" hidden aria-hidden="true"><span></span></span>
    </button>`;
  }

  function renderTimeline(now) {
    const { key, allDay, entries, isToday, occ } = timelineEntries(now);
    const sig = [key, ui.filter, store.state.updatedAt, entries.map((e) => (e.type === 'now' ? 'NOW' : e.o.ev.id)).join(',')].join('|');
    const el = $('#timeline');
    if (sig !== ui.timelineSig) {
      ui.timelineSig = sig;
      if (!occ.length) {
        const fp = person(ui.filter);
        el.innerHTML = `<div class="empty"><strong>${fp ? `Nothing for ${esc(fp.name)}` : 'Nothing planned.'}</strong>${fp ? 'Enjoy the free time.' : 'Type something above to add it here.'}</div>`;
        return;
      }
      let html = '<div class="rail-fill"></div>';
      html += allDay.map((o) => `<div class="slot" style="--c:${eventColor(o.ev)}"><span class="slot-time small">All<br>day</span>${evCard(o)}</div>`).join('');
      if (allDay.length && entries.length) html += '<div style="height:10px"></div>';
      html += entries.map((e, i) => (e.type === 'now'
        ? `<div class="now-line" data-i="${i}" role="note" aria-label="Now"><span class="now-label"></span><span class="now-dot"></span><span class="now-next"></span></div>`
        : `<div class="slot" data-i="${i}" style="--c:${eventColor(e.o.ev)}"><span class="slot-time">${hhmm(e.o.start)}</span>${evCard(e.o)}</div>`)).join('');
      el.innerHTML = html;
    }
    patchTimeline(now, { key, allDay, entries, isToday });
  }

  /** Update the moving parts in place so the now line glides and finished events fade. */
  function patchTimeline(now, { key, allDay, entries, isToday }) {
    const el = $('#timeline');
    const dayPast = key < T.toKey(now);
    const setState = (slot, o) => {
      const st = isToday && !o.allDay ? stateOf(o, now) : dayPast ? 'past' : 'upcoming';
      const card = $('.ev', slot);
      for (const s of ['past', 'live', 'soon']) {
        slot.classList.toggle(`is-${s}`, st === s);
        card.classList.toggle(`is-${s}`, st === s);
      }
      const status = $('.ev-status', card);
      const html = st === 'live' ? '<span class="tag live"><span class="pulse"></span>Live now</span>'
        : st === 'soon' ? `<span class="tag soon">${inMinutes(o.start - now)}</span>` : '';
      if (status.innerHTML !== html) status.innerHTML = html;
      const bar = $('.progress', card);
      bar.hidden = st !== 'live';
      if (st === 'live') bar.firstElementChild.style.width = `${Math.min(100, ((now - o.start) / (o.end - o.start)) * 100).toFixed(1)}%`;
    };
    const allDaySlots = $$('.slot:not([data-i])', el);
    allDay.forEach((o, i) => allDaySlots[i] && setState(allDaySlots[i], o));

    let prevEnd = null;
    entries.forEach((e, i) => {
      const node = $(`[data-i="${i}"]`, el);
      if (!node) return;
      const gap = prevEnd == null ? 0 : (e.t - prevEnd) / 60000;
      const floor = e.type === 'now' ? 26 : entries[i - 1]?.type === 'now' ? 36 : 14;
      node.style.marginTop = `${prevEnd == null ? (e.type === 'now' ? 18 : 0) : gapPx(gap, floor)}px`;
      if (e.type === 'now') {
        $('.now-label', node).textContent = hhmm(now);
        // "Next up" hint, unless the next event is already flagged as starting soon.
        const next = entries.slice(i + 1).find((x) => x.type === 'ev' && x.t > now);
        $('.now-next', node).textContent = !next ? 'Nothing else today'
          : next.t - now > 10 * 60000 ? `Next: ${next.o.ev.title}, ${inMinutes(next.t - now).toLowerCase()}` : '';
        prevEnd = prevEnd == null ? now : new Date(Math.max(prevEnd, now));
      } else {
        setState(node, e.o);
        prevEnd = prevEnd == null ? e.end : new Date(Math.max(prevEnd, e.end));
      }
    });

    // Glowing rail fills down to the now line.
    requestAnimationFrame(() => {
      const nowEl = $('.now-line', el);
      el.style.setProperty('--fill', nowEl ? `${Math.max(0, nowEl.offsetTop - 8)}px` : dayPast ? 'calc(100% - 16px)' : '0px');
    });
  }

  // ---------- Two-tap delete ----------
  function twoTap(btn, onConfirm, armedLabel = 'Tap again to delete') {
    if (btn.classList.contains('armed')) {
      clearTimeout(btn._disarm);
      btn.classList.remove('armed');
      btn.textContent = btn.dataset.label;
      onConfirm();
      return;
    }
    btn.dataset.label = btn.dataset.label || btn.textContent;
    btn.classList.add('armed');
    btn.textContent = armedLabel;
    btn._disarm = setTimeout(() => { btn.classList.remove('armed'); btn.textContent = btn.dataset.label; }, 3500);
  }
  function disarm(btn) { if (btn.dataset.label) { clearTimeout(btn._disarm); btn.classList.remove('armed'); btn.textContent = btn.dataset.label; } }

  // ---------- Event sheet ----------
  const eventSheet = $('#eventSheet');
  const eventForm = $('#eventForm');
  let editing = null;

  function renderChoices(container, selectedIds, multi) {
    container.innerHTML = store.state.people.length
      ? store.state.people.map((p) => `<button type="button" class="choice" data-pick="${esc(p.id)}" aria-pressed="${selectedIds.includes(p.id)}">${faceHTML(p)}${esc(p.name)}</button>`).join('') +
        (multi && store.state.people.length > 1 ? `<button type="button" class="choice text-only" data-pick-all>Everyone</button>` : '')
      : '<button type="button" class="choice text-only" data-open-people>+ Add people first</button>';
  }

  function openEvent(ev, isNew) {
    editing = { ...ev, people: [...(ev.people || [])], isNew };
    const f = eventForm.elements;
    $('#eventSheetTitle').textContent = isNew ? 'New event' : 'Edit event';
    f.title.value = ev.title || '';
    f.date.value = ev.date || ui.selected;
    f.start.value = ev.start || '';
    f.end.value = ev.start ? ev.end || '' : '';
    f.repeat.value = ev.repeat || 'none';
    f.reminder.value = ev.reminder == null ? '' : String(ev.reminder);
    f.note.value = ev.note || '';
    f.pinned.checked = !!ev.pinned;
    renderChoices($('#eventPeople'), editing.people, true);
    const del = $('#deleteEventBtn');
    del.hidden = isNew;
    disarm(del);
    eventSheet.showModal();
    if (isNew && !ev.title) f.title.focus();
  }

  $('#eventPeople').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick],[data-pick-all]');
    if (!b || !editing) return;
    if (b.hasAttribute('data-pick-all')) {
      const all = store.state.people.map((p) => p.id);
      editing.people = editing.people.length === all.length ? [] : all;
    } else {
      const id = b.dataset.pick;
      editing.people = editing.people.includes(id) ? editing.people.filter((x) => x !== id) : [...editing.people, id];
    }
    renderChoices($('#eventPeople'), editing.people, true);
  });

  eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = eventForm.elements;
    const title = f.title.value.trim();
    if (!title) { f.title.focus(); return; }
    const start = f.start.value || null;
    let end = start ? f.end.value || T.fromMin(T.toMin(start) + 60) : null;
    if (start && end === start) end = T.fromMin(T.toMin(start) + 60);
    const ev = {
      id: editing.id || window.KStore.uid(), title, date: f.date.value || ui.selected, start, end,
      people: editing.people, repeat: f.repeat.value, reminder: f.reminder.value === '' ? null : Number(f.reminder.value),
      note: f.note.value.trim(), pinned: f.pinned.checked,
    };
    const wasNew = editing.isNew;
    if (wasNew) markNew(ev.id);
    store.upsertEvent(ev);
    eventSheet.close();
    if (wasNew) { quick.value = ''; renderPreview(); }
    selectDay(ev.date);
    toast(wasNew ? `Added “${ev.title}”` : 'Saved');
    if (ev.reminder != null) maybeAskNotifications();
  });

  $('#deleteEventBtn').addEventListener('click', (e) => {
    twoTap(e.currentTarget, () => {
      const title = editing.title;
      store.deleteEvent(editing.id);
      eventSheet.close();
      toast(`Deleted “${title}”`);
    }, editing && editing.repeat !== 'none' ? 'Tap again: delete all repeats' : 'Tap again to delete');
  });

  $('#moreBtn').addEventListener('click', () => {
    const txt = quick.value.trim();
    if (txt) { const r = parseQuick(); openEvent({ ...r }, true); }
    else openEvent({ date: ui.selected, people: ui.filter ? [ui.filter] : [] }, true);
  });

  // ---------- Notes ----------
  const noteSheet = $('#noteSheet');
  let noteBy = ls.get('kairos.me', null);
  function openNote() {
    if (noteBy && !person(noteBy)) noteBy = null;
    $('#noteForm').reset();
    renderChoices($('#noteBy'), noteBy ? [noteBy] : [], false);
    $('#noteSheetTitle').textContent = `A little note for ${relDay(ui.selected)?.toLowerCase() || shortDay(ui.selected)}`;
    noteSheet.showModal();
    $('#noteForm').elements.text.focus();
  }
  $('#noteBy').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    noteBy = noteBy === b.dataset.pick ? null : b.dataset.pick;
    ls.set('kairos.me', noteBy);
    renderChoices($('#noteBy'), noteBy ? [noteBy] : [], false);
  });
  $('#noteForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = e.target.elements.text.value.trim();
    if (!text) return;
    store.addNote(ui.selected, text, noteBy);
    noteSheet.close();
  });
  $('#addNoteBtn').addEventListener('click', openNote);
  $('#notes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-note]');
    if (b) twoTap(b, () => store.deleteNote(ui.selected, b.dataset.delNote), 'Remove?');
  });

  // ---------- People sheet ----------
  const peopleSheet = $('#peopleSheet');
  const personForm = $('#personForm');
  let draft = null;

  function renderPeopleList() {
    const ps = store.state.people;
    $('#peopleList').innerHTML = ps.length
      ? ps.map((p) => `<li><button type="button" data-edit-person="${esc(p.id)}">${faceHTML(p)}${esc(p.name)}<span class="edit-hint">Edit</span></button></li>`).join('')
      : '<li class="empty-line">No one yet. Add the people you share your days with.</li>';
  }
  function openPeople() {
    closePersonForm();
    renderPeopleList();
    if (!peopleSheet.open) peopleSheet.showModal();
    if (!store.state.people.length) openPersonForm(null);
  }
  function openPersonForm(p) {
    const used = store.state.people.map((x) => x.color);
    draft = p ? { ...p } : { name: '', color: COLORS.find((c) => !used.includes(c)) || COLORS[0], emoji: '', photo: null };
    $('#personFormTitle').textContent = p ? `Edit ${p.name}` : 'Add someone';
    personForm.elements.name.value = draft.name;
    $('#deletePersonBtn').hidden = !p;
    disarm($('#deletePersonBtn'));
    personForm.hidden = false;
    $('#peopleActions').hidden = true;
    $('#peopleList').hidden = !!p;
    renderPersonDraft();
    personForm.elements.name.focus();
  }
  function closePersonForm() {
    personForm.hidden = true;
    $('#peopleActions').hidden = false;
    $('#peopleList').hidden = false;
    draft = null;
  }
  function renderPersonDraft() {
    const name = personForm.elements.name.value || draft.name;
    $('#personPreview').outerHTML = faceHTML({ ...draft, name }, 'face-xl').replace('class="face', 'id="personPreview" class="face');
    const initial = initials(name || 'A');
    $('#emojiGrid').innerHTML =
      `<button type="button" data-emoji="" aria-pressed="${!draft.emoji && !draft.photo}" aria-label="Use initials"><span class="initial">${esc(initial)}</span></button>` +
      EMOJI.map((em) => `<button type="button" data-emoji="${em}" aria-pressed="${!draft.photo && draft.emoji === em}">${em}</button>`).join('');
    $('#swatches').innerHTML = COLORS.map((c) => `<button type="button" data-color="${c}" style="--c:${c}" aria-label="Colour ${c}" aria-pressed="${draft.color === c}"></button>`).join('');
  }
  personForm.elements.name.addEventListener('input', () => { draft.name = personForm.elements.name.value; renderPersonDraft(); });
  $('#emojiGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-emoji]');
    if (!b) return;
    draft.emoji = b.dataset.emoji;
    draft.photo = null;
    renderPersonDraft();
  });
  $('#swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    draft.color = b.dataset.color;
    renderPersonDraft();
  });
  $('#personPhoto').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { draft.photo = await shrinkImage(file, 128); renderPersonDraft(); } catch { toast('That photo didn’t work. Try another?'); }
  });
  personForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = personForm.elements.name.value.trim();
    if (!name) { personForm.elements.name.focus(); return; }
    const isNew = !draft.id;
    store.upsertPerson({ ...draft, name });
    toast(isNew ? `Welcome, ${name}!` : 'Saved');
    closePersonForm();
    renderPeopleList();
  });
  $('#cancelPersonBtn').addEventListener('click', closePersonForm);
  $('#deletePersonBtn').addEventListener('click', (e) => {
    twoTap(e.currentTarget, () => {
      store.deletePerson(draft.id);
      closePersonForm();
      renderPeopleList();
    }, 'Tap again to remove');
  });
  $('#addPersonBtn').addEventListener('click', () => openPersonForm(null));
  $('#peopleList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit-person]');
    if (b) openPersonForm(person(b.dataset.editPerson));
  });
  $('#peopleBtn').addEventListener('click', openPeople);

  function shrinkImage(file, size) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const s = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // ---------- Settings ----------
  const settingsSheet = $('#settingsSheet');
  function openSettings(focusName) {
    $('#calendarName').value = store.state.calendarName || '';
    applyTheme(ls.get('kairos.theme', 'auto'));
    renderNotifyStatus();
    [$('#sampleBtn'), $('#eraseBtn')].forEach(disarm);
    settingsSheet.showModal();
    if (focusName) $('#calendarName').focus();
  }
  $('#settingsBtn').addEventListener('click', () => openSettings(false));
  $('#groupName').addEventListener('click', () => openSettings(true));
  $('#calendarName').addEventListener('input', (e) => {
    clearTimeout(e.target._t);
    e.target._t = setTimeout(() => store.update((s) => { s.calendarName = e.target.value.trim(); }), 300);
  });
  $('#themeChoice').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme-choice]');
    if (b) { applyTheme(b.dataset.themeChoice); renderSky(new Date()); }
  });
  $('#themeBtn').addEventListener('click', () => applyTheme(isDark() ? 'light' : 'dark'));
  $('#sampleBtn').addEventListener('click', (e) => twoTap(e.currentTarget, () => {
    store.reset(true); ui.filter = null; selectDay(ui.today); settingsSheet.close(); toast('Example calendar loaded');
  }, 'Tap again: replace everything'));
  $('#eraseBtn').addEventListener('click', (e) => twoTap(e.currentTarget, () => {
    store.reset(false); ui.filter = null; selectDay(ui.today); settingsSheet.close(); toast('All clear. A fresh start.');
  }, 'Tap again to erase'));

  // ---------- Reminders ----------
  let swReg = null;
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then((r) => { swReg = r; }).catch(() => {});
  }
  const canNotify = () => 'Notification' in window;
  function renderNotifyStatus() {
    const st = $('#notifyStatus'), btn = $('#notifyBtn');
    btn.hidden = false;
    if (!canNotify()) { st.textContent = 'This browser can’t show notifications. You’ll still see reminders here in the app.'; btn.hidden = true; return; }
    const p = Notification.permission;
    if (p === 'granted') { st.textContent = 'Reminders are on. You’ll get a notification while KAIROS is open.'; btn.textContent = 'Send a test'; }
    else if (p === 'denied') { st.textContent = 'Notifications are blocked. You can allow them in your browser’s site settings.'; btn.hidden = true; }
    else { st.textContent = 'Get a gentle nudge before things start.'; btn.textContent = 'Turn on reminders'; }
  }
  $('#notifyBtn').addEventListener('click', async () => {
    if (!canNotify()) return;
    if (Notification.permission === 'granted') { notify('KAIROS', 'Reminders are working. See you at the right moment.'); return; }
    await Notification.requestPermission();
    renderNotifyStatus();
  });
  function maybeAskNotifications() {
    if (canNotify() && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }
  function notify(title, body, tag) {
    if (!canNotify() || Notification.permission !== 'granted') return false;
    const opts = { body, tag, icon: 'icons/icon.svg', badge: 'icons/icon.svg' };
    if (swReg && swReg.showNotification) { swReg.showNotification(title, opts).catch(() => {}); return true; }
    try { new Notification(title, opts); return true; } catch { return false; }
  }
  function checkReminders(now) {
    const events = store.state.events.filter((e) => e.reminder != null);
    if (!events.length) return;
    const fired = ls.get('kairos.fired', {});
    const today = T.toKey(now);
    let changed = false;
    for (const k of [today, T.addDaysKey(today, 1), T.addDaysKey(today, 2)]) {
      for (const o of T.occurrencesOn(events, k)) {
        const ref = o.allDay ? new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate(), 9) : o.start;
        const at = ref.getTime() - o.ev.reminder * 60000;
        const id = `${o.ev.id}|${k}|${o.ev.reminder}`;
        if (now >= at && now - at < 10 * 60000 && !fired[id]) {
          fired[id] = now.getTime();
          changed = true;
          const when = o.allDay ? (o.ev.reminder >= 1440 ? 'Tomorrow, all day' : 'Today, all day') : `${REMIND_LABEL[o.ev.reminder] ? `Starts ${REMIND_LABEL[o.ev.reminder]}` : 'Coming up'} · ${hhmm(o.start)}`;
          notify(o.ev.title, `${when}${o.ev.people.length ? ` · ${namesOf(o.ev.people)}` : ''}`, id);
          toast(`Reminder: ${o.ev.title}, ${when}`, 6000);
        }
      }
    }
    if (changed) {
      for (const [k, v] of Object.entries(fired)) if (now - v > 3 * 86400000) delete fired[k];
      ls.set('kairos.fired', fired);
    }
  }

  // ---------- Dialog plumbing ----------
  $$('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    d.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) d.close(); });
  });

  // ---------- Global clicks ----------
  document.addEventListener('click', (e) => {
    const t = e.target;
    const edit = t.closest('[data-edit]');
    if (edit) { const ev = store.event(edit.dataset.edit); if (ev) openEvent(ev, false); return; }
    const day = t.closest('[data-day]');
    if (day) { selectDay(day.dataset.day); return; }
    const go = t.closest('[data-goto]');
    if (go) { selectDay(go.dataset.goto); $('.day').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const f = t.closest('[data-filter]');
    if (f) { ui.filter = f.dataset.filter && ui.filter !== f.dataset.filter ? f.dataset.filter : null; renderAll(); return; }
    if (t.closest('[data-open-people]')) {
      $$('dialog[open]').forEach((d) => d.close());
      openPeople();
    }
  });

  quick.addEventListener('input', renderPreview);
  $('#quickForm').addEventListener('submit', (e) => { e.preventDefault(); if (quick.value.trim()) addFromQuick(); });
  $('#prevWeek').addEventListener('click', () => shiftWeek(-1));
  $('#nextWeek').addEventListener('click', () => shiftWeek(1));
  $('#todayBtn').addEventListener('click', () => selectDay(ui.today));

  // Swipe the week strip
  let touchX = null;
  const strip = $('#weekStrip');
  strip.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  strip.addEventListener('touchend', (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) shiftWeek(dx < 0 ? 1 : -1);
  });

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, ms = 3200) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // ---------- Render loop ----------
  function renderAll() {
    const now = new Date();
    $('#groupName').textContent = store.state.calendarName || '';
    renderSky(now);
    renderMoment(now);
    renderCountdowns();
    renderPeopleBar();
    renderWeek();
    renderDay();
    renderPreview();
    if (peopleSheet.open && personForm.hidden) renderPeopleList();
  }

  function tick() {
    const now = new Date();
    const today = T.toKey(now);
    if (today !== ui.today) {
      // Midnight passed: follow the new day if you were looking at "today".
      const wasOnToday = ui.selected === ui.today;
      ui.today = today;
      if (wasOnToday) { ui.selected = today; ui.weekStart = T.startOfWeek(now); }
      renderAll();
    }
    renderSky(now);
    renderMoment(now);
    renderTimeline(now);
    checkReminders(now);
    const minute = Math.floor(now / 60000);
    if (minute !== ui.lastMinute) { ui.lastMinute = minute; renderCountdowns(); }
  }

  store.subscribe(() => renderAll());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  window.addEventListener('focus', tick);
  window.addEventListener('pageshow', tick);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => renderSky(new Date()));

  applyTheme(ls.get('kairos.theme', 'auto'));
  renderAll();
  setInterval(tick, 5000);
  if (store.firstRun) setTimeout(() => toast('Here’s an example calendar to play with. Clear it any time in Settings.', 6000), 600);
})();
