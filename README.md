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
- `colorForBranch(jobSite)` in `theme/colors.ts` — `jobSite` is free text (there's no Branch
  entity in the backend), so a branch's color comes from hashing its name against a fixed
  palette rather than a lookup table: the same name always lands on the same color, and it
  scales to however many branches an org ends up with, no schema change needed. Rendered as a
  small colored pill wherever a branch name shows up next to a person (Schedule's day-detail
  popup, the week builder's Scheduled list).
- `src/components/PopupModal.tsx` — every popup in the app (New Shift, Schedule's day-detail
  and swap-request popups, Add to Schedule, the Availability day editor, New Task, Time Clock's
  range calendar) is built on this one wrapper: tapping the dimmed area outside the card
  dismisses it, tapping inside the card doesn't. One shared implementation means that behavior
  can't drift between screens.
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
- **Home** — dashboard cards for Time Clock (live elapsed time when clocked in), Schedule
  (next upcoming approved shift), Availability (days available this week), Team (member
  count), Tasks (count of the caller's own open tasks), and Onboarding, plus a "Today" section
  listing today's approved shifts. Has a Log out button.
- **Time Clock** — one button that toggles clock-in/clock-out (`POST /time-clock/clock-in` /
  `/clock-out`), best-effort GPS via `expo-location` (proceeds without location if permission
  is denied). Shows a live HH:MM:SS elapsed timer while clocked in, and a total-hours summary
  (`GET /time-clock/total?from=&to=`) for a date range picked from a popup calendar — tap the
  range pill to open it, tap a start day then an end day (tapping again after a range is
  already picked starts a new one), then Apply. No presets; every range is picked this way.
  Defaults to month-to-date (the 1st of the current month through today) until changed.
- **Schedule** — a Monday–Sunday calendar of that week's **approved** shifts only; past days
  are greyed out. ‹ › arrows browse to any previous/future week (the fetch re-runs for
  whichever week is displayed); a "This Week" badge marks the current week, replaced by a
  "Jump to this week" link once you've navigated away from it. A scope switcher above the
  calendar — **Me** / **My Branch** / **All Branches** — controls who shows up alongside each
  day's shift time: Me shows only your own shift, My Branch cross-references the week's
  coworkers (`GET /shifts/coworkers?from=&to=`) against your `jobSite` for that day, All
  Branches shows everyone regardless of branch. Each day also shows that day's **Manager**
  (whoever has an approved shift with `position: manager`, scoped the same way as My Branch),
  so you can see who to talk to about a shift swap. The calendar row's coworker line names up
  to 2 people and folds the rest into a count (`With Sara, Ali +98 more`) rather than trying to
  fit a large branch's whole roster on one line — full names are always in the day-detail
  popup instead. Tapping a day opens that popup: your shift, the manager, and the full coworker
  list for that day, with a count in the section heading, plus two actions: **Request Shift
  Swap** (only shown when you have a shift that day and at least one coworker also working it,
  regardless of the current scope filter — pick which of your shifts to offer and whose shift
  you want in exchange, `POST /shifts/swap-requests`) and **Tasks for this day** (jumps to Tasks
  pre-filtered to that date). A direct 1:1 trade needs both the target coworker and a manager to
  sign off before anything actually moves: "Your Swap Requests" (visible to everyone, shown
  whenever you're on either side of an active request) lets the target **Accept**/**Decline**
  (`PATCH /shifts/swap-requests/:id/accept` / `/decline`) or the requester **Cancel** it
  (`PATCH /shifts/swap-requests/:id/cancel`) while it's still waiting on the target; once
  accepted it shows "awaiting manager approval" with no further action from either employee.
  Owner/manager additionally see "Swap requests awaiting approval" — every request already
  accepted by its target, with **Approve** (`PATCH /shifts/swap-requests/:id/approve` — swaps
  the two shifts' assigned employee) / **Deny** (`PATCH /shifts/swap-requests/:id/deny`)
  buttons. Below the calendar, "Working Today"
  (`GET /shifts/coworkers?from=&to=`,
  everyone approved to work today org-wide, with name and position), then total hours worked
  this month (reuses `GET /time-clock/total`). Owner/manager also see a "Pending confirmation"
  section — every pending shift org-wide (`GET /shifts`), not just their own, with Confirm
  (`PATCH /shifts/:id/confirm`) and Reject (`PATCH /shifts/:id/reject`) buttons — and a
  "+ New Shift" button opening a popup: navigate week with ‹ › arrows, pick a day within it,
  set an HH:mm start/end, pick who it's for (from the Team directory) and an optional position
  (`POST /shifts`).
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
- **Onboarding** — a single plain-text guide per organization (`GET /onboarding`) that every
  member can read; owner/manager see an Edit button that swaps the read view for a multiline
  text box and a Save/Cancel pair (`PUT /onboarding`). Shows an empty state prompting
  owner/manager to write one if the org hasn't yet.
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

## Scripts

- `npm start` — Expo dev server
- `npm run android` / `npm run ios` / `npm run web` — start on a specific platform
