/* KAIROS — understands events typed in plain words, e.g. "Football 3-5pm Saturday". */
(function (root, factory) {
  const T = typeof module === 'object' && module.exports ? require('./time.js') : root.KTime;
  const api = factory(T);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KParser = api;
})(typeof self !== 'undefined' ? self : this, function (T) {
  const WD_RE = 'mon(?:day)?|tue(?:s|sday)?|wed(?:s|nesday)?|thu(?:rs?|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?';
  const WD_FULL_RE = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
  const MON_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
  const ORD = '(?:st|nd|rd|th)';
  const TIME = '(noon|midday|midnight|\\d{1,2}(?:(?::|\\.|h)\\d{2}|h)?(?:\\s*(?:am|pm|a\\.m\\.|p\\.m\\.))?)';
  const DAYPART = { morning: 9 * 60, afternoon: 15 * 60, evening: 19 * 60, night: 20 * 60 };
  const EVERYONE_RE = /(^|[^\p{L}\p{N}])(everyone|everybody|all of us|the whole family|whole family)(?=$|[^\p{L}\p{N}])/iu;

  const weekdayIndex = (w) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(w.slice(0, 3).toLowerCase());
  const monthIndex = (m) => ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m.slice(0, 3).toLowerCase());
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /** "3pm" → {min: 900, mer: 'pm', marked: true}; returns null if not a real time. */
  function readTime(tok) {
    const t = tok.toLowerCase().replace(/\s+/g, '').replace(/\./g, (m, i, s) => (/\d\.\d/.test(s.slice(i - 1, i + 2)) ? ':' : ''));
    if (t === 'noon' || t === 'midday') return { min: 720, mer: 'pm', marked: true };
    if (t === 'midnight') return { min: 0, mer: 'am', marked: true };
    const m = t.match(/^(\d{1,2})(?:[:h](\d{2})?)?(am|pm)?$/);
    if (!m) return null;
    let h = +m[1];
    const min = m[2] ? +m[2] : 0;
    const mer = m[3] || null;
    if (min > 59) return null;
    if (mer) {
      if (h < 1 || h > 12) return null;
      if (mer === 'pm' && h < 12) h += 12;
      if (mer === 'am' && h === 12) h = 0;
    } else if (h > 23) return null;
    return { min: h * 60 + min, mer, marked: !!mer || /[:h]/.test(t), padded: /^0\d/.test(m[1]), bareHour: !mer && h <= 12 ? h : null };
  }

  /** Bare hours like "at 3" usually mean the afternoon; "at 10" the morning. */
  function guessBare(t) {
    if (t.mer || t.padded || t.bareHour == null) return t.min;
    const h = t.bareHour;
    return h >= 1 && h <= 7 ? t.min + 720 : t.min;
  }

  /** Pick am/pm for a bare time so that it lands closest after `from` (circular). */
  function closestAfter(t, from) {
    if (t.mer || t.padded || t.bareHour == null || t.bareHour === 0) return t.min;
    const cands = [t.min % 720, (t.min % 720) + 720];
    const dist = (c) => (((c - from) % 1440) + 1440) % 1440 || 1440;
    return cands.sort((a, b) => dist(a) - dist(b))[0];
  }
  /** Pick am/pm for a bare start so that it lands closest before `to`. */
  function closestBefore(t, to) {
    if (t.mer || t.padded || t.bareHour == null || t.bareHour === 0) return t.min;
    const cands = [t.min % 720, (t.min % 720) + 720];
    const dist = (c) => (((to - c) % 1440) + 1440) % 1440 || 1440;
    return cands.sort((a, b) => dist(a) - dist(b))[0];
  }

  /** Next date (on/after today, or strictly after with `strict`) that falls on weekday wd. */
  function nextWeekday(today, wd, strict) {
    let diff = (wd - today.getDay() + 7) % 7;
    if (strict && diff === 0) diff = 7;
    return T.addDays(today, diff);
  }

  function nextDayOfMonth(today, dom) {
    for (let i = 0; i < 14; i++) {
      const y = today.getFullYear(), m = today.getMonth() + i;
      const d = new Date(y, m, 1);
      if (dom > T.daysInMonth(d.getFullYear(), d.getMonth())) continue;
      const c = new Date(d.getFullYear(), d.getMonth(), dom);
      if (c >= today) return c;
    }
    return null;
  }

  function dateFromDayMonth(today, day, month, year) {
    if (month < 0 || month > 11 || day < 1) return null;
    if (year != null) {
      if (year < 100) year += 2000;
      if (day > T.daysInMonth(year, month)) return null;
      return new Date(year, month, day);
    }
    let y = today.getFullYear();
    if (day > T.daysInMonth(y, month) && day > T.daysInMonth(y + 1, month)) return null;
    let c = new Date(y, month, day);
    if (c.getMonth() !== month || c < today) c = new Date(y + 1, month, day);
    return c;
  }

  /**
   * Parse free text into an event draft.
   * @param {string} text
   * @param {{now?: Date, baseDate?: string, people?: {id:string,name:string}[]}} opts
   */
  function parse(text, opts = {}) {
    const now = opts.now || new Date();
    const today = T.startOfDay(now);
    const people = opts.people || [];
    let s = ` ${String(text || '')} `;

    const out = { title: '', date: null, start: null, end: null, repeat: 'none', people: [], everyone: false, found: { day: false, time: false } };
    let date = null, weekday = null, weekdayStrict = false, dom = null, daypart = null, allDay = false;
    let endMin = null, startMin = null;

    // Take the first match of `re` out of the text if `fn` accepts it.
    const take = (re, fn) => {
      let hit = false;
      const g = re.flags.includes('g') ? re : new RegExp(re.source, re.flags + 'g');
      s = s.replace(g, (...m) => {
        if (hit) return m[0];
        const ok = fn(...m) !== false;
        hit = ok;
        return ok ? ' ' : m[0];
      });
      return hit;
    };

    // ---- Repeats
    take(new RegExp(`\\b(?:every|each)\\s+(?:single\\s+)?(day|night|morning|evening|week|month|year)\\b`, 'i'), (_, u) => {
      u = u.toLowerCase();
      out.repeat = { day: 'daily', night: 'daily', morning: 'daily', evening: 'daily', week: 'weekly', month: 'monthly', year: 'yearly' }[u];
      if (u in DAYPART) daypart = u;
    });
    take(new RegExp(`\\b(?:every|each)\\s+(${WD_RE})s?\\b`, 'i'), (_, w) => { out.repeat = 'weekly'; weekday = weekdayIndex(w); });
    take(new RegExp(`\\b(?:on\\s+)?(${WD_FULL_RE})s\\b`, 'i'), (_, w) => { out.repeat = 'weekly'; weekday = weekdayIndex(w); });
    take(/\b(daily|weekly|monthly|yearly|annually)\b/i, (_, w) => {
      if (out.repeat !== 'none') return;
      out.repeat = { daily: 'daily', weekly: 'weekly', monthly: 'monthly', yearly: 'yearly', annually: 'yearly' }[w.toLowerCase()];
    });
    take(new RegExp(`\\b(?:on\\s+)?(?:every|each)\\s+(\\d{1,2})${ORD}?(?:\\s+of\\s+(?:the|each|every)\\s+month)?\\b`, 'i'), (_, d) => {
      if (+d < 1 || +d > 31) return false;
      out.repeat = 'monthly'; dom = +d;
    });

    // ---- All day
    take(/\b(?:all[\s-]day)\b/i, () => { allDay = true; });

    // ---- Explicit dates
    take(/\b(?:on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/i, (_, d, m, y) => {
      const c = dateFromDayMonth(today, +d, +m - 1, y != null ? +y : null);
      if (!c) return false;
      date = c;
    });
    take(new RegExp(`\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})${ORD}?\\s+(?:of\\s+)?(${MON_RE})\\b(?:,?\\s+(\\d{4}))?`, 'i'), (_, d, m, y) => {
      const c = dateFromDayMonth(today, +d, monthIndex(m), y ? +y : null);
      if (!c) return false;
      date = c;
    });
    take(new RegExp(`\\b(?:on\\s+)?(${MON_RE})\\s+(?:the\\s+)?(\\d{1,2})${ORD}?\\b(?:,?\\s+(\\d{4}))?`, 'i'), (_, m, d, y) => {
      const c = dateFromDayMonth(today, +d, monthIndex(m), y ? +y : null);
      if (!c) return false;
      date = c;
    });
    take(new RegExp(`\\b(?:on\\s+)?the\\s+(\\d{1,2})${ORD}?(?:\\s+of\\s+(?:the|each|every)\\s+month)?\\b`, 'i'), (_, d) => {
      if (+d < 1 || +d > 31) return false;
      dom = +d;
    }) || take(new RegExp(`\\b(?:on\\s+)?(\\d{1,2})${ORD}\\b`, 'i'), (_, d) => {
      if (+d < 1 || +d > 31) return false;
      dom = +d;
    });

    // ---- Relative days
    take(/\b(?:the\s+)?day\s+after\s+tomorrow\b/i, () => { date = T.addDays(today, 2); });
    take(/\b(today|tonight|tomorrow|tmrw|tmr|tomorrow\s+night)\b(?:\s+(morning|afternoon|evening|night))?/i, (_, w, part) => {
      w = w.toLowerCase();
      if (w === 'tonight') { date = today; daypart = 'night'; }
      else if (w === 'today') date = today;
      else { date = T.addDays(today, 1); if (/night/.test(w)) daypart = 'night'; }
      if (part) daypart = part.toLowerCase();
    });
    take(/\bthis\s+(morning|afternoon|evening)\b/i, (_, part) => { date = date || today; daypart = part.toLowerCase(); });
    take(/\bin\s+(\d{1,3}|a|one|two|three)\s+(days?|weeks?)\b/i, (_, n, u) => {
      n = { a: 1, one: 1, two: 2, three: 3 }[n.toLowerCase()] || +n;
      date = T.addDays(today, /week/i.test(u) ? n * 7 : n);
    });
    take(/\bnext\s+week\b/i, () => { date = T.addDays(T.startOfWeek(today), 7); });
    take(new RegExp(`\\b(?:(next|this|on|coming)\\s+)?(${WD_RE})\\b(?:\\s+(morning|afternoon|evening|night))?`, 'i'), (_, q, w, part) => {
      weekday = weekdayIndex(w);
      weekdayStrict = !!q && q.toLowerCase() === 'next';
      if (part) daypart = part.toLowerCase();
    });

    // ---- Times: ranges first ("3-5pm", "8pm-1am", "from 9 to 11")
    const dayAhead = new RegExp(`^\\s*(?:$|on\\b|every\\b|each\\b|today|tonight|tomorrow|next\\b|this\\b|(?:${WD_RE})\\b)`, 'i');
    take(new RegExp(`(?:\\b(from|between|at)\\s+)?\\b${TIME}\\s*(?:-|–|—|to|till|til|until|and)\\s*${TIME}(?![\\w/])`, 'i'), (m, pre, a, b, at, str) => {
      const ta = readTime(a), tb = readTime(b);
      if (!ta || !tb) return false;
      // A bare "9-5" only counts as a time when a day (or nothing) follows, so "3-5 people" stays in the title.
      if (!pre && !ta.marked && !tb.marked && !dayAhead.test(str.slice(at + m.length))) return false;
      if (ta.mer || ta.padded || !tb.mer) {
        startMin = ta.mer || ta.padded || ta.bareHour == null ? ta.min : guessBare(ta);
        endMin = closestAfter(tb, startMin);
      } else {
        endMin = tb.min;
        startMin = closestBefore(ta, endMin);
      }
    });
    if (startMin == null) {
      take(new RegExp(`(?:\\b(?:at|from|by)\\s+|@\\s*)?\\b${TIME}(?![\\w/])`, 'i'), (m, t) => {
        const tt = readTime(t);
        if (!tt) return false;
        const hasAt = /^\s*(at|from|by|@)/i.test(m);
        if (!tt.marked && !hasAt) return false;
        startMin = guessBare(tt);
      });
    }

    // ---- People
    for (const p of [...people].sort((a, b) => b.name.length - a.name.length)) {
      if (!p.name.trim()) continue;
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(p.name.trim())}(?=$|[^\\p{L}\\p{N}])`, 'iu');
      if (re.test(s)) out.people.push(p.id);
    }
    if (EVERYONE_RE.test(s)) { out.everyone = true; out.people = people.map((p) => p.id); }

    // ---- Resolve the day
    if (date) out.found.day = true;
    else if (weekday != null) { date = nextWeekday(today, weekday, weekdayStrict); out.found.day = true; }
    else if (dom != null) { date = nextDayOfMonth(today, dom); out.found.day = !!date; if (out.repeat === 'none' && /month/i.test(text)) out.repeat = 'monthly'; }
    out.date = date ? T.toKey(date) : opts.baseDate || T.toKey(today);

    // ---- Resolve the time
    if (!allDay) {
      if (startMin == null && daypart) startMin = DAYPART[daypart];
      if (startMin != null) {
        out.start = T.fromMin(startMin);
        out.end = T.fromMin(endMin != null ? endMin : startMin + 60);
        out.found.time = true;
      }
    }

    // ---- Title: whatever is left, tidied up
    let title = s.replace(/\s+/g, ' ').trim();
    const edge = '(?:at|on|from|for|in|by|the|every|each|of|and|@|,|-|–|—|\\.)';
    let prev;
    do {
      prev = title;
      title = title.replace(new RegExp(`^${edge}(?:\\s+|$)`, 'i'), '').replace(new RegExp(`(?:^|\\s+)${edge}$`, 'i'), '').trim();
    } while (title !== prev && title);
    out.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : '';
    return out;
  }

  return { parse, readTime };
});
