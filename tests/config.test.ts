import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSession,
  setSessionToken,
  setSessionRepo,
  setSessionBranch,
  setSessionSubpath,
  clearSession,
  KVNamespaceLike,
} from '../src/config.js';

describe('Config Session Store', () => {
  const chatId = 12345678;

  beforeEach(async () => {
    await clearSession(chatId);
  });

  it('stores and retrieves session data correctly in memory', async () => {
    await setSessionToken(chatId, 'ghp_test123');
    await setSessionRepo(chatId, 'testowner', 'testrepo');
    await setSessionBranch(chatId, 'feature-branch');
    await setSessionSubpath(chatId, '/sub/folder/');

    const session = await getSession(chatId);
    expect(session.githubToken).toBe('ghp_test123');
    expect(session.repoOwner).toBe('testowner');
    expect(session.repoName).toBe('testrepo');
    expect(session.branch).toBe('feature-branch');
    expect(session.subpath).toBe('sub/folder'); // normalized
  });

  it('clears session correctly', async () => {
    await setSessionToken(chatId, 'ghp_test123');
    await clearSession(chatId);
    const session = await getSession(chatId);
    expect(session.githubToken).toBeUndefined();
  });

  it('interacts with mock KV Namespace when provided', async () => {
    const mockStore = new Map<string, string>();
    const mockKv: KVNamespaceLike = {
      async get(key: string, type?: 'json' | 'text') {
        const val = mockStore.get(key);
        if (!val) return null;
        return type === 'json' ? JSON.parse(val) : val;
      },
      async put(key: string, value: string) {
        mockStore.set(key, value);
      },
      async delete(key: string) {
        mockStore.delete(key);
      },
    };

    await setSessionToken(chatId, 'ghp_kv_token', mockKv);
    await setSessionRepo(chatId, 'kvowner', 'kvrepo', mockKv);

    expect(mockStore.has(`session:${chatId}`)).toBe(true);

    const fetchedSession = await getSession(chatId, mockKv);
    expect(fetchedSession.githubToken).toBe('ghp_kv_token');
    expect(fetchedSession.repoOwner).toBe('kvowner');

    await clearSession(chatId, mockKv);
    expect(mockStore.has(`session:${chatId}`)).toBe(false);
  });
});
