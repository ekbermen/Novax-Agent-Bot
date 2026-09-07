# NovaX Voice Agent

A voice-first agent dashboard: mobile-first web app (`/web`) plus an optional
Android WebView wrapper (`/android`) that adds a real native bridge and a
real foreground service.

## Run the web app alone (no Android needed)

```
cd web
python3 -m http.server 8080
```
Open `http://localhost:8080` on your phone or desktop browser. Everything
works except native-only actions (camera, screen share, opening other apps),
which will correctly report **"Native Android bridge unavailable."**

Requires a browser with IndexedDB (used for accounts/sessions/settings) and,
ideally, Web Speech API support (Chrome/Edge) for voice — Safari/Firefox
fall back to text input automatically.

## Build the APK from your phone (GitHub Actions, no computer needed)

1. Create a new GitHub repository from your phone (GitHub app or mobile
   browser) and upload the **entire contents of this zip** to its root —
   `web/`, `android/`, `.github/`, `README.md` all at the top level of the
   repo (not nested inside another `novax-agent` folder).
2. Go to the repo's **Actions** tab. The included workflow
   (`.github/workflows/build-apk.yml`) runs automatically on every push to
   `main`, or tap **"Build NovaX APK" → Run workflow** to trigger it by hand.
3. Wait for the run to go green (a few minutes), open the finished run, and
   download the **novax-debug-apk** artifact from the bottom of the page.
   That's your installable APK — enable "install unknown apps" for your
   browser/Files app to install it directly on your phone.

This produces a **debug APK** (unsigned, fine for testing on your own
device). Play Store distribution needs a signed release build, which is a
later step, not required to just try the app.

## Run inside the Android wrapper (with a computer/Android Studio)

1. Open `/android` in Android Studio.
2. Copy the web app into assets:
   ```
   mkdir -p android/app/src/main/assets/web
   cp -r web/* android/app/src/main/assets/web/
   ```
3. Add a launcher icon (`@mipmap/ic_launcher`) via Android Studio's Image
   Asset tool — not included here to keep the project minimal.
4. Build and run. `window.NovaXBridge` will now be real, and the Permission
   Center / `/status` command will show it as connected.

## What's real vs. honestly stubbed

| Capability | Status |
|---|---|
| Sign up / sign in / sign out | Real — IndexedDB + SHA-256 password hashing |
| Conversation memory | Real — persisted per user in IndexedDB |
| Speech-to-text / text-to-speech | Real — Web Speech API, feature-detected |
| Web search / open URL | Real |
| File picker | Real (browser file input) |
| Local notifications (web) | Real (Notification API) |
| `openApp`, `getDeviceInfo`, `showNotification` (native) | Real, once wrapped in Android |
| `closeApp` (native) | Honestly unavailable — Android doesn't let apps close other apps |
| `takePhoto`, `shareScreen`, `sendFile` (native) | Honestly unavailable — need an Activity-result flow, MediaProjection, and/or a defined destination that aren't wired up yet |
| Foreground service | Real — `NovaXForegroundService.kt`, starts/stops around a listening session, shows the required persistent notification |
| AI provider (Anthropic/OpenAI/Gemini/xAI) | Not wired up — Settings has the fields, but no request is sent yet. Plain conversation currently gets a fixed "no provider configured" reply instead of a fake AI answer |

## Architecture

```
web/
  index.html            auth / chat / settings screens
  css/style.css
  js/
    db.js               IndexedDB wrapper (users, sessions, conversations, settings)
    auth.js             sign up / sign in / sign out
    settings.js         provider + voice + theme config
    voice.js            Web Speech API (STT/TTS)
    bridge.js           window.NovaXBridge interface, never fakes success
    commands.js         slash commands
    agent/
      planner.js        text -> plan (intent classification)
      executor.js        plan -> tool call -> result
      tools.js           web search, open URL, file op, native action, notification, system info
      memory.js          per-user conversation history
      permissions.js     real permission-state checks
    app.js               wires all of the above to the DOM

android/
  app/src/main/java/com/novax/agent/
    MainActivity.kt              WebView host, requests runtime permissions
    NovaXBridge.kt                the real @JavascriptInterface
    NovaXForegroundService.kt     real foreground service + notification
  app/src/main/AndroidManifest.xml
  app/build.gradle
```

## Extending later

Because the agent talks to `tools.js` through one contract
(`{status, message, data}`), adding a real AI provider means: read
`settings.provider` / `apiKey` / `model` in `app.js`'s conversation branch,
call the provider's API, and speak/render the response — no other module
needs to change. Same pattern applies to wiring up `takePhoto`/`shareScreen`/
`sendFile` in `NovaXBridge.kt` once you add the corresponding Activity-result
flows.
