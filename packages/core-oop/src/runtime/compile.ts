/** 编译后的函数缓存：body 字符串 → (scope) => any。 */
const cache = new Map<string, (scope: object) => any>();

/**
 * 把表达式体编译成一个以 scope 为作用域的取值函数（无自研 AST）。
 * new Function 产出 sloppy-mode 函数，允许 `with($scope)`；配合 Proxy 实现精确订阅。
 * 相同 body 命中缓存，避免重复编译。
 */
export function compile(body: string): (scope: object) => any {
  let fn = cache.get(body);
  if (!fn) {
    fn = new Function(
      "$scope",
      `with($scope){ return (${body}); }`,
    ) as (scope: object) => any;
    cache.set(body, fn);
  }
  return fn;
}
