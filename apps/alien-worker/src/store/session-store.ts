import type { Session } from "../services/auth/auth-service.ts";

interface SessionRow {
  token: string;
  user_id: string;
  provider: string;
  created_at: number;
}

/** 会话仓储：sessions 表读写收口。Worker 无内存态，会话必须落库。 */
export class SessionStore {
  constructor(private readonly db: D1Database) {}

  async find(token: string): Promise<Session | undefined> {
    const row = await this.db
      .prepare(`SELECT token, user_id, provider, created_at FROM "sessions" WHERE token = ?`)
      .bind(token)
      .first<SessionRow>();
    if (!row) return undefined;
    return {
      token: row.token,
      userId: row.user_id,
      provider: row.provider,
      createdAt: row.created_at,
    };
  }

  async create(session: Session): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO "sessions" (token, user_id, provider, created_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(session.token, session.userId, session.provider, session.createdAt)
      .run();
  }

  async remove(token: string): Promise<void> {
    await this.db.prepare(`DELETE FROM "sessions" WHERE token = ?`).bind(token).run();
  }
}
