import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBot, escapeMarkdown } from '../src/bot.js';
import { clearSession, setSessionToken, setSessionRepo } from '../src/config.js';
import { GitHubService } from '../src/github.js';

describe('Bot Command Permissions', () => {
  const chatId = 9999;

  const mockBotInfo = {
    id: 123456,
    is_bot: true as const,
    first_name: 'TestBot',
    username: 'TestBot',
    can_join_groups: true,
    can_read_all_group_messages: true,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
    has_topics_enabled: false,
    allows_users_to_create_topics: false,
    can_manage_bots: false,
    supports_join_request_queries: false,
  };

  beforeEach(async () => {
    await clearSession(chatId);
    vi.restoreAllMocks();
  });

  it('instantiates grammY bot without throwing', () => {
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
    expect(bot).toBeDefined();
    expect(typeof bot.command).toBe('function');
    expect(typeof bot.on).toBe('function');
  });

  it('requires user custom token for /createrepo even if default token is configured', async () => {
    const defaultToken = 'ghp_default_server_token_123';
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', defaultToken);

    bot.botInfo = mockBotInfo;

    const sentMessages: Array<{ method: string; payload: any }> = [];
    bot.api.config.use((_prev, method, params) => {
      sentMessages.push({ method, payload: params });
      return { ok: true, result: true } as any;
    });

    // Invoke /createrepo without setting custom token in session
    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private', first_name: 'Tester' },
        from: { id: chatId, is_bot: false, first_name: 'Tester' },
        text: '/createrepo my-new-repo',
        entities: [{ type: 'bot_command', offset: 0, length: 11 }],
      },
    });

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].method).toBe('sendMessage');
    expect(sentMessages[0].payload.text).toContain('GitHub token missing');
  });

  it('allows /createrepo if user custom token is set in session', async () => {
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'ghp_default');

    bot.botInfo = mockBotInfo;

    const sentMessages: Array<{ method: string; payload: any }> = [];
    bot.api.config.use((_prev, method, params) => {
      sentMessages.push({ method, payload: params });
      return { ok: true, result: true } as any;
    });

    await setSessionToken(chatId, 'ghp_user_custom_token');

    // Invoke /createrepo with custom token set in session
    await bot.handleUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private', first_name: 'Tester' },
        from: { id: chatId, is_bot: false, first_name: 'Tester' },
        text: '/createrepo my-new-repo',
        entities: [{ type: 'bot_command', offset: 0, length: 11 }],
      },
    });

    expect(sentMessages.length).toBeGreaterThan(0);
    // Should NOT be token missing error, but the creating repo loading message
    expect(sentMessages[0].payload.text).toContain('Creating repository on GitHub');
  });

  it('requires user custom token for document upload even if default token is configured', async () => {
    const defaultToken = 'ghp_default_server_token_123';
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', defaultToken);

    bot.botInfo = mockBotInfo;

    const sentMessages: Array<{ method: string; payload: any }> = [];
    bot.api.config.use((_prev, method, params) => {
      sentMessages.push({ method, payload: params });
      return { ok: true, result: true } as any;
    });

    // Send a document without setting user custom token
    await bot.handleUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private', first_name: 'Tester' },
        from: { id: chatId, is_bot: false, first_name: 'Tester' },
        document: {
          file_id: 'doc123',
          file_unique_id: 'doc123unique',
          file_name: 'test.txt',
          mime_type: 'text/plain',
          file_size: 100,
        },
      },
    });

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].method).toBe('sendMessage');
    expect(sentMessages[0].payload.text).toContain('GitHub token is missing');
  });

  it('handles download repo errors gracefully and responds with error message', async () => {
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'ghp_token');
    bot.botInfo = mockBotInfo;

    vi.spyOn(GitHubService.prototype, 'downloadArchive').mockRejectedValue(new Error('GitHub connection timeout'));

    const sentMessages: Array<{ method: string; payload: any }> = [];
    bot.api.config.use((_prev, method, params) => {
      sentMessages.push({ method, payload: params });
      return { ok: true, result: true } as any;
    });

    await bot.handleUpdate({
      update_id: 4,
      message: {
        message_id: 4,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private', first_name: 'Tester' },
        from: { id: chatId, is_bot: false, first_name: 'Tester' },
        text: '/download https://github.com/octocat/Test-Repo',
        entities: [{ type: 'bot_command', offset: 0, length: 9 }],
      },
    });

    expect(sentMessages.length).toBe(2);
    expect(sentMessages[1].payload.text).toContain('Failed to download repository archive');
    expect(sentMessages[1].payload.text).toContain('GitHub connection timeout');
  });

  it('rejects downloading archives larger than 50 MB with friendly message', async () => {
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'ghp_token');
    bot.botInfo = mockBotInfo;

    // Mock GitHubService.prototype.downloadArchive to return a 51MB buffer
    vi.spyOn(GitHubService.prototype, 'downloadArchive').mockResolvedValue({
      buffer: new Uint8Array(51 * 1024 * 1024),
      fileName: 'large-repo.zip',
    });

    const sentMessages: Array<{ method: string; payload: any }> = [];
    bot.api.config.use((_prev, method, params) => {
      sentMessages.push({ method, payload: params });
      return { ok: true, result: true } as any;
    });

    await bot.handleUpdate({
      update_id: 5,
      message: {
        message_id: 5,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private', first_name: 'Tester' },
        from: { id: chatId, is_bot: false, first_name: 'Tester' },
        text: '/download https://github.com/octocat/Large-Repo',
        entities: [{ type: 'bot_command', offset: 0, length: 9 }],
      },
    });

    expect(sentMessages.length).toBe(2);
    // Message 1: Downloading repository archive...
    // Message 2: Repository archive is too large (51.00 MB)...
    expect(sentMessages[1].payload.text).toContain('Repository archive is too large');
    expect(sentMessages[1].payload.text).toContain('51.00 MB');
  });

  it('escapes markdown characters correctly in escapeMarkdown utility', () => {
    expect(escapeMarkdown('user_name_with_underscores')).toBe('user\\_name\\_with\\_underscores');
    expect(escapeMarkdown('repo*with`special[chars')).toBe('repo\\*with\\`special\\[chars');
  });

  it('escapes repository names containing underscores when downloading archives', async () => {
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'ghp_token');
    bot.botInfo = mockBotInfo;

    vi.spyOn(GitHubService.prototype, 'downloadArchive').mockResolvedValue({
      buffer: new Uint8Array(100),
      fileName: 'my_user-my_repo-main.zip',
    });

    const sentMessages: Array<{ method: string; payload: any }> = [];
    bot.api.config.use((_prev, method, params) => {
      sentMessages.push({ method, payload: params });
      return { ok: true, result: true } as any;
    });

    await bot.handleUpdate({
      update_id: 6,
      message: {
        message_id: 6,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private', first_name: 'Tester' },
        from: { id: chatId, is_bot: false, first_name: 'Tester' },
        text: '/download https://github.com/my_user/my_repo',
        entities: [{ type: 'bot_command', offset: 0, length: 9 }],
      },
    });

    expect(sentMessages.length).toBe(3);
    // Downloading message should escape underscores
    expect(sentMessages[0].payload.text).toContain('my\\_user/my\\_repo');
    // Document caption should escape underscores
    expect(sentMessages[2].method).toBe('sendDocument');
    expect(sentMessages[2].payload.caption).toContain('my\\_user/my\\_repo');
  });

  it('escapes user inputs in /setrepo and /status when containing underscores', async () => {
    const bot = createBot('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', 'ghp_token');
    bot.botInfo = mockBotInfo;

    const sentMessages: Array<{ method: string; payload: any }> = [];
    bot.api.config.use((_prev, method, params) => {
      sentMessages.push({ method, payload: params });
      return { ok: true, result: true } as any;
    });

    await bot.handleUpdate({
      update_id: 7,
      message: {
        message_id: 7,
        date: Math.floor(Date.now() / 1000),
        chat: { id: chatId, type: 'private', first_name: 'Tester' },
        from: { id: chatId, is_bot: false, first_name: 'Tester' },
        text: '/setrepo my_org/my_cool_repo',
        entities: [{ type: 'bot_command', offset: 0, length: 8 }],
      },
    });

    expect(sentMessages[0].payload.text).toContain('my\\_org/my\\_cool\\_repo');
  });
});
