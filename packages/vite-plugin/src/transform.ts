import MagicString from "magic-string";

/** 仅将可达定义的直接 JSX render 转为当前 owner 下调用的工厂。 */
export function transformRender(
  code: string,
  id: string,
  ranges: readonly { start: number; end: number }[],
) {
  if (!ranges.length) return null;
  const output = new MagicString(code);
  for (const range of ranges) {
    output.appendLeft(range.start, "() => (");
    output.appendRight(range.end, ")");
  }
  return {
    code: output.toString(),
    map: output.generateMap({ source: id, includeContent: true, hires: true }),
  };
}
