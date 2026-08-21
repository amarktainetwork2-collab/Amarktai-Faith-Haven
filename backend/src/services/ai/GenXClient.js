import crypto from 'node:crypto';
import { config } from '../../config.js';

export class GenXUnavailableError extends Error {
  constructor(code, message = 'The AI service is temporarily unavailable.') {
    super(message);
    this.name = 'GenXUnavailableError';
    this.code = code;
  }
}

const circuit = {
  failures: 0,
  openUntil: 0,
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class GenXClient {
  constructor({ fetchImpl = globalThis.fetch } = {}) {
    this.fetch = fetchImpl;
  }

  isConfigured() {
    return Boolean(config.genxApiUrl && config.genxApiKey);
  }

  async generate({ messages, feature, requestId, temperature = 0.4, maxTokens = 1_200 }) {
    if (!this.isConfigured()) {
      throw new GenXUnavailableError('GENX_NOT_CONFIGURED', 'AI is unavailable until the GenX gateway is configured.');
    }
    if (Date.now() < circuit.openUntil) {
      throw new GenXUnavailableError('GENX_CIRCUIT_OPEN');
    }

    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.genxTimeoutMs);
      try {
        const response = await this.fetch(config.genxApiUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${config.genxApiKey}`,
            'x-request-id': requestId,
          },
          signal: controller.signal,
          body: JSON.stringify({
            request_id: requestId,
            model: config.genxModel,
            feature,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
          if (!retryable) throw new GenXUnavailableError('GENX_REJECTED');
          throw new Error(`GenX returned ${response.status}`);
        }

        const body = await response.json();
        const content = body?.content ?? body?.message?.content ?? body?.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new GenXUnavailableError('GENX_INVALID_RESPONSE');
        }

        circuit.failures = 0;
        circuit.openUntil = 0;
        return {
          content: content.trim(),
          inputUnits: body?.usage?.input_tokens ?? body?.usage?.prompt_tokens ?? null,
          outputUnits: body?.usage?.output_tokens ?? body?.usage?.completion_tokens ?? null,
          providerRequestId: body?.request_id ?? body?.id ?? crypto.randomUUID(),
        };
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (error instanceof GenXUnavailableError) break;
        if (attempt < 2) await delay(250 * 2 ** attempt + Math.floor(Math.random() * 100));
      }
    }

    circuit.failures += 1;
    if (circuit.failures >= 3) circuit.openUntil = Date.now() + 60_000;
    if (lastError instanceof GenXUnavailableError) throw lastError;
    throw new GenXUnavailableError('GENX_REQUEST_FAILED');
  }
}
