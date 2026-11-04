# GenSolar Pro

**Solar Engineering • Project Estimation • EPC • CRM**

GenSolar Pro is the unified solar project and customer-management platform from **Genesis Powertronics India Pvt. Ltd.** This repository is the main source of the GenSolar Pro application, its web experience, mobile build configuration, desktop wrapper and automated workflows.

## Platform status

The latest main-branch CI run completed successfully for the configured platform jobs:

| Platform / check | Latest CI result |
| --- | --- |
| Android APK | Passed |
| Web build and deployment | Passed |
| iOS Simulator build | Passed |
| Windows desktop build | Passed |
| WebView UI smoke tests | Passed |

These results confirm that the configured automated builds and checks passed. They do not replace final testing on physical iOS/Android devices, Windows computers, or app-store release approval. The iOS job builds a Simulator target; production signing and store distribution are separate release steps.

## What GenSolar Pro includes

- Solar estimation and system sizing
- Engineering inputs and PV system design
- Solar panels, inverters, batteries, cables and protection sizing
- Site planning and project design tools
- Product specifications and editable product library
- BOM / BOQ preparation and project costing
- Customer quotations, DPR and document/PDF workflows
- CRM leads, assignments, follow-ups and customer management
- Role-based experiences for customers, representatives, managers and admins
- Dashboards, project tracking and notifications

Calculation outputs and engineering designs should be reviewed by a qualified solar/electrical professional before being used for final customer commitments or installation.

## Supported project targets

- **Android:** Android application and APK workflow
- **Web:** Responsive web application and deployment workflow
- **iOS:** Capacitor-based iOS Simulator build workflow
- **Windows:** Tauri desktop build workflow

Responsive layouts are intended for phones, tablets, laptops and desktop screens. Platform-specific permissions, notifications, signing and device behavior must be validated on the target device.

## Repository structure

```text
.
├── gensolar-android-project/   # Android application
├── web/                        # Web application and PWA assets
├── desktop/                    # Windows desktop wrapper
├── tests/                      # Automated smoke tests
├── docs/                       # Build, release and platform documentation
├── capacitor.config.ts         # Capacitor configuration
└── package.json                # Build and test scripts
```

## Build locally

Requirements: Node.js 22. Platform-specific builds require the relevant SDK/toolchain.

Install dependencies:

```bash
npm install
```

Build the web application and run its smoke tests:

```bash
npm run build:web
npm run test:web
```

The generated static web application is written to `web/dist`.

### Android

Use the **Build GenSolar APK** workflow in GitHub Actions to build the Android APK. Repository signing secrets must be configured for a stable signing identity. Do not use temporary debug signing for production distribution.

### iOS

The **GenSolar Pro Cross-platform CI** workflow builds the iOS Simulator target on macOS. App Store distribution additionally requires Apple Developer signing, provisioning, capabilities, privacy declarations and review.

### Windows

Build the Tauri desktop package on a supported Windows environment:

```bash
npm run desktop:windows
```

See [Build and Release Guide](docs/BUILD_AND_RELEASE.md) for complete instructions.

## GitHub Actions

The repository includes workflows for:

- Android APK builds and release artifacts
- Web build and deployment
- Cross-platform web, iOS Simulator and Windows CI
- Android WebView/browser UI smoke tests

Open the [Actions tab](https://github.com/VEERA0007/Roka-One/actions) to view current run results and downloadable artifacts.

## Documentation

- [Build and Release Guide](docs/BUILD_AND_RELEASE.md)
- [Cross-platform Architecture and Roadmap](docs/PLATFORM_ROADMAP.md)

## Security

- Never commit Firebase service-account files, private keys, keystores, signing passwords, access tokens or other secrets.
- Store signing credentials in protected GitHub Actions secrets.
- Enforce authentication, organization membership and role permissions through Firebase Security Rules and trusted backend services.
- Do not rely on client-side role checks as the only access-control mechanism.

## Project

**GenSolar Pro**  
Genesis Powertronics India Pvt. Ltd.  
Repository: [VEERA0007/Roka-One](https://github.com/VEERA0007/Roka-One)
