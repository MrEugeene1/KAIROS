# KAIROS: Build Prompt

Copy everything below the line and paste it into Claude or any AI app builder. Change anything in the **My brand** section to match your taste before sending.

---

Build me a shared calendar app called **KAIROS**. It should be beautiful, warm, and so simple that anyone can use it, from kids to grandparents, without instructions.

## The idea behind the name

*Kairos* is the ancient Greek word for "the right moment": not clock time, but the moment that matters. The whole app should center on the present moment: what is happening **now** and what is coming **next**.

Tagline: **"The right moment, together."**

## Who it's for

Couples, families, roommates, or any small group who want to share one schedule. Everyone in the group can add, edit, and delete events, and every change shows up live for everyone.

## My brand

- **Name:** KAIROS, written as a wordmark in spaced capital letters
- **Logo:** a simple clock face with a single hand and a small red dot in the center
- **Feeling:** warm, calm, and quietly playful
- **Colors:**
  - Deep green `#1F6F5C` for main buttons
  - Sunflower yellow `#F2C14E` for "today" and "starting soon"
  - Live red `#D62828` for "live now"
  - Soft sage background `#EDF1EE` and near-black text `#18231F`
- **Fonts:** Bricolage Grotesque for headings and the wordmark, Atkinson Hyperlegible for everything else (very easy to read)
- **Language:** English
- **Tone of messages:** friendly and human, for example "Nothing planned. Type something above to add it here."

Design it so it does **not** look like Google Calendar, TimeTree, or Cozi: no plain grid of boxes. Use a large, easy-to-read font, big tap targets, and support both light and dark mode. It must work well on a phone first.

## Core features

1. **Add events by typing in plain words.** It must understand examples like:
   - "Dentist Tuesday 3pm"
   - "Dinner with Sam Friday 7pm"
   - "Football 3-5pm Saturday"
   - "Bins every Tuesday"
   - "Rent on the 1st every month"
   - "Meeting 15h30 on 3/10" (day/month order)
   - "Party 8pm-1am Friday" (ends after midnight)
   - "Movie tonight", "Call mum tomorrow at 10", "Lunch with everyone next Sunday at noon"

   While I type, show a live preview of what the app understood (title, day, time, who, repeat) before I save. If I don't type a day, use the day I have selected.

2. **A "More options" form** for full control: title, day, start time, end time (1 hour if empty; empty start means all day), who it's for, repeat (daily, weekly, monthly, yearly), reminder (at start, 10 min, 30 min, 1 hour, 1 day before), and a note.

3. **People.** Add any number of people, each with a name and a color. Typing a person's name in an event tags them automatically, and typing "everyone" tags the whole group. Tap a person to see only their events. Each group can give its calendar its own name (like "The Martins"), shown under the KAIROS brand.

4. **Live now.** When I open the app, any event happening right now appears at the top in a card with a pulsing red dot, the words "Live now", who it's for, and "Until 16:00". The event is also outlined in red in the list with a "Live now" tag.

5. **Starting soon.** In the 10 minutes before an event starts, show a yellow "Starting soon" card with a countdown ("In 7 min") and the start time.

6. **Always current.** The live cards update by themselves every few seconds and refresh as soon as I come back to the app. The browser tab or notification title shows "● Live: Football – KAIROS" while something is happening.

7. **Week strip.** Move between weeks with previous/next arrows and a "Today" button. Each day shows small colored dots for its events. Weeks start on Monday.

8. **Reminders** before events, as phone notifications.

9. **Safe deleting.** Deleting takes two taps so nothing is removed by accident.

## Signature features (what makes KAIROS different)

- **The now line.** Today appears as a flowing timeline with a glowing line that moves with the current time. Events slide toward it, light up while they're live, and fade gently when they're finished.
- **A sky that changes with the time of day.** The top of the app turns soft peach in the morning, bright blue at midday, warm orange in the evening, and deep navy with a few stars at night.
- **Faces instead of dots.** Each person can choose an emoji or photo, and events show small stacked faces.
- **Countdowns for good things.** Pin events we're looking forward to, like "Our trip to Rome: 12 days to go".
- **Little notes on a day.** Anyone can leave a short sticky note on a day, like "I'll pick up the kids" or "Don't forget the flowers ❤️".

## How to build it

Start by building a working version I can try, then suggest what to improve next.

For the real phone version: build it as a mobile app with React Native (or Flutter), with a backend like Firebase or Supabase for live syncing between everyone in a group, simple user accounts with invite links, and push notifications that work even when the app is closed.
