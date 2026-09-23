import { webhookCallback } from 'grammy';
import { createBot } from '../src/bot.js';

export default async function handler(req: any, res: any) {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    res.status(500).json({ error: 'BOT_TOKEN environment variable is missing.' });
    return;
  }

  const secretToken = process.env.WEBHOOK_SECRET;
  if (secretToken) {
    const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (incomingSecret !== secretToken) {
      res.status(403).json({ error: 'Unauthorized webhook request.' });
      return;
    }
  }

  const bot = createBot(botToken, process.env.DEFAULT_GITHUB_TOKEN);
  const cb = webhookCallback(bot, 'std/http');

  try {
    // Reconstruct Request object for grammy standard http handler
    const url = `https://${req.headers.host}${req.url}`;
    const method = req.method;
    const headers = new Headers(req.headers);
    const body = req.method === 'POST' ? JSON.stringify(req.body) : undefined;

    const request = new Request(url, { method, headers, body });
    const response = await cb(request);

    res.status(response.status);
    response.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value);
    });

    const responseText = await response.text();
    res.send(responseText);
  } catch (err: any) {
    console.error('Webhook Error:', err);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
