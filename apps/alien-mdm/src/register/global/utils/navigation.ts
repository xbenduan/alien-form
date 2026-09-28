type Navigate = (path: string) => void;

let navigate: Navigate | undefined;

export function bindOpenRoute(next: Navigate): () => void {
  navigate = next;
  return () => {
    if (navigate === next) navigate = undefined;
  };
}

export function openRoute(path: string): void {
  if (!navigate) throw new Error("SPA navigation is not ready");
  navigate(`/records${path}`);
}
