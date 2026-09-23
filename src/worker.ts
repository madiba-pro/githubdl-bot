import { webhookCallback } from 'grammy';
import { createBot } from './bot.js';

export interface Env {
  BOT_TOKEN: string;
  WEBHOOK_SECRET?: string;
  DEFAULT_GITHUB_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.BOT_TOKEN) {
      return new Response('BOT_TOKEN environment variable is missing.', { status: 500 });
    }

    if (request.method !== 'POST') {
      return new Response('GitHub Uploader Telegram Bot is running.', { status: 200 });
    }

    // Validate secret token if configured
    if (env.WEBHOOK_SECRET) {
      const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token');
      if (incomingSecret !== env.WEBHOOK_SECRET) {
        return new Response('Unauthorized', { status: 403 });
      }
    }

    const bot = createBot(env.BOT_TOKEN, env.DEFAULT_GITHUB_TOKEN);
    const cb = webhookCallback(bot, 'cloudflare-mod');

    try {
      return await cb(request);
    } catch (err: any) {
      console.error('Worker webhook error:', err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
