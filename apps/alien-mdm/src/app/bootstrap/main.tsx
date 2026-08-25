import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App as AntdApp } from "antd";
import { RuntimeProvider } from "@alien-form/engine/react";
import "../../styles/shared.css";
import { AppProviders } from "../providers";
import { AppRouter } from "../router";
import "../../styles/global.css";
import { createAppRuntime } from "../../runtime/create-runtime";

const runtime = createAppRuntime();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RuntimeProvider runtime={runtime}>
      <AppProviders>
        <AntdApp>
          <AppRouter />
        </AntdApp>
      </AppProviders>
    </RuntimeProvider>
  </StrictMode>,
);
