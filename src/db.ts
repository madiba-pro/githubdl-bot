export interface D1PreparedStatementLike {
  bind(...values: any[]): D1PreparedStatementLike;
  run<T = Record<string, any>>(): Promise<{ success: boolean; meta?: any }>;
  all<T = Record<string, any>>(): Promise<{ results?: T[]; success: boolean }>;
  first<T = Record<string, any>>(colName?: string): Promise<T | null>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  exec?(query: string): Promise<any>;
}

export interface TelegramUserData {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}

export interface ActivityLogData {
  userId: number;
  username?: string;
  action: string;
  details?: string;
}

export interface DbUserRecord {
  user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbActivityLogRecord {
  id: number;
  user_id: number;
  username: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export async function initDb(db: D1DatabaseLike): Promise<void> {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;

  const activityLogsTable = `
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    );
  `;

  try {
    if (typeof db.exec === 'function') {
      await db.exec(`${usersTable}\n${activityLogsTable}`);
    } else {
      await db.prepare(usersTable).run();
      await db.prepare(activityLogsTable).run();
    }
  } catch (err) {
    console.error('Error initializing D1 Database tables:', err);
  }
}

export async function upsertUser(db: D1DatabaseLike, user: TelegramUserData): Promise<void> {
  const now = new Date().toISOString();
  const sql = `
    INSERT INTO users (user_id, username, first_name, last_name, language_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      language_code = excluded.language_code,
      updated_at = excluded.updated_at;
  `;

  try {
    await db
      .prepare(sql)
      .bind(
        user.id,
        user.username || null,
        user.first_name || null,
        user.last_name || null,
        user.language_code || null,
        now,
        now
      )
      .run();
  } catch (err) {
    console.error(`Error upserting user ${user.id} in D1:`, err);
  }
}

export async function logUserActivity(db: D1DatabaseLike, log: ActivityLogData): Promise<void> {
  const now = new Date().toISOString();
  const sql = `
    INSERT INTO activity_logs (user_id, username, action, details, created_at)
    VALUES (?, ?, ?, ?, ?);
  `;

  try {
    await db
      .prepare(sql)
      .bind(
        log.userId,
        log.username || null,
        log.action,
        log.details || null,
        now
      )
      .run();
  } catch (err) {
    console.error(`Error logging user activity for user ${log.userId} in D1:`, err);
  }
}

export async function getUser(db: D1DatabaseLike, userId: number): Promise<DbUserRecord | null> {
  try {
    const sql = `SELECT * FROM users WHERE user_id = ?;`;
    const res = await db.prepare(sql).bind(userId).first<DbUserRecord>();
    return res || null;
  } catch (err) {
    console.error(`Error fetching user ${userId} from D1:`, err);
    return null;
  }
}

export async function getUserLogs(
  db: D1DatabaseLike,
  userId: number,
  limit: number = 50
): Promise<DbActivityLogRecord[]> {
  try {
    const sql = `SELECT * FROM activity_logs WHERE user_id = ? ORDER BY id DESC LIMIT ?;`;
    const res = await db.prepare(sql).bind(userId, limit).all<DbActivityLogRecord>();
    return res.results || [];
  } catch (err) {
    console.error(`Error fetching user logs for ${userId} from D1:`, err);
    return [];
  }
}
