import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App as AntdApp } from "antd";
import "@alien-form/shared/styles.css";
import { AppProviders } from "../providers";
import { AppRouter } from "../router";
import "../../styles/global.css";
import { RuntimeCore } from "../../runtime";
import { registerAll } from "../../register";

const runtime = new RuntimeCore();
registerAll(runtime);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <AntdApp>
        <AppRouter />
      </AntdApp>
    </AppProviders>
  </StrictMode>,
);
