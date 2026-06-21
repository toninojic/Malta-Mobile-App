# Push Notifications

## Android Notification Icon

Android notification small icons must be monochrome-compatible. MaltaPro uses:

```text
apps/mobile/assets/notification-icon.png
```

Expo config:

```json
[
  "expo-notifications",
  {
    "icon": "./assets/notification-icon.png",
    "color": "#ED3A35"
  }
]
```

The main app icon remains unchanged.

## Testing

Build a new EAS Android build after changing notification icon config:

```bash
cd apps/mobile
npx eas-cli@latest build --platform android --profile production --clear-cache
```

Install through Google Play Internal Testing and send a backend push notification. The notification should show the MaltaPro small icon instead of a blank square.

