import crypto from 'node:crypto';
import { query } from '../../db/index.js';
import { GenXClient } from './GenXClient.js';

const FEATURE_PROMPTS = {
  chat: 'You are FaithHaven’s pastoral assistant. Offer compassionate, non-authoritative guidance. Clearly distinguish generated reflection from scripture. Do not claim divine authority, diagnose, or provide crisis, medical, legal, or financial advice.',
  sermon: 'You are a writing assistant for a Christian sermon draft. Produce a clearly structured draft and distinguish any generated interpretation from scripture.',
  liturgy: 'You are a writing assistant for a Christian liturgy draft. Use respectful language and clearly label it as a draft for local pastoral review.',
  devotional: 'You are a writing assistant for a devotional draft. Do not invent Bible quotations; use references supplied by the user and label all generated reflection as a draft.',
  prayer: 'You are a prayer-support assistant. Offer gentle, optional prayer language and never represent generated guidance as authoritative scripture.',
  youth: 'You are a youth ministry content drafting assistant. Create age-appropriate, safe content and clearly label it as a draft.',
  family: 'You are a family devotional drafting assistant. Create inclusive, age-appropriate material and clearly label it as a draft.',
  moderation: 'You are a content moderation assistant. Return a concise safety assessment without reproducing harmful content.',
};

export class AIService {
  constructor({ client = new GenXClient() } = {}) {
    this.client = client;
  }

  async generate({ user, feature, prompt, conversationId = null, metadata = {} }) {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const systemPrompt = FEATURE_PROMPTS[feature];
    if (!systemPrompt) {
      const error = new Error('Unsupported AI feature');
      error.status = 400;
      error.code = 'AI_FEATURE_UNSUPPORTED';
      throw error;
    }

    const usage = await query(
      `SELECT count(*)::int AS count FROM ai_requests
       WHERE user_id = $1 AND status = 'succeeded' AND created_at >= date_trunc('month', now())`,
      [user.id],
    );
    if (usage.rows[0].count >= user.ai_quota_monthly) {
      const error = new Error('Your monthly AI allowance has been reached.');
      error.status = 429;
      error.code = 'AI_QUOTA_EXCEEDED';
      throw error;
    }

    await query(
      `INSERT INTO ai_requests(request_id, user_id, feature, model, status)
       VALUES($1, $2, $3, $4, 'started')`,
      [requestId, user.id, feature, process.env.GENX_MODEL || 'faithhaven-default'],
    );

    try {
      const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }];
      const result = await this.client.generate({ messages, feature, requestId });
      const latency = Date.now() - startedAt;
      await query(
        `UPDATE ai_requests SET status = 'succeeded', input_units = $2, output_units = $3, latency_ms = $4, completed_at = now()
         WHERE request_id = $1`,
        [requestId, result.inputUnits, result.outputUnits, latency],
      );

      if (conversationId) {
        await query(`INSERT INTO ai_messages(conversation_id, role, content) VALUES($1, 'user', $2), ($1, 'assistant', $3)`, [conversationId, prompt, result.content]);
        await query(`UPDATE ai_conversations SET updated_at = now() WHERE id = $1`, [conversationId]);
      }

      return { requestId, content: result.content, metadata };
    } catch (error) {
      await query(
        `UPDATE ai_requests SET status = 'failed', error_code = $2, latency_ms = $3, completed_at = now() WHERE request_id = $1`,
        [requestId, error.code || 'AI_SERVICE_FAILURE', Date.now() - startedAt],
      );
      throw error;
    }
  }
}
