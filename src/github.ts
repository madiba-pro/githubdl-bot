import { Octokit } from '@octokit/rest';

export interface UploadFileItem {
  path: string;
  content: Uint8Array;
}

export interface CommitResult {
  commitUrl: string;
  commitSha: string;
  filesCount: number;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  ref?: string;
}

/**
 * Parses a GitHub repository URL into owner, repo, and optional branch/ref.
 * Example URLs supported:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/main
 * - owner/repo
 */
export function parseGitHubUrl(urlInput: string): ParsedGitHubUrl | null {
  const cleanInput = urlInput.trim();
  if (!cleanInput) return null;

  try {
    let pathname = cleanInput;
    if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
      const parsedUrl = new URL(cleanInput);
      if (parsedUrl.hostname !== 'github.com' && parsedUrl.hostname !== 'www.github.com') {
        return null;
      }
      pathname = parsedUrl.pathname;
    }

    // Strip leading / and trailing .git or slashes
    pathname = pathname.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.git$/, '');

    const parts = pathname.split('/');
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1];

    if (!owner || !repo) return null;

    let ref: string | undefined = undefined;
    if (parts.length >= 4 && parts[2] === 'tree') {
      ref = parts.slice(3).join('/');
    }

    return { owner, repo, ref };
  } catch {
    return null;
  }
}

export class GitHubService {
  private octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit(token ? { auth: token } : {});
  }

  /**
   * Verify token validity by fetching authenticated user info.
   */
  async verifyToken(): Promise<{ login: string; name: string | null }> {
    const { data } = await this.octokit.users.getAuthenticated();
    return {
      login: data.login,
      name: data.name ?? null,
    };
  }

  /**
   * Create a new GitHub repository under user account or organization.
   */
  async createRepository(name: string, isPrivate: boolean = false, description?: string) {
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name,
      private: isPrivate,
      description: description || 'Uploaded via Telegram GitHub Uploader Bot',
      auto_init: true, // create initial commit with README
    });

    return {
      owner: data.owner.login,
      name: data.name,
      htmlUrl: data.html_url,
      defaultBranch: data.default_branch || 'main',
    };
  }

  /**
   * Get default branch name or latest commit SHA for a repository branch.
   */
  async getBranchInfo(owner: string, repo: string, branchName?: string) {
    // If branch is not specified, get repo details to find default branch
    let targetBranch = branchName;
    if (!targetBranch) {
      const { data: repoData } = await this.octokit.repos.get({
        owner,
        repo,
      });
      targetBranch = repoData.default_branch;
    }

    try {
      const { data: refData } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${targetBranch}`,
      });

      return {
        branch: targetBranch,
        commitSha: refData.object.sha,
        exists: true,
      };
    } catch (err: any) {
      if (err.status === 404) {
        return {
          branch: targetBranch,
          commitSha: '',
          exists: false,
        };
      }
      throw err;
    }
  }

  /**
   * Download repository zip archive as Buffer/Uint8Array.
   */
  async downloadArchive(owner: string, repo: string, ref?: string): Promise<{ buffer: Uint8Array; fileName: string }> {
    let archiveRef = ref;
    if (!archiveRef) {
      const { data: repoData } = await this.octokit.repos.get({ owner, repo });
      archiveRef = repoData.default_branch || 'main';
    }

    const response = await this.octokit.repos.downloadZipballArchive({
      owner,
      repo,
      ref: archiveRef,
    });

    const buffer = new Uint8Array(response.data as ArrayBuffer);
    const fileName = `${owner}-${repo}-${archiveRef}.zip`;

    return { buffer, fileName };
  }

  /**
   * Commit multiple files or extracted archive files directly to GitHub using Git Data API (Trees + Commits).
   */
  async commitFiles(options: {
    owner: string;
    repo: string;
    branch?: string;
    subpath?: string;
    files: UploadFileItem[];
    commitMessage: string;
  }): Promise<CommitResult> {
    const { owner, repo, files, commitMessage } = options;

    if (files.length === 0) {
      throw new Error('No files provided for commit.');
    }

    // 1. Get branch info
    const branchInfo = await this.getBranchInfo(owner, repo, options.branch);
    const branch = branchInfo.branch;

    // 2. Create blobs for each file
    const treeItems = await Promise.all(
      files.map(async (file) => {
        // Construct full target path inside repo
        let fullPath = file.path;
        if (options.subpath) {
          const cleanSubpath = options.subpath.replace(/^\/+|\/+$/g, '');
          fullPath = cleanSubpath ? `${cleanSubpath}/${file.path}` : file.path;
        }

        // Convert Uint8Array to base64 string
        const base64Content = Buffer.from(file.content).toString('base64');

        const { data: blob } = await this.octokit.git.createBlob({
          owner,
          repo,
          content: base64Content,
          encoding: 'base64',
        });

        return {
          path: fullPath,
          mode: '100644' as const, // standard file mode
          type: 'blob' as const,
          sha: blob.sha,
        };
      })
    );

    let parentCommitSha: string | undefined = undefined;
    let baseTreeSha: string | undefined = undefined;

    if (branchInfo.exists) {
      parentCommitSha = branchInfo.commitSha;
      const { data: parentCommit } = await this.octokit.git.getCommit({
        owner,
        repo,
        commit_sha: parentCommitSha,
      });
      baseTreeSha = parentCommit.tree.sha;
    }

    // 3. Create Tree
    const { data: newTree } = await this.octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: treeItems,
    });

    // 4. Create Commit
    const { data: newCommit } = await this.octokit.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: parentCommitSha ? [parentCommitSha] : [],
    });

    // 5. Update or Create Branch Ref
    if (branchInfo.exists) {
      await this.octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });
    } else {
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: newCommit.sha,
      });
    }

    const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`;

    return {
      commitUrl,
      commitSha: newCommit.sha,
      filesCount: files.length,
    };
  }
}
