import { createRoot } from "react-dom/client";
import App from "./App";

// 不使用 StrictMode:它会双渲染 / 双挂载,污染性能测量结果。
createRoot(document.getElementById("root")!).render(<App />);
