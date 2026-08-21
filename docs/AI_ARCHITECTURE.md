# GenX-Only AI Architecture

All FaithHaven AI traffic follows one approved path:

```text
FaithHaven browser → FaithHaven API → AIService → GenXClient → GenX gateway
```

`GenXClient` is the sole class allowed to make AI gateway requests. It reads `GENX_API_URL`, `GENX_API_KEY`, `GENX_MODEL`, and `GENX_TIMEOUT_MS` only from server environment variables. These values must not use a frontend prefix, appear in source maps, enter Docker image layers, or be logged.

`AIService` is the required dependency for chat, sermon drafts, liturgy drafts, devotional drafts, prayer assistance, youth content, family content, and moderation assistance. It applies feature-specific safety prompts, checks verified-authenticated users and monthly quotas, records request status and latency, persists chat conversation history, and returns a controlled unavailable response when the GenX gateway fails.

## Gateway contract

Set `GENX_API_URL` to the approved GenX request endpoint. FaithHaven sends a JSON request with `request_id`, `model`, `feature`, `messages`, `temperature`, and `max_tokens`, along with `Authorization: Bearer <GENX_API_KEY>` and `x-request-id`. The gateway must return non-empty generated content in one of `content`, `message.content`, or `choices[0].message.content`, and may return token usage metadata.

This contract must be confirmed against the organization’s GenX documentation before production activation. If the actual contract differs, adapt `GenXClient` only; do not add feature-level gateway calls or fallback providers.

## Failure behavior

The client enforces an abort timeout, retries transient failures with exponential backoff, and opens a one-minute circuit breaker after repeated failures. It fails closed when unconfigured or unavailable. The UI surfaces an error and does not fabricate generated content.
