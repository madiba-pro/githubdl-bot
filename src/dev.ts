import { createBot } from './bot.js';

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ Error: BOT_TOKEN environment variable is required for local dev runner.');
  process.exit(1);
}

const defaultGithubToken = process.env.DEFAULT_GITHUB_TOKEN;
const bot = createBot(token, defaultGithubToken);

console.log('🤖 Starting Telegram Bot in Long Polling mode...');
bot.start({
  onStart(botInfo) {
    console.log(`✅ Bot @${botInfo.username} is running locally! Press Ctrl+C to stop.`);
  },
});
