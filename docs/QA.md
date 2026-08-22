# Quality Assurance Record

## 2026-08-22 — Public landing page regression check

The public landing page was reviewed at **375 × 812** and **1280 × 720** after the public skip-link target update. The responsive hierarchy, primary workspace and buyer-report actions, pricing cards, trust section, and footer remained visible without observed clipping or overlap.

The review also confirmed that the public header retains its “Skip to content” link and that the home route now exposes the `#public-main` focus target. Automated regression coverage in `server/accessibilityShell.test.ts` protects the skip-link href, public and workspace landmarks, and the shared `:focus-visible` outline rule. Interactive keyboard traversal and dialog focus-trap behaviour remain a required manual acceptance check before production release.
