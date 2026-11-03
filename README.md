# GenSolar Pro — Unified Platform

Genesis Powertronics India Pvt. Ltd. · GenSolar

This repository is the unified destination for the existing GenSolar Pro solar application and GenSolar CRM.

## Target platforms
- Android and iOS mobile applications
- Responsive web application
- Windows desktop application
- Adaptive layouts for phones, tablets, laptops and desktops
- In-app notifications and platform-native notifications where supported

## Product modules
Solar estimator; engineering and site design; PV, inverter, battery and cable sizing; editable product library; BOM/BOQ; costing and financial analysis; customer-ready DPR and PDF/Word exports; CRM leads; follow-ups; quotations; team management; dashboards; role-based access.

## Source repositories
- https://github.com/VEERA0007/gensolar-pro
- https://github.com/VEERA0007/gensolar-crm

## Important
The source repositories currently contain an Android WebView application and a browser build. They are not yet a complete native iOS/Windows product. Cross-platform packaging, responsive QA, notification integration, security review and production builds must be completed and tested before release.

Never commit Firebase service-account credentials, signing keys, private keys, or production secrets. Configure platform-specific public Firebase app settings through deployment configuration and keep authorization in trusted backend services.

## Unified cross-platform project

The repository now includes responsive web/PWA assets, an in-app notification inbox, Capacitor Android/iOS configuration, and a Tauri Windows desktop scaffold.

- [Build and release instructions](docs/BUILD_AND_RELEASE.md)
- [Cross-platform architecture and implementation status](docs/PLATFORM_ROADMAP.md)

The Android APK and web static site are built by GitHub Actions. Windows installer and iOS Simulator build jobs are being validated. Production signing, App Store release and cross-device push notifications are not yet configured.
