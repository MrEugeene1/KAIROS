/* KAIROS — date & recurrence helpers. Works in the browser (window.KTime) and in Node (require). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KTime = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const pad = (n) => String(n).padStart(2, '0');

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function addDaysKey(k, n) { return toKey(addDays(fromKey(k), n)); }
  /** Monday of the week containing d. */
  function startOfWeek(d) { const s = startOfDay(d); return addDays(s, -((s.getDay() + 6) % 7)); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function daysBetween(aKey, bKey) { return Math.round((fromKey(bKey) - fromKey(aKey)) / 86400000); }

  function toMin(hhmm) { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
  function fromMin(min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`; }

  /** Does this event happen on the given day? */
  function occursOn(ev, key) {
    if (key < ev.date) return false;
    const r = ev.repeat || 'none';
    if (r === 'none') return key === ev.date;
    if (r === 'daily') return true;
    const a = fromKey(ev.date), b = fromKey(key);
    if (r === 'weekly') return a.getDay() === b.getDay();
    const dim = daysInMonth(b.getFullYear(), b.getMonth());
    if (r === 'monthly') return b.getDate() === Math.min(a.getDate(), dim);
    if (r === 'yearly') return a.getMonth() === b.getMonth() && b.getDate() === Math.min(a.getDate(), dim);
    return false;
  }

  /** A concrete occurrence of an event on a day, with real start/end Dates. */
  function instance(ev, key) {
    const [y, m, d] = key.split('-').map(Number);
    if (!ev.start) return { ev, key, allDay: true, start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
    const s = toMin(ev.start);
    let e = ev.end ? toMin(ev.end) : s + 60;
    if (e <= s) e += 1440; // ends after midnight
    return { ev, key, allDay: false, overnight: e > 1440, start: new Date(y, m - 1, d, 0, s), end: new Date(y, m - 1, d, 0, e) };
  }

  function occurrencesOn(events, key) {
    return events
      .filter((ev) => occursOn(ev, key))
      .map((ev) => instance(ev, key))
      .sort((a, b) => (a.allDay === b.allDay ? a.start - b.start || a.ev.title.localeCompare(b.ev.title) : a.allDay ? -1 : 1));
  }

  /** Timed occurrences that are happening at `now` (includes last night's events running past midnight). */
  function liveAt(events, now) {
    const today = toKey(now);
    const list = [...occurrencesOn(events, addDaysKey(today, -1)), ...occurrencesOn(events, today)];
    return list.filter((i) => !i.allDay && i.start <= now && now < i.end).sort((a, b) => a.end - b.end);
  }

  /** Timed occurrences starting within `withinMin` minutes. */
  function startingSoon(events, now, withinMin = 10) {
    const today = toKey(now);
    const list = [...occurrencesOn(events, today), ...occurrencesOn(events, addDaysKey(today, 1))];
    return list
      .filter((i) => !i.allDay && i.start > now && i.start - now <= withinMin * 60000)
      .sort((a, b) => a.start - b.start);
  }

  /** Next day (on/after fromKey) this event happens, or null. */
  function nextOccurrence(ev, fromKeyStr, maxDays = 400) {
    if ((ev.repeat || 'none') === 'none') return ev.date >= fromKeyStr ? ev.date : null;
    let k = ev.date > fromKeyStr ? ev.date : fromKeyStr;
    for (let i = 0; i <= maxDays; i++) {
      if (occursOn(ev, k)) return k;
      k = addDaysKey(k, 1);
    }
    return null;
  }

  return {
    pad, WEEKDAYS, MONTHS, toKey, fromKey, startOfDay, addDays, addDaysKey, startOfWeek, daysInMonth, daysBetween,
    toMin, fromMin, occursOn, instance, occurrencesOn, liveAt, startingSoon, nextOccurrence,
  };
});
