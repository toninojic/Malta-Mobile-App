# MaltaPro Local Development Setup

## Environment files

The API reads environment variables from:

- `apps/api/.env`
- `.env`

The mobile app reads Expo public variables from:

- `apps/mobile/.env`
- values in `apps/mobile/app.json`

The main mobile API setting is:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## Start the local API

From the repository root:

```bash
npm run api:dev --workspace @malta-marketplace/api
```

The local API should run on:

```text
http://localhost:3000/api/v1
```

Health check:

```text
http://localhost:3000/api/v1/health
```

## Start the mobile app

From the repository root:

```bash
npm run start --workspace=@malta-marketplace/mobile
```

## API URL by device type

Use one of these values in `apps/mobile/.env`:

```env
# iOS simulator and Expo web
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1

# Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1

# Physical phone on the same Wi-Fi
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000/api/v1

# Physical phone outside your network
EXPO_PUBLIC_API_URL=https://YOUR_NGROK_OR_PUBLIC_API_URL/api/v1
```

After changing `apps/mobile/.env`, restart Expo with cache clear:

```bash
npm run start --workspace=@malta-marketplace/mobile -- --clear
```

Production builds should set `EXPO_PUBLIC_API_URL` through EAS environment variables.

For APK/AAB build profiles, see [EAS_BUILD.md](EAS_BUILD.md).
