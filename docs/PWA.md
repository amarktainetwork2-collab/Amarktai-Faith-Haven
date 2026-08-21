# PWA Operations

FaithHaven publishes a valid web manifest with application metadata, standalone display, an explicit scope, theme colors, and 192/512 bitmap icons marked for maskable use. The document head includes mobile installation metadata and an Apple touch icon.

The service worker versions a cache containing only the public app shell and static assets. It deletes old public caches during activation and serves `offline.html` only for failed navigations. It deliberately bypasses every API and payment request, avoids caching authenticated responses, and never has access to application secrets.

A new build registers the worker and requests an update on load. Verify installation and updates on Chrome desktop, Chrome Android, and Safari iOS after deployment. Validate deep links, account logout, expired sessions, offline navigation, reconnect behavior, and cache invalidation using a real HTTPS origin.
