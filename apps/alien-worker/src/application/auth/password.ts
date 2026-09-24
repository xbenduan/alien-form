/**
 * 密码哈希工具：pbkdf2_sha256$iterations$salt$hash。
 *
 * Cloudflare Workers 的 WebCrypto PBKDF2 迭代上限为 100000，超过会直接抛错，
 * 故这里固定 100000（seed 需与运行端对齐）。
 */
const PASSWORD_ALGORITHM = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_KEY_LENGTH = 32; // bytes
const PASSWORD_HASH = "SHA-256";
const MAX_ITERATIONS = 100_000;

function toHex(buffer: ArrayBufferLike): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 把字符串编码为独立的 ArrayBuffer。
 * 新版 TS 里 Uint8Array 泛型化为 Uint8Array<ArrayBufferLike>，无法直接满足 WebCrypto
 * 参数要求的具体 ArrayBuffer；这里拷贝到新分配的 ArrayBuffer，规避类型不兼容。
 */
function encodeUtf8(text: string): ArrayBuffer {
  const view = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function randomHex(byteLength: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(byteLength)).buffer);
}

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encodeUtf8(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encodeUtf8(salt), iterations, hash: PASSWORD_HASH },
    key,
    PASSWORD_KEY_LENGTH * 8,
  );
  return toHex(bits);
}

/** 生成新密码哈希：pbkdf2_sha256$iterations$salt$hash。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, PASSWORD_ITERATIONS);
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

/** 常数时间比较，避免时序侧信道。 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** 校验明文密码与存储哈希是否匹配。 */
export async function verifyPassword(password: string, stored: unknown): Promise<boolean> {
  if (typeof stored !== "string" || !stored) return false;
  const [algorithm, iterations, salt, hash] = stored.split("$");
  const iterationCount = Number(iterations);
  // Workers 上限 100000，超过无法校验直接判负。
  if (
    algorithm !== PASSWORD_ALGORITHM ||
    !Number.isInteger(iterationCount) ||
    iterationCount < 1 ||
    iterationCount > MAX_ITERATIONS ||
    !salt ||
    !hash
  ) {
    return false;
  }
  const actual = hexToBytes(await pbkdf2(password, salt, iterationCount));
  const expected = hexToBytes(hash);
  return timingSafeEqual(actual, expected);
}
