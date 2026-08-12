# Booking Broom Manager (mobile)

Expo SDK 57 manager app for Booking Broom.

## Setup

```bash
# from repo root
pnpm install
cp mobile/.env.example mobile/.env   # if needed
pnpm mobile
```

Requires the same Convex deployment as the web app (`EXPO_PUBLIC_CONVEX_URL`).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm mobile` | Start Expo |
| `pnpm mobile:ios` | iOS |
| `pnpm mobile:android` | Android |
| `pnpm mobile:typecheck` | TypeScript |

## Notes

- Auth: Convex Auth Password (same accounts as web)
- Push: Expo Push tokens stored in `expoPushTokens`; `notifyNewBooking` fans out to Web Push + Expo
- GSC OAuth connect remains on the web app
