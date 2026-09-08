import { isApiEnvelope } from "@alien-form/protocol";

const TOKEN_KEY = "alien-mdm-token";
const DEFAULT_TIMEOUT_MS = 20_000;

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface SendOptions extends RequestInit {
  /** 请求超时（毫秒）。默认 20s，传 0 关闭超时。 */
  timeoutMs?: number;
}

export class Transport {
  private onUnauthorized?: () => void;

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string | null): void {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  /** Register a callback fired when the session is rejected (HTTP 401). */
  setUnauthorizedHandler(handler: (() => void) | undefined): void {
    this.onUnauthorized = handler;
  }

  /**
   * 统一请求：自动带 token、解析标准信封 { status, msg, data }，成功时返回 data。
   * 健壮性：超时中断、网络异常、非 JSON / 非信封响应都会被归一为 HttpError。
   */
  async send<T>(path: string, init: SendOptions = {}): Promise<T> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;
    const headers = new Headers(rest.headers);
    headers.set("Accept", "application/json");
    if (rest.body) headers.set("Content-Type", "application/json");
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);

    const response = await this.fetchWithTimeout(path, { ...rest, headers, signal }, timeoutMs);
    const payload = await this.readBody(response);

    if (response.status === 401) {
      this.setToken(null);
      this.onUnauthorized?.();
    }

    // 标准信封：以 status 字段判定成败，与 HTTP 状态码互为佐证。
    if (isApiEnvelope(payload)) {
      if (payload.status === "success" && response.ok) return payload.data as T;
      throw new HttpError(payload.msg || `请求失败（${response.status}）`, response.status);
    }

    // 兜底：非信封响应（异常网关、静态回退等）。
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === "object" &&
        typeof (payload as { error?: unknown }).error === "string"
          ? (payload as { error: string }).error
          : `请求失败（${response.status}）`;
      throw new HttpError(message, response.status);
    }
    return payload as T;
  }

  private async fetchWithTimeout(
    path: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    if (timeoutMs <= 0) return this.safeFetch(path, init);

    const external = init.signal ?? undefined;
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    external?.addEventListener("abort", onExternalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.safeFetch(path, { ...init, signal: controller.signal });
    } catch (reason) {
      // 外部主动取消：原样抛出；否则视为超时。
      if (controller.signal.aborted && !external?.aborted) {
        throw new HttpError("请求超时，请稍后重试", 0);
      }
      throw reason;
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    }
  }

  private async safeFetch(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(path, init);
    } catch (reason) {
      if (reason instanceof HttpError) throw reason;
      if (reason instanceof DOMException && reason.name === "AbortError") throw reason;
      throw new HttpError("网络异常，请检查连接后重试", 0);
    }
  }

  private async readBody(response: Response): Promise<unknown> {
    if (response.status === 204) return null;
    const text = await response.text().catch(() => "");
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

export const transport = new Transport();
