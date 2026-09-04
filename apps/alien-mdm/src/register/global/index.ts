import { Button, Card, Col, Divider, Flex, Menu, Row, Space, Table } from "antd";
import type { Runtime } from "@alien-form/engine";
import { registerEnums } from "./enums";
import { registerFields } from "./fields";
import { registerLayouts } from "./layouts";
import { registerPages } from "./pages";
import { registerServices } from "./services";
import { registerUtils } from "./utils";

const antd = { Button, Card, Col, Divider, Flex, Row, Space, Table, Menu };

export function registerGlobal(runtime: Runtime): void {
  for (const [code, component] of Object.entries(antd)) {
    runtime.component({ code, component, adapter: "antd" });
  }
  registerFields(runtime);
  registerLayouts(runtime);
  registerPages(runtime);
  registerServices(runtime);
  registerEnums(runtime);
  registerUtils(runtime);
}
