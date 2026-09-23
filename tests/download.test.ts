import { describe, it, expect } from 'vitest';
import { parseGitHubUrl } from '../src/github.js';

describe('GitHub URL Parser', () => {
  it('parses standard https repository URLs', () => {
    const res = parseGitHubUrl('https://github.com/octocat/Hello-World');
    expect(res).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      ref: undefined,
    });
  });

  it('parses URLs with .git suffix and trailing slash', () => {
    const res = parseGitHubUrl('https://github.com/octocat/Hello-World.git/');
    expect(res).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      ref: undefined,
    });
  });

  it('parses branch / tree URLs', () => {
    const res = parseGitHubUrl('https://github.com/octocat/Hello-World/tree/feature/test-branch');
    expect(res).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      ref: 'feature/test-branch',
    });
  });

  it('parses short owner/repo string', () => {
    const res = parseGitHubUrl('octocat/Hello-World');
    expect(res).toEqual({
      owner: 'octocat',
      repo: 'Hello-World',
      ref: undefined,
    });
  });

  it('returns null for non-github URLs or invalid inputs', () => {
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
    expect(parseGitHubUrl('invalid-url-string')).toBeNull();
    expect(parseGitHubUrl('')).toBeNull();
  });
});
