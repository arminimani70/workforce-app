# Workforce App

Multi-tenant workforce management mobile app (React Native + Expo) — frontend for a
Connecteam-style app. Backend lives in a separate repo:
[workforce-backend](https://github.com/arminimani70/workforce-backend).

## Stack

- Expo (SDK 57) + TypeScript
- React Navigation (native-stack)
- AsyncStorage for local token persistence

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
  user, or the App stack (Home, Time Clock, Schedule, Availability) once `AuthContext` has
  one. This is the standard React Navigation "auth flow" pattern: the screens the user can
  reach are a direct function of auth state, not a route guard.

## Current screens

- **Login** — `POST /auth/login`
- **Register** — `POST /auth/register` (creates a new Organization + its Owner)
- **Home** — dashboard cards for Time Clock (live elapsed time when clocked in), Schedule
  (next upcoming confirmed shift), and Availability (days available this week), plus a
  "Today" section listing today's confirmed shifts. Has a Log out button.
- **Time Clock** — one button that toggles clock-in/clock-out (`POST /time-clock/clock-in` /
  `/clock-out`), best-effort GPS via `expo-location` (proceeds without location if permission
  is denied). Shows a live HH:MM:SS elapsed timer while clocked in, and a total-hours summary
  (`GET /time-clock/total?from=&to=`) with Today/This Week/This Month/All Time presets.
- **Schedule** — a Monday–Sunday calendar of the current week's **confirmed** shifts only;
  past days are greyed out. Below it, total hours worked this month
  (reuses `GET /time-clock/total`). Owner/manager also see a "Pending confirmation" section
  for their own unconfirmed shifts with a Confirm button (`PATCH /shifts/:id/confirm`), and a
  "Schedule tomorrow, 9:00–17:00" button (`POST /shifts`) — it self-assigns for now since
  there's no Employee Directory yet to pick a different employee.
- **Availability** — a recurring weekly pattern, not tied to specific dates. Tapping a day
  opens a popup: **Unavailable**, **Available** (set an HH:mm start/end and one or more
  positions — Front Desk/Help Desk/Information/Consultation), or **Flexible** (no preference,
  manager decides). `GET`/`PUT /availability/me`.

## Scripts

- `npm start` — Expo dev server
- `npm run android` / `npm run ios` / `npm run web` — start on a specific platform
