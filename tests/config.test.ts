import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSession,
  setSessionToken,
  setSessionRepo,
  setSessionBranch,
  setSessionSubpath,
  clearSession,
} from '../src/config.js';

describe('Config Session Store', () => {
  const chatId = 12345678;

  beforeEach(() => {
    clearSession(chatId);
  });

  it('stores and retrieves session data correctly', () => {
    setSessionToken(chatId, 'ghp_test123');
    setSessionRepo(chatId, 'testowner', 'testrepo');
    setSessionBranch(chatId, 'feature-branch');
    setSessionSubpath(chatId, '/sub/folder/');

    const session = getSession(chatId);
    expect(session.githubToken).toBe('ghp_test123');
    expect(session.repoOwner).toBe('testowner');
    expect(session.repoName).toBe('testrepo');
    expect(session.branch).toBe('feature-branch');
    expect(session.subpath).toBe('sub/folder'); // normalized
  });

  it('clears session correctly', () => {
    setSessionToken(chatId, 'ghp_test123');
    clearSession(chatId);
    const session = getSession(chatId);
    expect(session.githubToken).toBeUndefined();
  });
});
