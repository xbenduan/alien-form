export function openRoute(path: string): void {
  window.open(`${window.location.origin}/records${path}`, "_self");
}
