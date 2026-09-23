import { Bot, InputFile } from 'grammy';
import { extractZip } from './zip.js';
import { GitHubService, parseGitHubUrl } from './github.js';
import {
  getSession,
  setSessionToken,
  setSessionRepo,
  setSessionBranch,
  setSessionSubpath,
  clearSession,
  KVNamespaceLike,
} from './config.js';

export function escapeMarkdown(text: string): string {
  if (!text) return text;
  return text.replace(/[_*`\[]/g, '\\$&');
}

export function createBot(
  telegramBotToken: string,
  defaultGithubToken?: string,
  kv?: KVNamespaceLike
) {
  const bot = new Bot(telegramBotToken);

  // Global error handler for unhandled middleware errors
  bot.catch(async (err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
    try {
      await ctx.reply(`❌ An error occurred while processing your request: ${err.error instanceof Error ? err.error.message : 'Unknown error'}`);
    } catch (e) {
      console.error('Failed to send error message to user (CATCH_ERROR):', e);
    }
  });

  // Helper to resolve GitHub PAT for a chat
  const getGitHubToken = async (chatId: number): Promise<string | undefined> => {
    const session = await getSession(chatId, kv);
    return session.githubToken || defaultGithubToken || process.env.DEFAULT_GITHUB_TOKEN;
  };

  // Helper function to handle downloading repo zip and sending to Telegram
  const handleDownloadRepo = async (ctx: any, urlInput: string) => {
    const parsed = parseGitHubUrl(urlInput);
    if (!parsed) {
      await ctx.reply('⚠️ Invalid GitHub URL or repository path.\nExample: `https://github.com/octocat/Hello-World`', { parse_mode: 'Markdown' });
      return;
    }

    const ownerEsc = escapeMarkdown(parsed.owner);
    const repoEsc = escapeMarkdown(parsed.repo);

    const ghToken = await getGitHubToken(ctx.chat.id);
    await ctx.reply(`⏳ Downloading repository archive for *${ownerEsc}/${repoEsc}*...`, { parse_mode: 'Markdown' });

    try {
      const gh = new GitHubService(ghToken);
      const { buffer, fileName } = await gh.downloadArchive(parsed.owner, parsed.repo, parsed.ref);

      const sizeInMB = buffer.length / (1024 * 1024);
      if (sizeInMB > 50) {
        await ctx.reply(`❌ Repository archive is too large (${sizeInMB.toFixed(2)} MB). Telegram Bot API limits document uploads to 50 MB.`);
        return;
      }

      await ctx.reply(`📤 Sending repository zip archive (${sizeInMB.toFixed(2)} MB)...`);

      await ctx.replyWithDocument(new InputFile(buffer, fileName), {
        caption: `📦 *${ownerEsc}/${repoEsc}*\n🔗 https://github.com/${parsed.owner}/${parsed.repo}`,
        parse_mode: 'Markdown',
      });
    } catch (err: any) {
      await ctx.reply(`❌ Failed to download repository archive: ${err.message || 'Unknown error'}`);
    }
  };

  // /start & /help
  bot.command(['start', 'help'], async (ctx) => {
    const helpText = `
🤖 *GitHub Uploader & Downloader Telegram Bot*

I can help you:
1️⃣ *Upload* single files or extract \`.zip\` archives directly into your GitHub repositories!
2️⃣ *Download* any GitHub repository as a \`.zip\` file directly to Telegram!

📋 *Commands:*
• \`/download <url>\` - Download repository zip and send to Telegram (or simply send a \`github.com\` link!)
• \`/settoken <token>\` - Set your GitHub Personal Access Token
• \`/setrepo <owner/repo>\` - Set target GitHub repository (e.g. \`octocat/Hello-World\`)
• \`/createrepo <name> [private|public]\` - Create a new GitHub repository
• \`/setbranch <branch>\` - Set target branch (default: main)
• \`/setpath <folder>\` - Set target subfolder path inside repo
• \`/status\` - View current configuration status
• \`/reset\` - Clear current session settings

📥 *Downloading Repositories:*
Send any GitHub repository URL (e.g. \`https://github.com/octocat/Hello-World\`) or use \`/download <url>\` to get the \`.zip\` archive on Telegram!

📤 *Uploading Files:*
1. Configure your token & repository using \`/settoken\` and \`/setrepo\`.
2. Send any document or \`.zip\` file to this bot.
    `;
    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  });

  // /download <github_url>
  bot.command('download', async (ctx) => {
    const urlInput = ctx.match?.trim();
    if (!urlInput) {
      await ctx.reply('⚠️ Please provide a GitHub URL.\nUsage: `/download https://github.com/octocat/Hello-World`', { parse_mode: 'Markdown' });
      return;
    }
    await handleDownloadRepo(ctx, urlInput);
  });

  // Listen for GitHub repository URLs sent in plain text messages
  bot.on('message:text', async (ctx, next) => {
    const text = ctx.message.text.trim();

    // If message starts with a command slash, pass to other command handlers
    if (text.startsWith('/')) {
      return next();
    }

    if (text.includes('github.com/')) {
      await handleDownloadRepo(ctx, text);
    } else {
      return next();
    }
  });

  // /settoken <token>
  bot.command('settoken', async (ctx) => {
    const token = ctx.match?.trim();
    if (!token) {
      await ctx.reply('⚠️ Please provide a GitHub token.\nUsage: `/settoken ghp_xxxx`', { parse_mode: 'Markdown' });
      return;
    }

    try {
      const gh = new GitHubService(token);
      const user = await gh.verifyToken();
      await setSessionToken(ctx.chat.id, token, kv);
      const loginEsc = escapeMarkdown(user.login);
      const nameEsc = user.name ? escapeMarkdown(user.name) : 'No display name';
      await ctx.reply(`✅ Token verified and saved!\nConnected as: *${loginEsc}* (${nameEsc})`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`❌ Invalid token: ${err.message || 'Authentication failed'}`);
    }
  });

  // /setrepo <owner/repo>
  bot.command('setrepo', async (ctx) => {
    const repoInput = ctx.match?.trim();
    if (!repoInput || !repoInput.includes('/')) {
      await ctx.reply('⚠️ Please provide repository in `owner/repo` format.\nUsage: `/setrepo octocat/Hello-World`', { parse_mode: 'Markdown' });
      return;
    }

    const [owner, name] = repoInput.split('/');
    if (!owner || !name) {
      await ctx.reply('⚠️ Invalid repository format. Use `owner/repo`.', { parse_mode: 'Markdown' });
      return;
    }

    await setSessionRepo(ctx.chat.id, owner, name, kv);
    const ownerEsc = escapeMarkdown(owner);
    const nameEsc = escapeMarkdown(name);
    await ctx.reply(`✅ Target repository set to: *${ownerEsc}/${nameEsc}*`, { parse_mode: 'Markdown' });
  });

  // /createrepo <name> [private|public]
  bot.command('createrepo', async (ctx) => {
    const args = ctx.match?.trim().split(/\s+/) || [];
    const repoName = args[0];
    const visibility = args[1]?.toLowerCase();

    if (!repoName) {
      await ctx.reply('⚠️ Please specify repository name.\nUsage: `/createrepo my-new-repo [private|public]`', { parse_mode: 'Markdown' });
      return;
    }

    const session = await getSession(ctx.chat.id, kv);
    const userToken = session.githubToken;
    if (!userToken) {
      await ctx.reply('⚠️ GitHub token missing. Please set your token first using `/settoken <token>`', { parse_mode: 'Markdown' });
      return;
    }

    const isPrivate = visibility === 'private';

    try {
      await ctx.reply('⏳ Creating repository on GitHub...');
      const gh = new GitHubService(userToken);
      const repo = await gh.createRepository(repoName, isPrivate);

      await setSessionRepo(ctx.chat.id, repo.owner, repo.name, kv);
      const ownerEsc = escapeMarkdown(repo.owner);
      const nameEsc = escapeMarkdown(repo.name);
      const branchEsc = escapeMarkdown(repo.defaultBranch);
      await ctx.reply(`✅ Repository created successfully!\n\n🔗 Repo: [${ownerEsc}/${nameEsc}](${repo.htmlUrl})\n📁 Default branch: \`${branchEsc}\`\n\nIt is now set as your active repository.`, { parse_mode: 'Markdown' });
    } catch (err: any) {
      await ctx.reply(`❌ Failed to create repository: ${err.message || 'Unknown error'}`);
    }
  });

  // /setbranch <branch>
  bot.command('setbranch', async (ctx) => {
    const branch = ctx.match?.trim();
    if (!branch) {
      await ctx.reply('⚠️ Please specify a branch name.\nUsage: `/setbranch main`', { parse_mode: 'Markdown' });
      return;
    }

    await setSessionBranch(ctx.chat.id, branch, kv);
    const branchEsc = escapeMarkdown(branch);
    await ctx.reply(`✅ Target branch set to: \`${branchEsc}\``, { parse_mode: 'Markdown' });
  });

  // /setpath <subpath>
  bot.command('setpath', async (ctx) => {
    const subpath = ctx.match?.trim() || '';
    await setSessionSubpath(ctx.chat.id, subpath, kv);
    if (subpath) {
      const pathEsc = escapeMarkdown(subpath);
      await ctx.reply(`✅ Target folder path set to: \`${pathEsc}\``, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply(`✅ Target folder path cleared (root repository).`);
    }
  });

  // /status
  bot.command('status', async (ctx) => {
    const session = await getSession(ctx.chat.id, kv);
    const downloadToken = await getGitHubToken(ctx.chat.id);

    const tokenStatus = session.githubToken
      ? '✅ Custom Token set'
      : downloadToken
      ? '⚠️ Custom Token not set (Default Server Token for downloads only)'
      : '❌ Not configured';
    const repoStatus = session.repoOwner && session.repoName
      ? `\`${escapeMarkdown(session.repoOwner)}/${escapeMarkdown(session.repoName)}\``
      : '❌ Not configured';
    const branchStatus = session.branch ? `\`${escapeMarkdown(session.branch)}\`` : '`default branch`';
    const pathStatus = session.subpath ? `\`${escapeMarkdown(session.subpath)}\`` : '`root (/)`';

    const statusMsg = `
⚙️ *Current Configuration:*

🔑 *GitHub Token:* ${tokenStatus}
📦 *Repository:* ${repoStatus}
🌿 *Branch:* ${branchStatus}
📂 *Folder Path:* ${pathStatus}
    `;
    await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
  });

  // /reset
  bot.command('reset', async (ctx) => {
    await clearSession(ctx.chat.id, kv);
    await ctx.reply('✅ Session settings cleared.');
  });

  // Handle uploaded files (documents, zip archives)
  bot.on('message:document', async (ctx) => {
    const session = await getSession(ctx.chat.id, kv);
    const userToken = session.githubToken;

    if (!userToken) {
      await ctx.reply('⚠️ GitHub token is missing. Set your token using `/settoken <token>`', { parse_mode: 'Markdown' });
      return;
    }

    if (!session.repoOwner || !session.repoName) {
      await ctx.reply('⚠️ Target repository is not set. Set it using `/setrepo owner/repo` or create one using `/createrepo name`', { parse_mode: 'Markdown' });
      return;
    }

    const doc = ctx.message.document;
    const fileName = doc.file_name || 'uploaded_file';
    const fileNameEsc = escapeMarkdown(fileName);
    const isZip = fileName.endsWith('.zip') || doc.mime_type === 'application/zip' || doc.mime_type === 'application/x-zip-compressed';

    await ctx.reply(`⏳ Downloading file \`${fileNameEsc}\` (${(doc.file_size ? (doc.file_size / 1024).toFixed(1) : '?')} KB)...`, { parse_mode: 'Markdown' });

    try {
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${telegramBotToken}/${file.file_path}`;

      // Fetch file buffer from Telegram
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file from Telegram: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);

      const gh = new GitHubService(userToken);

      const ownerEsc = escapeMarkdown(session.repoOwner);
      const repoEsc = escapeMarkdown(session.repoName);
      const branchEsc = escapeMarkdown(session.branch || 'default');

      if (isZip) {
        await ctx.reply('📦 Extracting zip contents...');
        const extractedFiles = extractZip(fileBuffer);

        if (extractedFiles.length === 0) {
          await ctx.reply('❌ The uploaded zip file is empty or contains no valid files.');
          return;
        }

        await ctx.reply(`🚀 Uploading ${extractedFiles.length} files to GitHub repository *${ownerEsc}/${repoEsc}*...`, { parse_mode: 'Markdown' });

        const result = await gh.commitFiles({
          owner: session.repoOwner,
          repo: session.repoName,
          branch: session.branch,
          subpath: session.subpath,
          files: extractedFiles,
          commitMessage: ctx.message.caption || `Extract and upload ${fileName} via Telegram Bot`,
        });

        await ctx.reply(
          `✅ *Upload Successful!*\n\n` +
          `📦 *Files committed:* ${result.filesCount}\n` +
          `🌿 *Branch:* \`${branchEsc}\`\n` +
          `🔗 [View Commit on GitHub](${result.commitUrl})`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(`🚀 Uploading \`${fileNameEsc}\` to GitHub repository *${ownerEsc}/${repoEsc}*...`, { parse_mode: 'Markdown' });

        const result = await gh.commitFiles({
          owner: session.repoOwner,
          repo: session.repoName,
          branch: session.branch,
          subpath: session.subpath,
          files: [
            {
              path: fileName,
              content: fileBuffer,
            },
          ],
          commitMessage: ctx.message.caption || `Upload ${fileName} via Telegram Bot`,
        });

        await ctx.reply(
          `✅ *File Uploaded Successfully!*\n\n` +
          `📄 *File:* \`${fileNameEsc}\`\n` +
          `🌿 *Branch:* \`${branchEsc}\`\n` +
          `🔗 [View Commit on GitHub](${result.commitUrl})`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err: any) {
      await ctx.reply(`❌ Upload failed: ${err.message || 'Unknown error'}`);
    }
  });

  return bot;
}
