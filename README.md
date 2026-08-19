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
  `danger` variants) for inline tips and warnings, e.g. Tasks' "N of M created" batch result.
- Dashboard cards, list rows, and boxed sections are all `colors.surface` with `cardShadow` on
  `colors.background`, giving the app a consistent light-elevated-card look; icons mark every
  section header, button, and status so screens are scannable without reading every label.
- `src/constants/positions.ts` — the single source of truth for how a `Position` is labeled,
  iconed, and colored (`POSITION_LABELS`/`POSITION_ICONS`/`POSITION_COLORS`); every screen with
  a position chip or a position-tagged row (Availability, Schedule, Tasks, the week builder)
  imports from here, so they can't drift out of sync with each other.
- `colorForBranch(jobSite)` in `theme/colors.ts` — `Shift.jobSite`/`ChecklistTemplate.jobSite`
  store a plain-text snapshot of the branch name rather than a reference to the `Branch`
  collection, so a branch's color comes from hashing that name against a fixed palette rather
  than a lookup table: the same name always lands on the same color, and it scales to however
  many branches an org ends up with, no schema change needed. `src/components/BranchTag.tsx`
  wraps this as two shared components — `BranchTag` (a colored pill, optionally with a custom
  `label` while still coloring from `jobSite`) and `BranchDot` (a compact colored dot for dense
  rows) — used everywhere a branch needs to be visually tied to a shift or a person: Schedule's
  day-detail popup and "Working Today" list, the week builder's Scheduled list, and Time Clock's
  branch/position box under the timer.
- `src/components/PopupModal.tsx` — every popup in the app (New Shift, Schedule's day-detail
  and swap-request popups, Add to Schedule, the Availability day editor, New Task, Time Clock's
  range calendar) is built on this one wrapper: tapping the dimmed area outside the card
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
  user, or the App stack (Home, Time Clock, Schedule, Availability, Team, Tasks, Onboarding,
  Profile) once `AuthContext` has one. This is the standard React Navigation "auth flow"
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
  week), Team (member count), Tasks (count of the caller's own open tasks), and Onboarding,
  plus a "Today" section listing today's approved shifts. Has a Log out button. All of this
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
  **Manager** (whoever has an approved shift with `position: manager`), the full coworker list
  (only populated in Everyone scope), plus two actions: **Request Shift Swap** (only shown when
  you have a shift that day and at least one coworker also working it — pick which of your
  shifts to offer and whose shift you want in exchange, `POST /shifts/swap-requests`) and
  **Tasks for this day** (jumps to Tasks pre-filtered to that date). A direct 1:1 trade needs
  both the target coworker and a manager to sign off before anything actually moves: "Your Swap
  Requests" (visible to everyone, shown whenever you're on either side of an active request)
  lets the target **Accept**/**Decline** (`PATCH /shifts/swap-requests/:id/accept` / `/decline`)
  or the requester **Cancel** it (`PATCH /shifts/swap-requests/:id/cancel`) while it's still
  waiting on the target; once accepted it shows "awaiting manager approval" with no further
  action from either employee. Owner/manager additionally see "Swap requests awaiting
  approval" — every request already accepted by its target, with **Approve**
  (`PATCH /shifts/swap-requests/:id/approve` — swaps the two shifts' assigned employee) /
  **Deny** (`PATCH /shifts/swap-requests/:id/deny`) buttons, plus a "Pending confirmation"
  section — every pending shift org-wide (`GET /shifts`), not just their own, with Confirm
  (`PATCH /shifts/:id/confirm`) and Reject (`PATCH /shifts/:id/reject`) buttons — and a
  "+ New Shift" button opening a popup: navigate week with ‹ › arrows, pick a day within it,
  set an HH:mm start/end, pick who it's for (from the Team directory), an optional position,
  and an optional branch (picked from the Branches list, not free-typed) (`POST /shifts`). A
  **Manage Branches** button alongside it opens the branch editor (see below).
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
- **Tasks** — "My Tasks" (`GET /tasks/me`) lets anyone advance their own task through
  Pending → In Progress → Done (`PATCH /tasks/:id/status`). Owner/manager also see "All Tasks"
  org-wide (`GET /tasks`, assignee name shown) and a "+ New Task" button opening a popup with
  two modes: assign to **a specific person** (pick from the Team directory, one due date), or
  assign to **whoever works a position** (pick a position and one or more due dates from the
  week/day picker — `POST /tasks` for a single date, `POST /tasks/batch` for several; each date
  is resolved independently, so a Monday/Wednesday/Friday batch can land on three different
  people depending on who's approved to work that position each day). If a batch date has no
  one approved for that position, that date is skipped and reported back rather than failing
  the whole batch. Arriving here via Schedule's "Tasks for this day" link filters both lists
  to that one date client-side (a "Show all tasks" link clears it) — there's no separate
  date-filtered endpoint, it's the same `GET /tasks/me` / `GET /tasks` data.
- **Messages** — direct 1:1 chat with any other org member, no role restriction. The
  conversation list (`GET /messages/conversations`) shows the other person, a preview of the
  last message, and an unread badge, polling every 8 seconds while the screen is focused; a
  "New Message" button opens a picker over the Team directory to start a new thread. Opening a
  thread (`GET /messages/with/:employeeId`) polls every 4 seconds and marks it read
  (`PATCH /messages/with/:employeeId/read`); messages render as bubbles (mine right-aligned,
  theirs left) with a plain text input and send button (`POST /messages`). Text-only for
  now — no image/PDF/Word attachments yet, though the backend schema already leaves room for
  one. Home's Messages card shows the total unread count (`GET /messages/unread-count`).
- **Checklists** — opening/closing duty lists per position, optionally narrowed to a branch,
  reached from Schedule rather than as its own top-level screen. Tapping one of "Your Shift"'s
  entries in Schedule's day-detail popup opens that shift's checklist
  (`GET /checklists/shift/:shiftId`): an **Opening** and a **Closing** section, each a list of
  items you tap to check off — every tap saves immediately
  (`PATCH /checklists/shift/:shiftId/opening` / `/closing`), and unchecking works the same way.
  If nobody's defined a checklist that applies to that shift's position, the section just says
  so; if the shift has no position at all, a warning explains that a manager needs to set one.
  Owner/manager get a **Manage Checklists** button on Schedule (alongside Build Week
  Schedule/New Shift) that opens a list of every existing template plus an editor: pick a
  **Position**, optionally pick a **Branch** from the Branches list (leave it on "All
  branches" to make this the position's default — applied to any shift with that position that
  doesn't have a more specific branch-only template of its own, including shifts with no branch
  set at all, which is common since branch is optional when scheduling), then freely add/remove
  line items for each section and Save (`PUT /checklists/templates`) — picking a
  position+branch that already has a template loads it for editing instead of starting blank.
- **Forms** (Home dashboard card) — an org-wide catalog of ad hoc report types (e.g. "Damaged
  Product", "Equipment Malfunction", "Urgent Supply Request") — unlike Checklists these aren't
  tied to a position or branch, so any employee can submit any of them, whenever something
  needs reporting. Tapping one in the list opens a popup with a text/number input per field
  (`GET /forms/templates` for the catalog, `POST /forms/submissions` to send it). Owner/manager
  get two extra buttons: **Manage Forms** — a list of existing templates plus an editor (title
  + freely add/remove fields, each with a label and a Text/Number type,
  `PUT /forms/templates`) — and **Submission History** — every submission ever made, newest
  first, with who submitted it and its field values (`GET /forms/submissions`).
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

## Scripts

- `npm start` — Expo dev server
- `npm run android` / `npm run ios` / `npm run web` — start on a specific platform
