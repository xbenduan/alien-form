import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RuntimeProvider } from "@binding";
import { appRuntime } from "@runtime";
import { AppProviders } from "../providers";
import { AppRouter } from "../router";
import "../../styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing");

createRoot(root).render(
  <StrictMode>
    <RuntimeProvider runtime={appRuntime}>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </RuntimeProvider>
  </StrictMode>,
);
