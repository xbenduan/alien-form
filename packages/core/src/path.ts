/**
 * @alien-form/core — Path utilities
 *
 * Provides a unified way to address fields by either dot-delimited strings
 * or segment arrays (handy for programmatic array-index addressing).
 */

/**
 * A field path can be a dot-delimited string or an array of segments.
 *
 * Examples:
 *   "specs.0.name"
 *   ["specs", 0, "name"]
 *   ["address", "city"]
 */
export type FieldPath = string | ReadonlyArray<string | number>;

/**
 * Normalise any FieldPath to a dot-delimited string.
 *
 * @example
 * toFieldPath("specs.0.name")        // "specs.0.name"
 * toFieldPath(["specs", 0, "name"])   // "specs.0.name"
 * toFieldPath(["address", "city"])    // "address.city"
 */
export function toFieldPath(path: FieldPath): string {
  if (typeof path === "string") return path;
  return path.join(".");
}

/**
 * Split a dot-delimited path string into an array of segments.
 *
 * @example
 * toFieldSegments("specs.0.name")  // ["specs", "0", "name"]
 * toFieldSegments("")              // []
 */
export function toFieldSegments(path: string): readonly string[] {
  return path === "" ? [] : path.split(".");
}
