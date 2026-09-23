export interface ChatSession {
  githubToken?: string;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  subpath?: string;
}

export interface KVNamespaceLike {
  get(key: string, type?: 'json' | 'text'): Promise<any>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

// In-memory fallback cache
const memorySessions = new Map<number, ChatSession>();

function getKey(chatId: number): string {
  return `session:${chatId}`;
}

export async function getSession(chatId: number, kv?: KVNamespaceLike): Promise<ChatSession> {
  if (kv) {
    try {
      const data = await kv.get(getKey(chatId), 'json');
      if (data) {
        memorySessions.set(chatId, data);
        return data;
      }
    } catch (err) {
      console.error('Error fetching session from KV:', err);
    }
  }

  let session = memorySessions.get(chatId);
  if (!session) {
    session = {};
    memorySessions.set(chatId, session);
  }
  return session;
}

export async function saveSession(chatId: number, session: ChatSession, kv?: KVNamespaceLike): Promise<void> {
  memorySessions.set(chatId, session);
  if (kv) {
    try {
      await kv.put(getKey(chatId), JSON.stringify(session));
    } catch (err) {
      console.error('Error saving session to KV:', err);
    }
  }
}

export async function setSessionToken(chatId: number, token: string, kv?: KVNamespaceLike): Promise<void> {
  const session = await getSession(chatId, kv);
  session.githubToken = token;
  await saveSession(chatId, session, kv);
}

export async function setSessionRepo(chatId: number, owner: string, name: string, kv?: KVNamespaceLike): Promise<void> {
  const session = await getSession(chatId, kv);
  session.repoOwner = owner;
  session.repoName = name;
  await saveSession(chatId, session, kv);
}

export async function setSessionBranch(chatId: number, branch: string, kv?: KVNamespaceLike): Promise<void> {
  const session = await getSession(chatId, kv);
  session.branch = branch;
  await saveSession(chatId, session, kv);
}

export async function setSessionSubpath(chatId: number, subpath: string, kv?: KVNamespaceLike): Promise<void> {
  const session = await getSession(chatId, kv);
  const cleanPath = subpath.replace(/^\/+|\/+$/g, '');
  session.subpath = cleanPath;
  await saveSession(chatId, session, kv);
}

export async function clearSession(chatId: number, kv?: KVNamespaceLike): Promise<void> {
  memorySessions.delete(chatId);
  if (kv) {
    try {
      await kv.delete(getKey(chatId));
    } catch (err) {
      console.error('Error clearing session from KV:', err);
    }
  }
}
