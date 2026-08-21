# API Overview

All API paths are same-origin under `/api`. Browser requests use `credentials: include`; no bearer token is stored in browser storage. Obtain a CSRF token from `GET /api/auth/csrf` before any state-changing request and send it as `x-csrf-token`.

| Area | Principal routes |
|---|---|
| Authentication | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/verify-email`, `/auth/request-password-reset`, `/auth/reset-password`, `/auth/change-password`; `GET /auth/me` |
| AI | `GET /ai/conversations`, `GET|DELETE /ai/conversations/:id`, `POST /ai/chat`, `POST /ai/generate/:feature` |
| Prayer | `GET|POST /prayer-journal`, `PATCH|DELETE /prayer-journal/:id`, `GET|POST /prayer-wall`, `POST /prayer-wall/:id/pray`, `POST /prayer-wall/:id/report` |
| Calendar and devotionals | `GET|POST /calendar`, `PUT|DELETE /calendar/:id`, `GET|POST /devotionals` |
| Documents and media | `GET|POST /documents`, `PUT /documents/:id`, `GET /media/bible_audio`, `GET /media/worship_music` |
| Public submission | `POST /contact`, `POST /newsletter/subscribe`, `POST /newsletter/unsubscribe` |
| Billing | `POST /payments/checkout`, `POST /payments/payfast/itn` |
| Administration | `GET /admin/stats`, `/admin/audit-logs`, `/admin/moderation/reports` |

Responses use either a resource payload or an `error` object with a stable `code` and safe user-facing `message`. Every API response includes `x-request-id` for operational correlation.

The payment callback is a server-to-server endpoint; it must be configured in PayFast and never invoked from the application UI to mark a payment successful. Media stream URLs must be licensed and saved through a controlled provider/admin workflow.
