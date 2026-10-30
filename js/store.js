/* KAIROS — shared state. Saves on this device and syncs live to every other open KAIROS tab.
   To share between phones, swap `LocalBackend` for a Firebase/Supabase backend with the same shape. */
(function (root) {
  const KEY = 'kairos.v1';
  const T = root.KTime;

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  const empty = () => ({ calendarName: '', people: [], events: [], notes: {}, updatedAt: Date.now() });

  function sample(now = new Date()) {
    const today = T.toKey(now);
    const round5 = (d) => Math.floor((d.getHours() * 60 + d.getMinutes()) / 5) * 5;
    const nowMin = round5(now);
    const alex = { id: uid(), name: 'Alex', color: '#E76F51', emoji: '' };
    const sam = { id: uid(), name: 'Sam', color: '#3A86FF', emoji: '' };
    const mia = { id: uid(), name: 'Mia', color: '#8338EC', emoji: '' };
    const ev = (o) => ({ id: uid(), repeat: 'none', reminder: null, people: [], note: '', pinned: false, start: null, end: null, ...o });
    const liveStart = Math.max(0, nowMin - 25);
    return {
      calendarName: 'The Martins',
      people: [alex, sam, mia],
      events: [
        ev({ title: 'Board games', date: today, start: T.fromMin(liveStart), end: T.fromMin(Math.min(1439, nowMin + 45)), people: [sam, mia].map((p) => p.id) }),
        ev({ title: 'Call Grandma', date: today, start: T.fromMin(Math.min(1430, nowMin + 8)), end: T.fromMin(Math.min(1439, nowMin + 38)), people: [alex.id], reminder: 0 }),
        ev({ title: 'Bins', date: today, repeat: 'weekly' }),
        ev({ title: 'Rent', date: T.toKey(new Date(now.getFullYear(), now.getMonth() + 1, 1)), repeat: 'monthly', people: [alex.id] }),
        ev({ title: 'Dentist', date: T.addDaysKey(today, 1), start: '10:00', end: '10:45', people: [alex.id], reminder: 60 }),
        ev({ title: 'Football', date: T.addDaysKey(today, 3), start: '15:00', end: '17:00', people: [mia.id] }),
        ev({ title: 'Dinner with everyone', date: T.addDaysKey(today, 4), start: '19:00', end: '21:00', people: [alex.id, sam.id, mia.id] }),
        ev({ title: 'Our trip to Rome', date: T.addDaysKey(today, 12), people: [alex.id, sam.id, mia.id], pinned: true, note: 'Passports!' }),
        ev({ title: "Mia's birthday", date: T.addDaysKey(today, 40), repeat: 'yearly', people: [mia.id], pinned: true }),
      ],
      notes: {
        [today]: [
          { id: uid(), text: "I'll pick up the kids", by: sam.id, at: Date.now() },
          { id: uid(), text: 'Don’t forget the flowers ❤️', by: alex.id, at: Date.now() },
        ],
      },
      updatedAt: Date.now(),
    };
  }

  /** Browser storage + BroadcastChannel: every tab sees changes instantly. */
  class LocalBackend {
    constructor(onRemote) {
      this.channel = 'BroadcastChannel' in root ? new BroadcastChannel('kairos') : null;
      if (this.channel) this.channel.onmessage = () => onRemote(this.load());
      root.addEventListener('storage', (e) => { if (e.key === KEY) onRemote(this.load()); });
    }
    load() {
      try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
    }
    save(state) {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (err) { console.warn('KAIROS could not save', err); return false; }
      if (this.channel) this.channel.postMessage('changed');
      return true;
    }
  }

  class Store {
    constructor() {
      this.listeners = new Set();
      this.backend = new LocalBackend((s) => { if (s) { this.state = normalize(s); this.emit(); } });
      const saved = this.backend.load();
      this.firstRun = !saved;
      this.state = normalize(saved || sample());
      if (this.firstRun) this.backend.save(this.state);
    }
    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    emit() { this.listeners.forEach((fn) => fn(this.state)); }
    /** Change state through a mutator, save, broadcast. */
    update(mutate) {
      mutate(this.state);
      this.state.updatedAt = Date.now();
      const ok = this.backend.save(this.state);
      this.emit();
      return ok;
    }
    reset(toSample) { this.update((s) => Object.assign(s, toSample ? sample() : empty())); }

    // Convenience helpers
    person(id) { return this.state.people.find((p) => p.id === id); }
    event(id) { return this.state.events.find((e) => e.id === id); }
    upsertEvent(ev) {
      return this.update((s) => {
        const i = s.events.findIndex((e) => e.id === ev.id);
        if (i >= 0) s.events[i] = ev; else s.events.push({ ...ev, id: ev.id || uid() });
      });
    }
    deleteEvent(id) { this.update((s) => { s.events = s.events.filter((e) => e.id !== id); }); }
    upsertPerson(p) {
      this.update((s) => {
        const i = s.people.findIndex((x) => x.id === p.id);
        if (i >= 0) s.people[i] = p; else s.people.push({ ...p, id: p.id || uid() });
      });
    }
    deletePerson(id) {
      this.update((s) => {
        s.people = s.people.filter((p) => p.id !== id);
        s.events.forEach((e) => { e.people = e.people.filter((x) => x !== id); });
      });
    }
    addNote(key, text, by) { this.update((s) => { (s.notes[key] = s.notes[key] || []).push({ id: uid(), text, by: by || null, at: Date.now() }); }); }
    deleteNote(key, id) {
      this.update((s) => {
        s.notes[key] = (s.notes[key] || []).filter((n) => n.id !== id);
        if (!s.notes[key].length) delete s.notes[key];
      });
    }
  }

  function normalize(s) {
    const base = empty();
    s = { ...base, ...s };
    s.people = Array.isArray(s.people) ? s.people : [];
    s.events = (Array.isArray(s.events) ? s.events : []).map((e) => ({ repeat: 'none', people: [], note: '', pinned: false, reminder: null, start: null, end: null, ...e }));
    s.notes = s.notes && typeof s.notes === 'object' ? s.notes : {};
    return s;
  }

  root.KStore = { Store, uid };
})(self);
