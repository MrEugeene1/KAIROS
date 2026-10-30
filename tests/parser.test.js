// Run with: node tests/parser.test.js
const { parse } = require('../js/parser.js');
const T = require('../js/time.js');

const now = new Date(2026, 8, 29, 14, 0); // Tuesday 29 September 2026, 14:00
const people = [
  { id: 'sam', name: 'Sam' },
  { id: 'mum', name: 'Mum' },
  { id: 'alex', name: 'Alex' },
];
const opts = { now, people, baseDate: '2026-10-05' };

const cases = [
  ['Dentist Tuesday 3pm', { title: 'Dentist', date: '2026-09-29', start: '15:00', end: '16:00' }],
  ['Dinner with Sam Friday 7pm', { title: 'Dinner with Sam', date: '2026-10-02', start: '19:00', end: '20:00', people: ['sam'] }],
  ['Football 3-5pm Saturday', { title: 'Football', date: '2026-10-03', start: '15:00', end: '17:00' }],
  ['Bins every Tuesday', { title: 'Bins', date: '2026-09-29', start: null, repeat: 'weekly' }],
  ['Rent on the 1st every month', { title: 'Rent', date: '2026-10-01', start: null, repeat: 'monthly' }],
  ['Meeting 15h30 on 3/10', { title: 'Meeting', date: '2026-10-03', start: '15:30', end: '16:30' }],
  ['Party 8pm-1am Friday', { title: 'Party', date: '2026-10-02', start: '20:00', end: '01:00' }],
  ['Movie tonight', { title: 'Movie', date: '2026-09-29', start: '20:00' }],
  ['Call mum tomorrow at 10', { title: 'Call mum', date: '2026-09-30', start: '10:00', people: ['mum'] }],
  ['Lunch with everyone next Sunday at noon', { title: 'Lunch with everyone', date: '2026-10-04', start: '12:00', people: ['sam', 'mum', 'alex'] }],
  // extras
  ['Swim', { title: 'Swim', date: '2026-10-05', start: null }], // no day → selected day
  ['Yoga at 7', { title: 'Yoga', start: '19:00' }],
  ['Standup 9:30', { title: 'Standup', start: '09:30', end: '10:30' }],
  ['Work 9-5 Monday', { title: 'Work', date: '2026-10-05', start: '09:00', end: '17:00' }],
  ['Brunch 10-2pm Sunday', { title: 'Brunch', start: '10:00', end: '14:00' }],
  ['Trip to Rome 12 October', { title: 'Trip to Rome', date: '2026-10-12' }],
  ['Mum birthday March 3rd every year', { title: 'Mum birthday', date: '2027-03-03', repeat: 'yearly' }],
  ['Piano lessons on Wednesdays 4pm', { title: 'Piano lessons', date: '2026-09-30', start: '16:00', repeat: 'weekly' }],
  ['Party for 3 people at 7', { title: 'Party for 3 people', start: '19:00' }],
  ['Kids 3-5 years club', { title: 'Kids 3-5 years club', start: null }],
  ['Run every morning', { title: 'Run', start: '09:00', repeat: 'daily' }],
  ['Dinner tomorrow evening', { title: 'Dinner', date: '2026-09-30', start: '19:00' }],
  ['Late shift 22:00-06:00 thu', { title: 'Late shift', date: '2026-10-01', start: '22:00', end: '06:00' }],
];

let fail = 0;
for (const [text, want] of cases) {
  const got = parse(text, opts);
  const bad = Object.entries(want).filter(([k, v]) => JSON.stringify(got[k]) !== JSON.stringify(v));
  if (bad.length) {
    fail++;
    console.log(`✗ "${text}"`);
    for (const [k, v] of bad) console.log(`    ${k}: want ${JSON.stringify(v)} got ${JSON.stringify(got[k])}`);
  } else console.log(`✓ "${text}"`);
}

// Recurrence & live checks
const party = { title: 'Party', date: '2026-10-02', start: '20:00', end: '01:00', repeat: 'none' };
const rent = { title: 'Rent', date: '2026-01-31', repeat: 'monthly' };
if (!T.occursOn(rent, '2026-02-28')) { fail++; console.log('✗ monthly on 31st should fall on last day of Feb'); }
if (T.liveAt([party], new Date(2026, 9, 3, 0, 30)).length !== 1) { fail++; console.log('✗ overnight live'); }

console.log(fail ? `\n${fail} failing` : '\nAll parser tests pass');
process.exit(fail ? 1 : 0);
