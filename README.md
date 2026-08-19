# Workforce App

Multi-tenant workforce management mobile app (React Native + Expo) — frontend for a
Connecteam-style app. Backend lives in a separate repo:
[workforce-backend](https://github.com/arminimani70/workforce-backend).

## Stack

- Expo (SDK 54 — pinned to match what the Expo Go app currently supports; every companion
  package version comes from that SDK's `bundledNativeModules.json`, not just whatever `npm
  install` would pick on its own) + TypeScript
- React Navigation (native-stack)
- AsyncStorage for local token persistence
- `@expo/vector-icons` (Ionicons) for iconography
- `react-native-web` + `react-dom` — lets `npx expo start` also serve a web build (press `w`,
  or `npm run web`), in addition to iOS/Android/Expo Go
- `expo-image-picker` + `expo-image-manipulator` — profile photo picking (library or camera)
  and client-side resize/compress before upload
- `react-native-maps` (pinned to `1.20.1`, the version Expo SDK 54 bundles) — branch location
  picking and the live geofence map behind the Time Clock button. Android needs a Google Maps
  API key (`expo.android.config.googleMaps.apiKey` in `app.json`) to render map tiles in a
  real build; iOS uses Apple Maps by default and needs no key. It doesn't support web at all —
  `src/components/AppMap.tsx`/`.web.tsx` is a small platform-specific wrapper so bundling for
  web substitutes a static placeholder instead of crashing; every screen imports MapView/
  Circle/Marker from there, never from `react-native-maps` directly
- `expo-notifications` (pinned to `0.32.17`) — local "shift starts in 1 hour" reminders,
  entirely on-device (see the Home screen entry below)

## Design system

- `src/theme/colors.ts` — the app's single color palette (`background`/`surface`/`border`,
  text tones, a named color per feature area, and semantic `success`/`danger`/`warning`/`info`
  colors with matching light backgrounds) plus a shared `cardShadow`. Every screen imports
  from here instead of hardcoding hex values, so a palette change is a one-file edit.
- `src/components/NoteBox.tsx` — a reusable icon+text callout (`info`/`warning`/`success`/
  `danger` variants) for inline tips and warnings, e.g. a missing-branches warning on Stock.
- Dashboard cards, list rows, and boxed sections are all `colors.surface` with `cardShadow` on
  `colors.background`, giving the app a consistent light-elevated-card look; icons mark every
  section header, button, and status so screens are scannable without reading every label.
- `src/constants/positions.ts` — the single source of truth for how a `Position` is labeled,
  iconed, and colored (`POSITION_LABELS`/`POSITION_ICONS`/`POSITION_COLORS`); every screen with
  a position chip or a position-tagged row (Availability, Schedule, the week builder) imports
  from here, so they can't drift out of sync with each other.
- `colorForBranch(jobSite)` in `theme/colors.ts` — `Shift.jobSite`/`ChecklistTemplate.jobSite`
  store a plain-text snapshot of the branch name rather than a reference to the `Branch`
  collection, so a branch's color comes from hashing that name against a fixed palette rather
  than a lookup table: the same name always lands on the same color, and it scales to however
  many branches an org ends up with, no schema change needed. `src/components/BranchTag.tsx`
  wraps this as two shared components — `BranchTag` (a colored pill, optionally with a custom
  `label` while still coloring from `jobSite`) and `BranchDot` (a compact colored dot for dense
  rows) — used everywhere a branch needs to be visually tied to a shift or a person: Schedule's
  day rows and day-detail popup, the week builder's Scheduled list, and Time Clock's
  branch/position box under the timer.
- `src/components/PopupModal.tsx` — every popup in the app (New Shift, Schedule's day-detail
  and swap-request popups, Add to Schedule, the Availability day editor, Time Clock's range
  calendar) is built on this one wrapper: tapping the dimmed area outside the card
  dismisses it, tapping inside the card doesn't. One shared implementation means that behavior
  can't drift between screens. The card is also lifted above the bottom safe area (the iOS
  home indicator / Android gesture bar) so a button near the bottom of the card never crowds
  the edge.
- `src/components/TimeInput.tsx` — every `HH:mm` field (shift/availability start and end times)
  is this component: a text field you can still type into, plus small up/down chevron buttons
  that nudge the value by 15 minutes, wrapping around midnight.

## Getting started

```bash
cp .env.example .env   # set EXPO_PUBLIC_API_URL to your running workforce-backend
npm install
npm start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with Expo Go.
The backend must be reachable from your device/simulator — `localhost` only works for the
web target or an iOS simulator on the same machine; for Android emulator or a physical
device, point `EXPO_PUBLIC_API_URL` at your machine's LAN IP instead.

## How auth works here

- `src/api/client.ts` — thin `fetch` wrapper around the backend's `/auth/*` and `/users/me`
  routes.
- `src/auth/AuthContext.tsx` — owns the access/refresh tokens and the current user. Tokens
  are persisted in `AsyncStorage` so a session survives an app restart; on start it tries to
  restore the session by calling `/users/me`, transparently refreshing the access token once
  if it's expired. It exposes `authFetch`, which every authenticated screen uses to call the
  API — it retries once with a refreshed token on a 401, so that logic lives in one place
  instead of being duplicated per screen.
- `src/navigation/RootNavigator.tsx` — renders the Auth stack (Login/Register) when there's no
  user, or the App stack (Home, Time Clock, Schedule, Availability, Team, Messages, Forms,
  Stock, Wastage, Onboarding, Profile, plus each feature's manager/history sub-screens) once
  `AuthContext` has one. This is the standard React Navigation "auth flow"
  pattern: the screens the user can reach are a direct function of auth state, not a route
  guard. `AuthContext` also exposes `refreshUser()`, which re-fetches `/users/me` and updates
  the cached user — Profile calls it after a successful edit so the rest of the app (e.g.
  Home's header avatar) reflects the change immediately, without an app restart.

## Current screens

- **Login** — `POST /auth/login`
- **Register** — `POST /auth/register` (creates a new Organization + its Owner)
- **Home** — a headline "today's event" banner is the first thing under the welcome header,
  tappable straight into Time Clock: once clocked in it reads "Clocked in since 08:05" with a
  live elapsed timer and the branch/position (`src/hooks/useTodayShiftContext.ts` resolves
  which shift is relevant — whichever is underway right now, or failing that the next one
  today); before that, starting 3 hours ahead of that shift (and for as long as it's already
  underway but not yet clocked into), it reads "Shift today at 08:00" / "Shift in progress ·
  started 08:00" instead — branch/position again as a subtitle. Absent entirely if there's
  nothing relevant today. Below that, dashboard cards for Time Clock (live elapsed time when
  clocked in), Schedule (next upcoming approved shift), Availability (days available this
  week), Team (member count), Messages, Forms, Stock, and Onboarding, plus a "Today"
  section listing today's approved shifts. Has a Log out button. All of this
  re-fetches every time the screen regains focus (`useFocusEffect`, not a mount-only effect) —
  navigating to Time Clock, clocking in or out, and coming back updates the banner and cards
  immediately instead of showing stale state from whenever Home first mounted. Every time this
  screen loads, it also re-syncs local "shift starts in 1 hour" reminder notifications
  (`src/utils/shiftReminders.ts`, `expo-notifications`) against the caller's current approved
  shifts — entirely on-device, no backend involved: each shift gets a notification scheduled
  for (start time − 1 hour), identified by the shift's own id so re-syncing overwrites rather
  than duplicates, and reminders for shifts no longer upcoming (rejected, rescheduled, already
  started) are cancelled. Best-effort — proceeds silently if notification permission is denied.
- **Time Clock** — a live map (`react-native-maps`, `showsUserLocation` + a
  continuously-updating `Location.watchPositionAsync` subscription so it recenters as you move)
  fills the whole screen as a background; the Clock In/Out circle floats on top of it with a
  translucent fill so the map shows through the button itself. Tapping it toggles
  clock-in/clock-out (`POST /time-clock/clock-in` / `/clock-out`),
  taking a one-off GPS fix via `expo-location` for the location actually submitted, plus the
  caller's local "today" bounds (`dayStart`/`dayEnd`) so the backend can check for a shift
  scheduled that day — a normal Clock In with no approved shift starting today is rejected
  (`400`) with an error explaining that. If today's shift (same `useTodayShiftContext`
  resolution Home uses) has a branch, that branch's geofence radius is drawn as a circle on the
  map and compared client-side (haversine) against your live position — straying outside it
  shows a red `NoteBox` naming how far *past* the radius boundary you are (not the raw distance
  to the branch). This is a heads-up, not the enforcement itself: the backend independently
  re-checks distance against the same branch using the GPS fix taken at submit time and rejects
  the clock-in (`400`) if it's outside the radius, or if location couldn't be obtained at all —
  so denying location permission no longer bypasses the geofence, it just means clock-in fails
  with an error telling you to enable it. An "Extra Shift Clock In" pill below the button (shown
  only while not
  clocked in, teal rather than an alarm color since this covers ordinary cases like covering a
  coworker, not just emergencies) opens a popup with three chip pickers — branch (from
  `branchesApi.list`), position, and a reason (`Extra day` / `Covering a coworker` / `Called in
  urgently` / `Other`, the last revealing a free-text field) — all three required. Submitting
  sends the chosen branch/position/reason to `/time-clock/clock-in`, which is what makes the
  backend skip the shift check and accept a clock-in with nothing scheduled. Below the main
  button while clocked in, a live HH:MM:SS elapsed timer
  with a light branch/position subtitle underneath (rendered as a colored pill tied to that
  branch's color) — the fuller "today's event" framing (clock-in time, "starts in 3 hours"
  heads-up) lives on Home instead, as the primary place to see it rather than a Time Clock
  screen detail.
  Further down, a total-hours summary (`GET /time-clock/total?from=&to=`) for a date range
  picked from a popup calendar — tap the range pill to open it, tap a start day then an end day
  (tapping again after a range is already picked starts a new one), then Apply. No presets;
  every range is picked this way. Defaults to month-to-date (the 1st of the current month
  through today) until changed.
- **Schedule** — a Monday–Sunday calendar of that week's **approved** shifts only; past days
  are greyed out. ‹ › arrows browse to any previous/future week (the fetch re-runs for
  whichever week is displayed); a "This Week" badge marks the current week, replaced by a
  "Jump to this week" link once you've navigated away from it. A two-way scope switcher above
  the calendar — **Me** / **Everyone** — controls who shows up: Me lists only your own shifts;
  Everyone lists every approved shift org-wide (`GET /shifts/coworkers?from=&to=`, self
  included). Each day in the calendar renders every person scheduled that day as its own row —
  avatar (their `avatarUrl` if set, else initials in a colored circle), shift time, and a
  `BranchTag` pill colored by that shift's branch — grouped by day so a day's whole roster
  finishes before the next day starts, rather than each person's week running start-to-finish
  one after another. Tapping a day opens the day-detail popup: your shift, that day's
  **Manager** (whoever has an approved shift with `position: manager`), and the full coworker
  list (only populated in Everyone scope) — no actions live here anymore; swap and edit
  requests moved to their own buttons below the calendar (next paragraph).

  Below the week's calendar sit two request buttons open to every employee. **Request Swap**
  opens a form: first pick which of your own shifts (this week) you're offering, then — once
  that's picked — the server looks up (`GET /shifts/swap-requests/candidates?shiftId=`) who's
  eligible to take it that day: anyone with an approved shift in your `position` at a
  *different* branch, or anyone with no shift at all that day. Pick one of them, or pick
  **Free Volunteer** instead to broadcast the shift with no target and let anyone eligible
  claim it themselves (`POST /shifts/swap-requests`, `targetEmployeeId` omitted for volunteer
  mode). **Edit Past Shift** opens a form listing only this week's shifts that have already
  ended — today's shift, even if it's over, doesn't qualify; the earliest eligible one is
  yesterday's — pick one and enter a corrected HH:mm start/end (`POST
  /shifts/edit-requests`).

  A direct 1:1 swap needs both the target and a manager to sign off before anything actually
  moves; a picked-no-shift target skips straight to a reassignment once approved, and a
  Free Volunteer claim (`PATCH /shifts/swap-requests/:id/volunteer`) skips straight to
  `pending_manager`, same as a direct target accepting. "Open Swap Requests" (visible to
  anyone free that day) lists every unclaimed Free Volunteer broadcast with a **Volunteer**
  button. "Your Swap Requests" (shown whenever you're on either side of an active request,
  including one still broadcasting as `open`) lets the target **Accept**/**Decline**
  (`PATCH /shifts/swap-requests/:id/accept` / `/decline`) or the requester **Cancel** it
  (`PATCH /shifts/swap-requests/:id/cancel`) while it's still waiting on a response; once
  accepted or volunteered-for it shows "awaiting manager approval" with no further action from
  either employee. "My Edit Requests" similarly lists your own pending shift-time corrections
  with a **Cancel** button. Owner/manager additionally see "Swap requests awaiting approval" —
  every swap already agreed to by both sides, with **Approve** (`PATCH
  /shifts/swap-requests/:id/approve` — reassigns or exchanges the shift(s), depending on
  whether the target had one that day) / **Deny** (`PATCH /shifts/swap-requests/:id/deny`)
  buttons — and "Shift edit requests awaiting approval" with **Approve** (`PATCH
  /shifts/edit-requests/:id/approve` — applies the corrected times to the shift) / **Reject**
  (`PATCH /shifts/edit-requests/:id/reject`) buttons.

  Also below the calendar: a "Pending confirmation" section — every pending shift org-wide
  (`GET /shifts`), not just their own, with Confirm (`PATCH /shifts/:id/confirm`) and Reject
  (`PATCH /shifts/:id/reject`) buttons (owner/manager only) — and a "+ New Shift" button opening
  a popup: navigate week with ‹ › arrows, pick a day within it, set an HH:mm start/end, pick
  who it's for (from the Team directory), an optional position, and an optional branch (picked
  from the Branches list, not free-typed) (`POST /shifts`). A **Manage Branches** button
  alongside it opens the branch editor (see below).
- **Availability** — date-based, not a recurring weekly pattern: a ‹ › week-navigable calendar
  (same pattern as Schedule) so any future week can be set independently, with a "This Week"
  badge / "Jump to this week" link once you've browsed away. Tapping a day opens a popup for
  that exact date: **Unavailable**, **Available** (set an HH:mm start/end and one or more
  positions — Front Desk/Help Desk/Information/Consultation/Manager), or **Flexible** (no
  preference, manager decides) — Save writes it immediately (`PUT /availability/me`); a day
  that's already set also gets a **Clear** option to reset it back to "not set"
  (`DELETE /availability/me?date=`). `GET /availability/me?from=&to=` loads the displayed
  week's entries; a day with no entry shows "Not set".
- **Team** — lists every org member (`GET /users`). Owner/manager also see an "Add Employee"
  form — full name, email, and a temporary password (`POST /users`); there's no
  self-registration flow for team members, an admin sets them up directly.
- **Messages** — direct 1:1 chat with any other org member, no role restriction. The
  conversation list (`GET /messages/conversations`) shows the other person, a preview of the
  last message, and an unread badge, polling every 8 seconds while the screen is focused; a
  "New Message" button opens a picker over the Team directory to start a new thread. Opening a
  thread (`GET /messages/with/:employeeId`) polls every 4 seconds and marks it read
  (`PATCH /messages/with/:employeeId/read`); messages render as bubbles (mine right-aligned,
  theirs left) with a plain text input and send button (`POST /messages`). Text-only for
  now — no image/PDF/Word attachments yet, though the backend schema already leaves room for
  one. Home's Messages card shows the total unread count (`GET /messages/unread-count`).
- **Checklists** — opening/closing duty lists per position, optionally narrowed to a branch.
  Reached from **Forms**' "Opening/Closing Checklist" row, and split across two screens the same
  way Stock is: a **list** screen and a full-page **fill** screen. Not tied to a shift, a day, or
  one employee: each (position, branch) is one live, shared sheet (since several different
  people can hold the same position at the same branch across a day), so it's fillable any time,
  whether or not you're scheduled to work. The list screen (`GET /checklists/templates`, open to
  any authenticated user) shows one row per existing checklist "form" — position icon/color,
  title (or a position-based fallback when no title was set), item counts, and a branch tag (or
  "All branches") — tapping a row opens **ChecklistFill** with that form's `position`/`jobSite`.
  The Forms row skips the list entirely and jumps straight into ChecklistFill when "whichever
  shift matters right now" resolves a position (same resolution Home/Time Clock use), same as
  Schedule's day-detail "Your Shift" row, which always knows its shift's position/branch exactly;
  otherwise both land on the list to browse. ChecklistFill (`GET
  /checklists/current?position=&jobSite=`) shows an optional heading (the template's title) above
  an **Opening** and a **Closing** section, each a list of items with a **Done**/**Not Done**
  button pair per item instead of a single checkbox — there's no neutral "unanswered but treated
  as not done" state; an item just shows unmarked (neither button highlighted) until you
  explicitly pick one, and an "answered/total" counter in the section header tracks progress.
  Every tap saves immediately (`PATCH /checklists/current/opening` / `/closing`, `{ position,
  jobSite?, item, done }`). Once an item is marked, a small photo row appears under it — **Camera**
  and **Photo** buttons (`expo-image-picker`, same permission-request-then-launch flow as the
  profile photo picker) let you attach an optional proof-of-completion photo; picking one resizes
  it to 400px wide and compresses it client-side (`expo-image-manipulator`) before sending it as
  a base64 data URI alongside the item's current done value, and a thumbnail replaces the two
  buttons once one's attached (tap it to replace with a new photo). Once every item in a section
  is answered, a **Submit** button appears; tapping it (`PATCH .../opening/submit` /
  `/closing/submit`) archives that section's current answers (including any attached photos) as a
  new history entry and **resets the section back to blank** right there on screen — with a brief
  "submitted" confirmation banner — so the same sheet is immediately ready for the next person to
  fill, rather than staying marked "done" for the rest of the day. Owner/manager get **Manage
  Checklists** and **Submission History** buttons at the bottom of the list screen (mirroring
  Stock), plus the existing **Manage Checklists** button on Schedule. The manager editor opens a
  list of every existing template plus an editor: pick a **Position**, optionally pick a
  **Branch** from the Branches list (leave it on "All branches" to make this the position's
  default — applied to any pick of that position with no more specific branch template of its
  own), give it an optional **Title** (shown as the checklist's heading, so the same position can
  read differently at different branches), then freely add/remove line items for each section and
  Save (`PUT /checklists/templates`) — picking a position+branch that already has a template
  loads it for editing instead of starting blank. A **View Submissions** button at the top of
  that same screen opens **Checklist Submissions** (`GET /checklists/submissions`) — every
  submitted round ever, newest first, showing who submitted it, whether it was the Opening or
  Closing section, the position/branch, each answered item with a check/x icon, and a thumbnail
  next to any item that had a photo attached.
- **Forms** (Home dashboard card) — the single hub for every fill-out-and-submit flow in the
  app. Two built-in rows sit above the ad hoc catalog: **Opening/Closing Checklist** (see
  Checklists below) and **Wastage Report** (see Wastage below), both plain navigations to their
  own screens rather than the popup the rows below them use. Below those, an org-wide catalog
  of ad hoc report types (e.g. "Damaged Product", "Equipment Malfunction", "Urgent Supply
  Request") — unlike Checklists these aren't tied to a position or branch, so any employee can
  submit any of them, whenever something needs reporting. Tapping one in this part of the list
  opens a popup with a text/number input per field (`GET /forms/templates` for the catalog,
  `POST /forms/submissions` to send it). Owner/manager get two extra buttons: **Manage Forms**
  — a list of existing templates plus an editor (title + freely add/remove fields, each with a
  label and a Text/Number type, `PUT /forms/templates`) — and **Submission History** — every
  submission ever made, newest first, with who submitted it and its field values
  (`GET /forms/submissions`).
- **Onboarding** — a guide per organization (`GET /onboarding`) made of titled sections rather
  than one long text blob. Each section is a card showing just its title; tapping one expands
  it in place to read the content, tapping again collapses it. A search box above the list
  filters by title (and content) as you type. Owner/manager see an Edit button that swaps the
  read view for a list of title+content blocks they can freely add to or remove from, saved
  together as one Save (`PUT /onboarding`, replaces the whole `sections` array). Shows an empty
  state prompting owner/manager to write one if the org hasn't yet.
- **Profile** — self-service only, no admin-editing-others flow. A large avatar (photo or
  initials) with "Choose Photo"/"Take Photo" buttons (`expo-image-picker`, resized to 400px
  wide and JPEG-compressed via `expo-image-manipulator` before upload as a base64 data URI —
  `PATCH /users/me`). An **Account** card shows email and role read-only (admin-set, not
  editable here). A **Personal Info** card edits full name, phone, birth date (`YYYY-MM-DD`),
  address, and emergency contact, saved together via one "Save Changes" button
  (`PATCH /users/me`). A **Change Password** card takes current + new password
  (`PATCH /users/me/password`, `401` on a wrong current password). Reachable via a Home
  dashboard card or by tapping the header avatar on Home.
- **Build Schedule** (owner/manager only, via a button on Schedule) — the weekly
  schedule-building workflow. Week nav (‹ › arrows), and for each day: an **Available** list
  pulled from `GET /availability?from=&to=` (every employee with an available/flexible entry
  for that exact date, with their time range and position(s) — if two people picked the same
  position, both show up, so the manager can eyeball the overlap and pick), each with a
  "+" that opens a prefilled add-to-schedule popup (`POST /shifts`, still a **draft**: shifts
  start `approval: pending` and stay invisible to employees), and a **Scheduled** list of that
  day's shifts already drafted/published, with a trash icon to remove a still-draft one
  (`PATCH /shifts/:id/reject`). A "Publish Week" button at the bottom
  (`PATCH /shifts/publish?from=&to=`) bulk-confirms every draft shift in the displayed week in
  one action, making the whole week visible to employees at once instead of shift by shift.
- **Manage Branches** (owner/manager only, via a button on Schedule) — the org-wide list of
  physical work locations that feeds every branch picker in the app (New Shift, Build
  Schedule, Manage Checklists) and the Time Clock geofence map. Existing branches list first
  (name + radius, tap to edit, trash to delete); the editor below has a name field, a radius
  field (meters, 10–5000, defaults to 100), and a `react-native-maps` `MapView` to place the
  point — tap anywhere on the map to drop the pin, drag the marker to fine-tune, or tap "Use my
  current location" to jump straight to wherever you're standing (`expo-location`). A `Circle`
  overlay on the map previews the geofence radius live as you type it. Save upserts
  (`PUT /branches`, include `id` to edit in place instead of creating a new one).
- **Stock** (Home dashboard card) — manager-built, named product-count lists, one branch per
  list but any number of lists per branch (e.g. "Bar Stock" and "Kitchen Stock" both at the same
  branch). The list of available lists (`GET /stock/templates`) shows each one's branch as a
  colored `BranchTag`; tapping one navigates to a full **Count Stock** screen (not a popup — a
  list can run to 100 products, too many for a modal) with a numeric input per product, labeled
  with that product's unit and a fixed Submit bar pinned to the bottom — the employee only ever
  enters a quantity, never a product name, since the manager fixed those when building the list
  (`POST /stock/submissions`). Owner/manager get
  two extra buttons: **Manage Lists** — pick a branch, give the list a title, freely add/remove
  product rows (each a name + unit), Save upserts (`PUT /stock/templates`, include `id` to edit
  in place) — and **Submission History** — every stock count ever submitted, newest first, with
  who submitted it, which branch/list, and each product's counted quantity
  (`GET /stock/submissions`).
- **Wastage** — reporting damaged/expired/spilled product, reached via Forms' "Wastage Report"
  row. A single always-available form: pick a **Branch** (from the Branches list) and a
  **Reason** (from an
  org-wide, manager-editable catalog) as chips, then type the **Product Name** and **Amount** by
  hand — those two are always free text since there's no fixed product catalog to pick from,
  unlike Stock's manager-built lists (`POST /wastage/entries`). Owner/manager get two extra
  buttons: **Manage Reasons** — a simple add/rename/delete list of reason labels
  (`PUT /wastage/reasons`, `DELETE /wastage/reasons/:id`) that populates the Reason chips for
  everyone — and **Entry History** — every wastage report ever submitted, newest first, with
  who reported it, the branch, product, amount, and reason (`GET /wastage/entries`).

## Scripts

- `npm start` — Expo dev server
- `npm run android` / `npm run ios` / `npm run web` — start on a specific platform
