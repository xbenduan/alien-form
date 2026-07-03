import type { Handlers, RuntimeContext, FieldLike } from "../schema";

/** 可作为容器被寻址的节点：拥有 children Map 或 rows() 的字段 / 行。 */
interface NavNode {
  children?: Map<string, any>;
  rows?: () => any[];
  value?: () => any;
  parent?: any;
}

/**
 * 从容器节点按单段 key 取子节点：数组用数字下标走 rows()，其余走 children。
 */
function childOf(node: NavNode | undefined, seg: string): NavNode | undefined {
  if (!node) return undefined;
  if (typeof node.rows === "function") return node.rows()[Number(seg)];
  if (node.children instanceof Map) return node.children.get(seg);
  return undefined;
}

/**
 * 从 base 出发按点分隔路径逐段下行，返回命中的字段节点（未命中为 undefined）。
 */
function walk(base: NavNode | undefined, path: string): NavNode | undefined {
  if (!base) return undefined;
  if (path === "") return base;
  let node: NavNode | undefined = base;
  for (const seg of path.split(".")) {
    node = childOf(node, seg);
    if (!node) return undefined;
  }
  return node;
}

/**
 * 解析选择器为字段节点（第 9 节）：
 * 1) 以 `.` / `..` 开头 → 相对当前字段（self 的容器为基准，每个 `..` 上移一层）；
 * 2) 其余按绝对 path 从根逐段解析。
 * 命中返回节点，未命中返回 undefined（不抛错）。
 */
function resolveNode(
  root: FieldLike,
  self: FieldLike,
  selector: string,
): NavNode | undefined {
  if (selector.startsWith(".")) {
    let base: NavNode | undefined = (self as any).parent;
    let rest = selector;
    while (rest.startsWith("../")) {
      base = base?.parent;
      rest = rest.slice(3);
    }
    if (rest.startsWith("./")) rest = rest.slice(2);
    else if (rest === "." || rest === "..") rest = "";
    return walk(base, rest);
  }
  return walk(root as unknown as NavNode, selector);
}

/**
 * 构造 RuntimeContext：封装选择器解析（ctx.get）与四命名空间处理器。
 * get 命中 userScope 优先返回；否则解析字段节点并读取其 value()（从而建立订阅）。
 */
export function createContext(config: {
  root: FieldLike;
  self: FieldLike;
  userScope: Record<string, any>;
  handlers: Handlers;
  onError: (e: unknown) => void;
}): RuntimeContext {
  const { root, self, userScope, handlers, onError } = config;
  return {
    root,
    self,
    userScope,
    handlers,
    onError,
    /** 解析选择器为值：userScope 优先，其次字段树（订阅），解析不到返回 undefined。 */
    get(selector: string): any {
      if (selector in userScope) return userScope[selector];
      const node = resolveNode(root, self, selector);
      return node && typeof node.value === "function" ? node.value() : undefined;
    },
  };
}

/**
 * 为表达式编译构造作用域对象（第 8 节）。
 * Proxy 的 has 恒 true 拦下所有裸标识符，防止穿透与 ReferenceError；
 * get 惰性读字段，实现「只订阅表达式真正访问到的字段」。
 * valueOverride 用于 format / validator 表达式：此时 `$value` 应为被处理的入参而非字段现值。
 */
export function buildScope(ctx: RuntimeContext, valueOverride?: any): object {
  const hasOverride = arguments.length > 1;
  const target = {
    /** 当前字段的值（format/validator 场景下为被处理的入参）。 */
    get $value() {
      return hasOverride ? valueOverride : ctx.self.value();
    },
    /** 整棵表单的值。 */
    get $values() {
      return ctx.root.value();
    },
    /** 当前字段实例。 */
    $self: ctx.self,
    /** 当前字段路径。 */
    $path: ctx.self.path,
    /** 显式选择器取值。 */
    $get: (sel: string) => ctx.get(sel),
    ...ctx.userScope,
  };
  return new Proxy(target, {
    /** 拦截所有标识符，避免 with 作用域穿透。 */
    has() {
      return true;
    },
    /** 内置 / userScope 命中优先，其余按裸字段名解析（订阅）。 */
    get(t, k) {
      if (k === Symbol.unscopables) return undefined;
      if (k in t) return (t as any)[k];
      return ctx.get(k as string);
    },
  });
}

/** 供 form.field(path) 复用：解析选择器为字段节点本身（而非其值）。 */
export function resolveField(
  root: FieldLike,
  self: FieldLike,
  selector: string,
): any {
  return resolveNode(root, self, selector);
}
