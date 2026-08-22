# Amarktai Property deployment handoff

## Domain and runtime

Publish the application, then connect `property.amarktai.co.za` in the project domain settings and create the DNS record requested by the hosting panel. Set `APP_BASE_URL=https://property.amarktai.co.za` after the domain is active. Do not use an IP address or preview URL for payment notifications.

## Deployment-only secrets

Add the variables only through the deployment environment’s secret manager. Do not create or commit `.env` or `.env.example` files for these credentials. The application keeps GenX and PayFast unavailable until all required variables are present, and browser code never receives these values.

| Capability | Required deployment variables | Safe activation condition |
|---|---|---|
| GenX media jobs | `GENX_API_KEY`; optional `GENX_BASE_URL` override | The documented default endpoint is `https://query.genx.sh`. Confirm the account, model availability, pricing, and commercial-use terms before enabling job dispatch. |
| GenX buyer-intelligence research | `GENX_API_KEY`; an official documented GenX session web-search request/response contract | The documented session-creation request accepts a model and system prompt. The workspace can record tenant-scoped, source-aware requests and internal research credits. Do **not** enable provider dispatch until GenX publishes or supplies the precise session-message, web-search, source-citation, and usage-response fields. |
| Licensed buyer-intelligence data | `LICENSED_AMENITY_PROVIDER`, `LICENSED_AMENITY_API_URL`, `LICENSED_AMENITY_API_KEY`, `LICENSED_AMENITY_FIELD_MAPPING_VERSION`, `LICENSED_AMENITY_TERMS_ACCEPTED_AT`, `LICENSED_AMENITY_APPROVAL_REFERENCE` | The option remains disabled until every value is set. The mapping version must identify an approved response mapping, the timestamp records terms acceptance, and the approval reference must identify the contractual or data-use approval. Even when all are present, the server's licensed adapter remains inert until a provider-specific response mapping is implemented and approved. |
| PayFast checkout and ITN | `PAYFAST_MODE`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, optional `PAYFAST_PASSPHRASE` | Configure the PayFast notification endpoint as `https://property.amarktai.co.za/api/payfast/itn`, complete sandbox replay tests, then use the production mode. |

## Operational controls

The PayFast endpoint records a notification before granting any entitlement, validates the merchant reference, amount, completion status, and signature, and treats a repeated provider transaction ID as an idempotent duplicate. The public return page must never unlock paid access by itself.

Research-credit top-ups use the same PayFast boundary. The server generates the checkout form for the fixed research-credit pack and the credit ledger receives a grant only after a valid ITN moves the order from `pending` to `paid`. A browser return does not add internal credits. Research requests must show their requested internal-credit cost; no debit is permitted until a provider request is successfully initiated against a documented session contract, and every debit or refund must be retained as an immutable ledger entry.

Portal adapters remain export-only until the portal supplies written API/feed approval and test credentials. Source refreshes must use platform-scheduled HTTP callbacks after deployment rather than process timers. Data cards must continue to show source, coverage, and refresh information.

The workspace persists the selected active organisation in the browser and submits that organisation identifier with dashboard actions. The server independently validates active membership and applies separate sales, building, task, and billing role boundaries. Members who only analyse data or reside in a complex do not receive dashboard management controls and cannot bypass these restrictions through direct procedure calls.

Building documents are uploaded through the managed storage service, with the file kept outside the database and only its tenant-scoped storage reference recorded. The current interface accepts PDF, JPEG, and PNG documents up to 5 MB and records the selected internal, owner, or resident visibility setting.

## Verified-data and provider prerequisites

The current application deliberately renders a source-labelled buyer-report shell rather than claiming live amenity, crime, or service coverage. No unverified source is silently promoted to a production layer, and crime material must remain period-, area-, and source-labelled rather than becoming a safety rating. SAPS publishes crime-statistics material separately, while OpenStreetMap’s public Nominatim and Overpass services impose usage constraints that require low-volume, cached, attributed usage rather than broad, uncached platform queries.[1] [2] [3]

For the selectable public amenity path, use a server-side, user-triggered lookup only. Cache identical address and amenity queries, identify the application with a non-default `User-Agent`, never implement client-side Nominatim autocomplete, and keep the Overpass query small with an explicit timeout and radius. The public option must remain replaceable by the licensed-provider path without a client release. Nominatim caps public usage at one request per second and requires caching; Overpass warns against using public instances as a general application backend or stitching broad geographic queries.[2] [3]

| Capability | Implemented boundary | Required before live activation |
|---|---|---|
| Buyer intelligence data | Controlled report snapshots, source summary, date placeholders, and public-share guardrails. | A licensed or documented data source, a coverage definition, an attribution format, a refresh cadence, and a retained source/version record for every imported layer. |
| SAPS crime context | A source-labelling policy that rejects a safety verdict. | A documented SAPS source, geography mapping, reporting period, and an approved display method that preserves the original statistical context. |
| GenX media | Server-side `POST /api/v1/generate` dispatch, `GET /api/v1/jobs/:id` status refresh, output URL retrieval, cancellation, credit lookup, idempotency keys, retry cap, and tenant-scoped audit records. | Add `GENX_API_KEY` only through deployment secrets, confirm the selected models are enabled for the account, and test a bounded sandbox or low-cost job before releasing it to users. |
| GenX buyer-intelligence research | Internal research-credit ledger, ITN-only top-up grant, guarded research queue, documented session creation, multi-source review, and source-provenance validation. | GenX’s public API reference documents creation of a session with a model and system prompt and confirms sessions can use web search, but it does not yet publish the session-message tool payload or citation response shape needed for safe automatic dispatch. Obtain that written contract, validate output attribution in a sandbox, and only then enable debits and provider calls. [5] |
| Scheduled refresh | `geoSourceRuns` records and a documented managed-scheduler design. No timer runs in application memory. | A deployed authenticated refresh endpoint, approved source-specific rate policy, idempotency key, back-off/retry policy, alert owner, and a successfully observed scheduled run. |
| PayFast | Server-generated signed checkout forms and ITN-only entitlement grant. | Merchant credentials, the correct notification configuration, and a sandbox replay against the official integration documentation before production cutover.[4] |

