import { Button, Card, Col, Divider, Flex, Row, Space, Table } from "antd";
import { defineComponent, type Runtime } from "@alien-form/engine";
import { registerEnums } from "./enums";
import { registerComponents } from "./components";
import { registerLayouts } from "./layouts";
import { registerPages } from "./pages";
import { registerServices } from "./services";
import { registerUtils } from "./utils";

const antd = { Button, Card, Col, Divider, Flex, Row, Space, Table };

export function registerGlobal(runtime: Runtime): void {
  for (const [code, component] of Object.entries(antd)) {
    runtime.component(code, defineComponent(component));
  }
  registerComponents(runtime);
  registerLayouts(runtime);
  registerPages(runtime);
  registerServices(runtime);
  registerEnums(runtime);
  registerUtils(runtime);
}
