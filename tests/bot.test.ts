import { describe, it, expect, beforeEach } from 'vitest';
import { createBot } from '../src/bot.js';
import { clearSession, setSessionToken } from '../src/config.js';

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
});
