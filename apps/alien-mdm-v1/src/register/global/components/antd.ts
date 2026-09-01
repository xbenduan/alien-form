import { Button, Card, Col, Divider, Flex, Row, Space, Table, Typography } from "antd";
import type { Runtime } from "@engine";

const components = {
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Row,
  Space,
  Table,
  Title: Typography.Title,
  Text: Typography.Text,
};

export function registerAntd(runtime: Runtime): void {
  for (const [code, component] of Object.entries(components)) {
    runtime.component({ code, component });
  }
}
