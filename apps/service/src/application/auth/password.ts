const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function derive(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return hex(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: encoder.encode(salt), iterations, hash: "SHA-256" },
        key,
        256,
      ),
    ),
  );
}
/** 生成随机 credential 明文，只在签发响应中返回。 */
export function randomToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
/** 保存 SHA-256 token 摘要，数据库不保存 credential 明文。 */
export async function tokenHash(token: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(token))));
}
/** 使用与历史数据相同的 pbkdf2_sha256 格式生成密码摘要。 */
export async function hashPassword(password: string): Promise<string> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return `pbkdf2_sha256$100000$${salt}$${await derive(password, salt, 100_000)}`;
}
/** 验证历史密码摘要，严格检查算法、迭代数和摘要编码。 */
export async function verifyPassword(password: string, stored: unknown): Promise<boolean> {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  const [algorithm, count, salt, expected] = parts;
  const iterations = Number(count);
  if (
    parts.length !== 4 ||
    algorithm !== "pbkdf2_sha256" ||
    !Number.isInteger(iterations) ||
    iterations < 1 ||
    iterations > 100_000 ||
    !salt ||
    !expected ||
    !/^[a-f0-9]{64}$/iu.test(expected)
  )
    return false;
  const actual = await derive(password, salt, iterations);
  let difference = 0;
  for (let index = 0; index < actual.length; index++)
    difference |= actual.charCodeAt(index) ^ expected.toLowerCase().charCodeAt(index);
  return difference === 0;
}
