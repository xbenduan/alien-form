import { AppError, unauthorized } from "../../errors.ts";
import { USER_MODEL, publicRecord } from "../../domain/visibility.ts";
import { randomHex, verifyPassword } from "./password.ts";
import type { ModelRecord } from "@alien-form/validate";
import type { SchemaStore } from "../../store/schema-store.ts";
import type { RecordStore } from "../../store/record-store.ts";
import type { SessionStore } from "../../store/session-store.ts";

export interface Session {
  token: string;
  userId: string;
  provider: string;
  createdAt: number;
}

export interface LoginBody {
  provider?: string;
  username?: string;
  account?: string;
  password?: string;
  openid?: string;
}

export interface LoginResult {
  token: string;
  user: ModelRecord;
  provider: string;
}

/**
 * 登录 provider 契约：给定登录参数，认证成功返回用户记录，否则 undefined。
 * 新增登录方式（如 openid / sso）只需实现此接口并在 PROVIDERS 里登记。
 */
export interface AuthProvider {
  readonly name: string;
  authenticate(ctx: AuthService, body: LoginBody): Promise<ModelRecord | undefined>;
}

/** 账号密码 provider。 */
const passwordProvider: AuthProvider = {
  name: "password",
  async authenticate(ctx, body) {
    const username = String(body.username ?? body.account ?? "").trim();
    const password = String(body.password ?? "");
    if (!username || !password) return undefined;
    const user = await ctx.findUserByUsername(username);
    if (!user) return undefined;
    return (await verifyPassword(password, user.passwordHash)) ? user : undefined;
  },
};

const PROVIDERS: Record<string, AuthProvider> = {
  [passwordProvider.name]: passwordProvider,
};

/** 认证服务：登录 / 登出 / 会话查询，编排 provider 与各 store。 */
export class AuthService {
  constructor(
    private readonly schemas: SchemaStore,
    private readonly records: RecordStore,
    private readonly sessions: SessionStore,
  ) {}

  /** 按用户名查用户记录（供 provider 复用）。 */
  async findUserByUsername(username: string): Promise<ModelRecord | undefined> {
    const schema = await this.schemas.get(USER_MODEL);
    if (!schema) throw new AppError("用户模型未注册", 500);
    return this.records.findByField(schema, "username", username);
  }

  async login(body: LoginBody): Promise<LoginResult> {
    const providerName = body.provider ?? "password";
    const provider = PROVIDERS[providerName];
    if (!provider) throw new AppError(`不支持的登录方式：${providerName}`, 400);

    const user = await provider.authenticate(this, body);
    if (!user) throw unauthorized("账号或密码错误");

    const session: Session = {
      token: randomHex(32),
      userId: String(user.id),
      provider: provider.name,
      createdAt: Date.now(),
    };
    await this.sessions.create(session);
    return { token: session.token, user: publicRecord(USER_MODEL, user), provider: provider.name };
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.sessions.remove(token);
  }

  /** token → 会话（找不到返回 undefined，由中间件转 401）。 */
  async resolveSession(token: string): Promise<Session | undefined> {
    return this.sessions.find(token);
  }
}