> **Do not activate a source or GenX dispatch merely because credentials exist.** Activation requires the applicable written data licence or provider contract and the associated deployment acceptance checks in this runbook.

## DNS, launch, and payment cutover checklist

## Final publish handoff — 2026-08-22

The release candidate completed `pnpm test` with **27 test files / 64 tests passing**, `pnpm check` with no TypeScript errors, and `pnpm build` successfully. Desktop and mobile visual reviews covered the public landing route, buyer-report preview, and buyer-intelligence workspace. The managed preview service was restarted and the current dashboard navigation module loaded without reproducing the earlier stale import message.

To publish, create or select the release checkpoint in the project management interface, use the **Publish** control, then connect `property.amarktai.co.za` and configure the requested DNS record. Confirm HTTPS before configuring OAuth origins, PayFast ITN, or any production callback URL. Do not add deployment secrets to source control or use a preview URL for provider callbacks.

The following capabilities are intentionally inactive at publish time unless their deployment conditions are met: automated GenX buyer-intelligence dispatch and credit debit (official session-message/search/citation/usage contract still required); licensed amenity-provider dispatch (approved provider-specific response mapping still required); PayFast checkout/ITN (merchant configuration and sandbox replay required); and scheduled source refresh (authenticated endpoint, rate policy, and observed scheduled run required). The zero-debit evidence-review queue, source-reviewed report records, controlled sharing, and public bounded amenity path remain available within their documented safeguards.

| Stage | Required action | Acceptance check |
|---|---|---|
| Domain | Connect `property.amarktai.co.za` and publish the DNS record requested by the hosting panel. | HTTPS resolves on the custom domain and the preview URL is not used in production settings. |
| Auth | Add the production callback origin to the identity provider configuration if required. | A new browser session can sign in and out on the custom domain. |
| PayFast sandbox | Set `PAYFAST_MODE=sandbox`; configure the sandbox ITN URL. | A valid sandbox ITN records one notification and one entitlement; a repeated notification does not create a second entitlement. |
| PayFast production | Change only after the sandbox flow has been replayed and reconciled. | A production payment remains pending until a valid verified ITN arrives. |
| GenX | Confirm the provider’s official asynchronous-job semantics before adding any dispatch call. | No job is billed or sent until the adapter’s capability check succeeds. |
| Portal publishing | Obtain an authorised API or feed account from each target portal. | An export record exists before any publication action, and all publication attempts are auditable. |

## Monitoring and incident response

Monitor the application’s request error rate, server logs, sign-in failures, payment-notification failures, source-refresh failures, and media-job error states. Configure the host’s alerting facility to notify the operations owner for a sustained server error rate, a failed payment notification, or a repeated scheduled-refresh failure. Do not include payment payloads, personal contact details, access tokens, or provider secrets in alerts.

For an incident, first preserve the relevant audit event, order or job identifier, and timestamp. Disable the affected capability with its environment variables or feature configuration rather than deleting operational records. For payment incidents, do not manually grant an entitlement until the original provider notification and order details have been reconciled. For a controlled-share concern, revoke the share from the workspace immediately and issue a replacement only if required.

## Backup and recovery

The database is the source of truth for structured operational data and the project storage service is the source of truth for uploaded files. Schedule managed database backups in the hosting environment before production launch, test a restore into an isolated environment, and keep an export of the migration history with the release artefact. Do not rely on a local sandbox directory for production file retention.

Recovery should begin by identifying the most recent known-good application release and database backup. Restore into an isolated target first, run the test suite, verify access boundaries and controlled-share revocation, then direct traffic only after the recovery checks pass. Avoid destructive database operations during an incident.

## Scheduled source refreshes

Use a managed scheduler or platform heartbeat to invoke an authenticated refresh endpoint. Each run should create a `geoSourceRuns` record with source key, source URL, record count, status, and completion time. A failed run must retain the last known good cached layer, mark its freshness state clearly, and notify operations after the configured retry policy is exhausted. No process timer or unmanaged background process should be required for refresh work.

## References

[1]: https://www.saps.gov.za/services/crimestats.php "South African Police Service: Crime Statistics"
[2]: https://operations.osmfoundation.org/policies/nominatim/ "OpenStreetMap Foundation: Nominatim Usage Policy"
[3]: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html "Overpass API: Common Rules"
[4]: https://developers.payfast.co.za/ "PayFast Developer Documentation"
[5]: https://genx.pro/docs/api "GenX Router API Documentation"
