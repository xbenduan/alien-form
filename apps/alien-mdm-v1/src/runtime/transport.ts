const TOKEN_KEY = "alien-mdm-token";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class Transport {
  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string | null): void {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async send<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new HttpError(
        typeof body.error === "string" ? body.error : `Request failed: ${response.status}`,
        response.status,
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

export const transport = new Transport();
