import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDb,
  upsertUser,
  logUserActivity,
  getUser,
  getUserLogs,
  D1DatabaseLike,
  D1PreparedStatementLike,
  DbUserRecord,
  DbActivityLogRecord,
} from '../src/db.js';

export class MockD1Database implements D1DatabaseLike {
  public usersMap = new Map<number, DbUserRecord>();
  public logsList: DbActivityLogRecord[] = [];
  public execCalled = false;
  private autoIncrementId = 1;

  async exec(_query: string): Promise<any> {
    this.execCalled = true;
    return { count: 0, duration: 0 };
  }

  prepare(query: string): D1PreparedStatementLike {
    let boundParams: any[] = [];
    const self = this;

    const stmt: D1PreparedStatementLike = {
      bind(...values: any[]) {
        boundParams = values;
        return stmt;
      },
      async run() {
        if (query.includes('CREATE TABLE')) {
          return { success: true };
        }
        if (query.includes('INSERT INTO users')) {
          const [user_id, username, first_name, last_name, language_code, created_at, updated_at] = boundParams;
          const existing = self.usersMap.get(user_id);
          const userRec: DbUserRecord = {
            user_id,
            username,
            first_name,
            last_name,
            language_code,
            created_at: existing ? existing.created_at : created_at,
            updated_at,
          };
          self.usersMap.set(user_id, userRec);
          return { success: true };
        }
        if (query.includes('INSERT INTO activity_logs')) {
          const [user_id, username, action, details, created_at] = boundParams;
          const logRec: DbActivityLogRecord = {
            id: self.autoIncrementId++,
            user_id,
            username,
            action,
            details,
            created_at,
          };
          self.logsList.push(logRec);
          return { success: true };
        }
        return { success: true };
      },
      async first<T = Record<string, any>>(): Promise<T | null> {
        if (query.includes('SELECT * FROM users WHERE user_id')) {
          const userId = boundParams[0];
          const user = self.usersMap.get(userId);
          return user ? (user as unknown as T) : null;
        }
        return null;
      },
      async all<T = Record<string, any>>(): Promise<{ results?: T[]; success: boolean }> {
        if (query.includes('SELECT * FROM activity_logs WHERE user_id')) {
          const userId = boundParams[0];
          const limit = boundParams[1] || 50;
          const filtered = self.logsList
            .filter((l) => l.user_id === userId)
            .sort((a, b) => b.id - a.id)
            .slice(0, limit);
          return { results: filtered as unknown as T[], success: true };
        }
        return { results: [], success: true };
      },
    };

    return stmt;
  }
}

describe('D1 Database Service', () => {
  let mockDb: MockD1Database;

  beforeEach(() => {
    mockDb = new MockD1Database();
  });

  it('initializes tables via exec', async () => {
    await initDb(mockDb);
    expect(mockDb.execCalled).toBe(true);
  });

  it('upserts user data correctly and preserves created_at on update', async () => {
    const user1 = {
      id: 1001,
      username: 'john_doe',
      first_name: 'John',
      last_name: 'Doe',
      language_code: 'en',
    };

    await upsertUser(mockDb, user1);
    const storedUser = await getUser(mockDb, 1001);

    expect(storedUser).not.toBeNull();
    expect(storedUser?.user_id).toBe(1001);
    expect(storedUser?.username).toBe('john_doe');
    expect(storedUser?.first_name).toBe('John');
    expect(storedUser?.last_name).toBe('Doe');

    const originalCreatedAt = storedUser?.created_at;

    // Update user name
    await upsertUser(mockDb, { ...user1, first_name: 'Johnny' });
    const updatedUser = await getUser(mockDb, 1001);

    expect(updatedUser?.first_name).toBe('Johnny');
    expect(updatedUser?.created_at).toBe(originalCreatedAt);
  });

  it('logs user activity and retrieves logs ordered by most recent', async () => {
    await logUserActivity(mockDb, {
      userId: 1001,
      username: 'john_doe',
      action: '/start',
      details: '/start command executed',
    });

    await logUserActivity(mockDb, {
      userId: 1001,
      username: 'john_doe',
      action: '/download',
      details: 'https://github.com/octocat/Hello-World',
    });

    const logs = await getUserLogs(mockDb, 1001);

    expect(logs.length).toBe(2);
    expect(logs[0].action).toBe('/download');
    expect(logs[1].action).toBe('/start');
  });

  it('returns null when querying non-existent user or empty logs', async () => {
    const nonExistent = await getUser(mockDb, 9999);
    expect(nonExistent).toBeNull();

    const emptyLogs = await getUserLogs(mockDb, 9999);
    expect(emptyLogs).toEqual([]);
  });
});
