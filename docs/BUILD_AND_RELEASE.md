# GenSolar Pro build and release guide

## Repository layout
- `gensolar-android-project/gensolar-android`: existing Android WebView app and Firebase CRM integration.
- `web/`: website build, Firebase browser bridge, PWA manifest and offline shell.
- `desktop/src-tauri`: Windows desktop wrapper.
- `capacitor.config.ts`: shared web app configuration for new Capacitor Android/iOS packaging.
- `tests/`: browser smoke tests.
- `docs/PLATFORM_ROADMAP.md`: architecture and remaining rollout work.

## Build the web application
Requirements: Node.js 22.

```bash
npm install
npm run build:web
npm run test:web
```

The static web build is generated in `web/dist`. It includes the responsive interface, CRM web shim, notification inbox, install manifest and service worker.

## Android debug APK
The existing Android app can be built by running the **Build GenSolar APK** GitHub Actions workflow. It creates an ephemeral debug signing key unless `GENSOLAR_DEBUG_KEYSTORE_BASE64` is configured as a repository secret. An ephemeral key is suitable for test installs, not for upgrading an existing signed installation or production release distribution. To publish the APK as a GitHub Release, add a repository Actions secret named `GENSOLAR_RELEASE_TOKEN` with permission to create/edit releases; otherwise the APK remains available as a workflow artifact.

## iOS simulator build
The **GenSolar Pro Cross-platform CI** workflow installs the Capacitor iOS platform and builds an iOS Simulator target on macOS. This is a simulator build only; App Store distribution requires Apple Developer signing certificates, provisioning profiles, entitlements, privacy declarations and release review.

For local platform setup after `npm install`:

```bash
npm run build:web
npm run native:ios:add
npm run native:ios
```

## Windows installer
The same cross-platform workflow builds the Tauri desktop wrapper on a Windows runner and uploads the installer bundle as an artifact.

```bash
npm run desktop:windows
```

The Windows build requires Node.js, Rust and the Windows desktop build prerequisites. The Tauri wrapper uses the same `web/dist` output as the web application.

## Web deployment
The GitHub Pages workflow builds and deploys the static web app. Before its first successful deployment, a repository administrator must open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. The GitHub Actions token cannot enable Pages for this repository automatically.

## Notifications
The application now has a responsive in-app notification inbox. CRM lead creation, follow-up scheduling and due/overdue follow-up checks can create local notifications. The inbox is currently stored on the device/browser. Browser device notifications are permission-gated.

Cross-device push delivery is not yet enabled. Production push requires a trusted backend event pipeline, Firebase Cloud Messaging configuration for each platform, APNs credentials for iOS, user notification preferences/consent and end-to-end delivery testing.

## Before production
- Replace the temporary debug signing process with protected release signing credentials.
- Validate Firebase Authentication, Firestore rules, organization isolation and role permissions with test accounts.
- Configure production privacy policy, data retention, customer consent and account deletion/export.
- Configure Apple signing and Windows code signing.
- Test real Android devices, iOS devices, Windows displays, browsers, orientation changes, keyboard navigation, screen readers and zoom.
- Complete a qualified engineering review of solar calculations before using generated designs or BOMs for customer commitments.
