# KAIROS

*The right moment, together.* A warm, simple shared calendar for families, couples and friends.

## Try it

No install or build step is needed.

- **Quickest:** double-click `index.html`.
- **Full experience** (reminder notifications, offline, "Add to Home Screen"): serve the folder, then open the address in a browser.
  ```
  python -m http.server 8000
  ```
  Then go to http://localhost:8000. To use it on your phone, open `http://<your-computer's-IP>:8000` on the same Wi‑Fi.

On first launch you get an example calendar. Clear it in **Settings → Erase everything**.

## What's in it

| | |
|---|---|
| Plain-words adding | "Football 3-5pm Saturday", "Rent on the 1st every month", "Party 8pm-1am Friday", with a live preview while you type |
| More options | Title, day, start/end, who, repeat, reminder, note, countdown |
| People | Name, colour, emoji or photo. Typing a name tags that person, and typing "everyone" tags the whole group. Tap a person to filter |
| Live now / Starting soon | Cards at the top that update by themselves, plus the tab title `● Live: Football – KAIROS` |
| The now line | Today's timeline with a glowing line that moves with the time. Events drift toward it, light up when live, and fade once they're over |
| Sky header | Peach in the morning, blue at midday, orange in the evening, navy with stars at night |
| Countdowns, sticky notes | Pinned events show "12 days to go", and anyone can leave a note on a day |
| Safe deleting | Every delete takes two taps |
| Light & dark | Follows the system setting, or you can choose in Settings |

## Files

```
index.html            page structure
css/styles.css        all styling (brand tokens at the top)
js/time.js            dates, repeats, "live now" logic
js/parser.js          plain-words → event
js/store.js           saving + live sync between open tabs
js/app.js             the interface
sw.js                 offline + notifications
tests/parser.test.js  node tests/parser.test.js
```

## Limits of this version

- **Sync is per device.** Changes appear live in every open KAIROS tab on the same browser, but not yet on other people's phones. `js/store.js` isolates this in `LocalBackend`, so a Supabase or Firebase backend can replace it.
- **Reminders only fire while the app is open** (or in a background tab). Reminders on a closed app need server push.
- Editing or deleting a repeating event changes every repeat.
