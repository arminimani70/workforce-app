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
  user, or the App stack (Home, Time Clock) once `AuthContext` has one. This is the standard
  React Navigation "auth flow" pattern: the screens the user can reach are a direct function
  of auth state, not a route guard.

## Current screens

- **Login** — `POST /auth/login`
- **Register** — `POST /auth/register` (creates a new Organization + its Owner)
- **Home** — shows the logged-in user, links to Time Clock, has a Log out button
- **Time Clock** — one button that toggles clock-in/clock-out (`POST /time-clock/clock-in` /
  `/clock-out`), best-effort GPS via `expo-location` (proceeds without location if permission
  is denied)

## Scripts

- `npm start` — Expo dev server
- `npm run android` / `npm run ios` / `npm run web` — start on a specific platform
