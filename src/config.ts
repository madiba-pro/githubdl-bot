export interface ChatSession {
  githubToken?: string;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  subpath?: string;
}

// In-memory store for user configuration sessions across webhook invocations.
// Note: In serverless environments, in-memory store persists per container instance.
// Users can re-set variables anytime via bot commands.
const sessions = new Map<number, ChatSession>();

export function getSession(chatId: number): ChatSession {
  let session = sessions.get(chatId);
  if (!session) {
    session = {};
    sessions.set(chatId, session);
  }
  return session;
}

export function setSessionToken(chatId: number, token: string): void {
  const session = getSession(chatId);
  session.githubToken = token;
}

export function setSessionRepo(chatId: number, owner: string, name: string): void {
  const session = getSession(chatId);
  session.repoOwner = owner;
  session.repoName = name;
}

export function setSessionBranch(chatId: number, branch: string): void {
  const session = getSession(chatId);
  session.branch = branch;
}

export function setSessionSubpath(chatId: number, subpath: string): void {
  const session = getSession(chatId);
  // Normalize subpath: strip leading/trailing slashes
  const cleanPath = subpath.replace(/^\/+|\/+$/g, '');
  session.subpath = cleanPath;
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
}
