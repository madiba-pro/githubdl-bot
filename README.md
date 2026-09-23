# 🚀 GitHub Uploader Telegram Bot

A high-performance Telegram Bot built with [grammY](https://grammy.dev/) and [@octokit/rest](https://github.com/octokit/rest.js) that allows users to upload single files or automatically extract `.zip` archives directly into GitHub repositories.

Deployable to both **Vercel** (Serverless) and **Cloudflare Workers** (Edge), as well as local long-polling for development.

---

## ✨ Features

- 📦 **Zip Archive Extraction**: Automatically unpack `.zip` files in memory and upload all files to GitHub in a single git tree commit.
- 📄 **Single File Uploads**: Upload any file or document directly to a specified GitHub repository and subfolder.
- 🛠️ **Repository Management**: Create public or private GitHub repositories directly from Telegram using `/createrepo`.
- ⚙️ **Custom Configurations**: Easily switch target repositories (`/setrepo`), branches (`/setbranch`), and subdirectories (`/setpath`).
- 🔐 **Token Security**: Support per-user Personal Access Tokens (`/settoken`) or fallback server default token.
- ⚡ **Multi-Platform Deployment**: Ready for Vercel, Cloudflare Workers, or Node.js.

---

## 🤖 Bot Commands

| Command | Description |
|---|---|
| `/start`, `/help` | Show bot guide and instructions |
| `/settoken <token>` | Set your GitHub Personal Access Token (PAT) |
| `/setrepo <owner/repo>` | Set active target repository (e.g. `octocat/Hello-World`) |
| `/createrepo <name> [private\|public]` | Create a new GitHub repo under your account |
| `/setbranch <branch>` | Set target branch (default: `main`) |
| `/setpath <subfolder>` | Set target folder path inside the repository |
| `/status` | View current active configurations |
| `/reset` | Reset current session settings |

---

## 🛠️ Environment Variables

Copy `.env.example` to `.env` for local testing:

```env
# Telegram Bot Token from @BotFather
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyZ

# Webhook Secret Token (Optional, recommended for production security)
WEBHOOK_SECRET=your_random_secret_string

# Default GitHub Token (Optional, fallback token for users without setting personal PAT)
DEFAULT_GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## ☁️ Deployment

### Option 1: Cloudflare Workers

1. Install dependencies & Wrangler CLI:
   ```bash
   npm install
   ```

2. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```

3. Set your environment variables (secrets) in Cloudflare Workers:
   ```bash
   npx wrangler secret put BOT_TOKEN
   npx wrangler secret put WEBHOOK_SECRET # Optional
   ```

4. Deploy to Cloudflare Workers:
   ```bash
   npm run deploy:cf
   ```

5. Register Telegram Webhook URL:
   ```bash
   curl -F "url=https://<your-worker>.<your-subdomain>.workers.dev" \
        -F "secret_token=your_webhook_secret" \
        https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
   ```

---

### Option 2: Vercel

1. Push this repository to GitHub or import it into Vercel.
2. In your Vercel Project Settings, add Environment Variables:
   - `BOT_TOKEN`
   - `WEBHOOK_SECRET` (optional)
   - `DEFAULT_GITHUB_TOKEN` (optional)
3. Deploy project to Vercel. Your webhook URL will be `https://<your-vercel-app>.vercel.app/api/webhook`.
4. Register Telegram Webhook URL:
   ```bash
   curl -F "url=https://<your-vercel-app>.vercel.app/api/webhook" \
        -F "secret_token=your_webhook_secret" \
        https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook
   ```

---

## 💻 Local Development

To run the bot locally using Telegram long-polling:

```bash
export BOT_TOKEN="your_bot_token_here"
npm run dev
```

---

## 🧪 Running Tests

Run unit tests with Vitest:

```bash
npm test
```

Check TypeScript types:

```bash
npm run typecheck
```

Build project bundles:

```bash
npm run build
```

---

## 📄 License

MIT
