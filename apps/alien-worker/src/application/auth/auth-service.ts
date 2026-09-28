import { AppError, unauthorized } from "@alien-form/alienbase";
import { randomHex, verifyPassword } from "./password.ts";
import type { LoginRequest, LoginResponse } from "@alien-form/protocol";
import type { AccessProfileProvider } from "@alien-form/alienbase";
import type { CompiledModelProvider, RecordReader } from "@alien-form/alienbase";
import { publicRecord } from "@alien-form/alienbase";
import userModule from "../../models/_sys_user/index.ts";

export interface Session {
  token: string;
  userId: string;
}

/** 会话持久化端口，由 Worker 的 D1 适配器实现。 */
export interface SessionRepository {
  find(token: string): Promise<Session | undefined>;
  create(session: Session): Promise<void>;
  remove(token: string): Promise<void>;
}

/** 认证服务：密码登录、登出与会话查询。 */
export class AuthService {
  constructor(
    private readonly models: CompiledModelProvider,
    private readonly records: RecordReader,
    private readonly sessions: SessionRepository,
    private readonly profiles: AccessProfileProvider,
  ) {}

  async login(body: LoginRequest): Promise<LoginResponse> {
    const providerName = body.provider ?? "password";
    if (providerName !== "password") throw new AppError(`不支持的登录方式：${providerName}`, 400);
    const username = String(body.username ?? body.account ?? "").trim();
    const password = String(body.password ?? "");
    const model = await this.models.get(userModule.schema.name);
    if (!model) throw new AppError("用户模型尚未初始化", 500);
    const user = username ? await this.records.findByField(model, "username", username) : undefined;
    if (!user || !password || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized("账号或密码错误");
    }

    const session: Session = {
      token: randomHex(32),
      userId: String(user.id),
    };
    await this.sessions.create(session);
    const profile = await this.profiles.profile(session.userId);
    return {
      token: session.token,
      user: {
        ...publicRecord(userModule.schema, user),
        canCreateModel: profile.canCreateModel,
      },
      provider: providerName,
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.sessions.remove(token);
  }

  /** token → 会话（找不到返回 undefined，由中间件转 401）。 */
  async resolveSession(token: string): Promise<Session | undefined> {
    return this.sessions.find(token);
  }
}
