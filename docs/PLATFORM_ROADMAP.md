# Cross-platform implementation roadmap

## Target architecture
Use one shared responsive application and one shared domain/data layer. Preserve the existing GenSolar Android WebView experience during migration, but move the product UI into a platform-neutral web application that can be packaged for mobile and desktop.

- Web: responsive PWA deployment through GitHub Pages or a production hosting provider.
- Android: retain the current Android shell initially; migrate to a maintained wrapper after parity testing.
- iOS: package the shared application with Capacitor and configure signing, entitlements, push capability and App Store delivery.
- Windows: package the shared application as an installable PWA first; add a signed desktop wrapper (for example, Tauri) if native Windows notifications, filesystem access or offline requirements need it.

## Responsive layout rules
- Compact phone: single-column flow, bottom navigation, full-width forms, notification drawer as a full-height sheet.
- Large phone / small tablet: two-column cards where content permits; navigation adapts to available width.
- Tablet: persistent side navigation and two-column workspace.
- Laptop / desktop: collapsible sidebar, multi-column dashboards, resizable content regions and notification side panel.
- Use CSS Grid/Flexbox, fluid sizing, safe-area insets, keyboard/focus support, and breakpoints based on available viewport width rather than device names.
- Avoid fixed pixel widths for primary layouts. Test portrait, landscape, browser zoom, text scaling, notches/cutouts and Windows high-DPI display scaling.

## Unified modules
1. Authentication and organization membership
2. Customer portal and solar estimator
3. Engineering and site design
4. PV, inverter, battery, cable and protection calculations
5. Product catalogue and editable specifications
6. BOM/BOQ, procurement and project costing
7. DPR, quotation and PDF/Word export
8. CRM leads, assignments, follow-ups and dealer management
9. EPC project execution and site progress
10. Management dashboard, reports and audit history

## Roles and security
Customer, Representative, Manager and Admin roles must be enforced by Firebase Security Rules and trusted backend functions. A client must never grant itself a role or organization membership. Scope every business record by organizationId and ownership/assignment. Keep service-account keys and signing credentials out of Git.

## Notifications
Create a unified in-app notification inbox with unread count, categories, timestamps, deep links and read/archive actions. Events include new lead assignment, follow-up due, quotation updates, approvals, EPC milestones and system announcements. Add platform push notifications only after the backend event pipeline and user consent/preferences are implemented. Browser, Android, iOS and Windows notification permissions and delivery behavior differ and must be tested separately.

## Migration status
The destination repository has the core Android activity, solar UI asset, CRM web shim, web build script, Firebase web config, Firestore rules, Android build configuration and Pages deployment workflow imported from the source CRM repository. The original source repositories remain unchanged.

This is a source baseline, not a finished all-platform release. Remaining work includes importing the complete source/assets and CI workflows, replacing the current Android-only packaging approach with a shared cross-platform shell, implementing native iOS and Windows packaging, responsive redesign/QA, notification delivery, Firebase authorization review, automated tests and signed release pipelines.

## Implementation progress

### Added to the destination repository
- Imported the GenSolar Pro/CRM Android application source, browser bridge, engineering/EPC interface, product imagery, launcher assets, Firestore rules, build workflows, QA tests and setup documentation. Private signing material was not copied.
- Added responsive layout rules for phone, tablet, landscape and desktop widths, including a desktop sidebar layout and a two-column welcome/sign-in screen.
- Removed the Android portrait-only orientation lock.
- Added an in-app notification inbox with unread count, local persistence, lead-created and follow-up-scheduled events, and due/overdue follow-up checks.
- Added PWA metadata and an offline static shell for the web build.
- Added Capacitor configuration for Android/iOS packaging and a Tauri Windows desktop wrapper scaffold.
- Added cross-platform CI jobs for web smoke tests, Windows installer builds and iOS Simulator builds.

### Remaining before production
- Validate the latest Windows and iOS CI builds and fix any platform-specific build issues.
- Generate and review native iOS and Capacitor Android projects; reconcile them with the existing Android WebView app before selecting one supported mobile release path.
- Add backend-triggered cross-device push notifications, FCM/APNs configuration, notification preferences and consent.
- Configure production signing and code-signing credentials outside Git.
- Complete accessibility, screen-size, orientation, offline, authentication and role-security testing on real devices.
- Complete qualified engineering validation of all solar design outputs and financial calculations.
