# QuickFixU Mobile

Expo React Native app for QuickFixU.

## Setup

```bash
npm install
```

Copy the env example and configure your values:

```bash
cp .env.example .env
```

For Google/Facebook OAuth on native Expo builds, configure `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and `EXPO_PUBLIC_FACEBOOK_APP_ID`. Use `EXPO_PUBLIC_GOOGLE_CLIENT_ID` only when you also support web. The app uses the `quickfixu://auth` redirect URI.

The backend must allow the same Google audiences via `GOOGLE_CLIENT_IDS` (comma-separated web/android/ios client IDs). If those mobile OAuth env vars are missing, the OAuth CTA buttons stay hidden.

## Running the App

```bash
npx expo start
```

## Testing on Physical Device

`localhost` only works in a browser. `10.0.2.2` only works in the Android emulator.
A physical device needs your machine's real local IP address.

**1. Find your machine's local IP:**

- Windows: `ipconfig` → look for **IPv4 Address** (e.g. `192.168.1.100`)
- Mac/Linux: `ifconfig` → look for **inet** address (e.g. `192.168.1.100`)

**2. Set the IP in `mobile/.env`:**

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000
```

**3. Start the backend:**

```bash
cd backend && npm run dev
```

**4. Make sure your phone is on the SAME Wi-Fi network as your computer.**

**5. Run the app:**

```bash
cd mobile && npx expo start
```

Scan the QR code with Expo Go on your phone.

---

## API URL Resolution

The app resolves the API URL in this order:

| Condition | URL used |
|-----------|----------|
| `EXPO_PUBLIC_API_URL` is set | That value (physical device / custom) |
| Dev mode, Android, no env var | `http://10.0.2.2:3000` (emulator) |
| Dev mode, iOS, no env var | `http://localhost:3000` (simulator) |
| Production build | `https://api.quickfixu.com` |
