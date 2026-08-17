import { defineHandler } from "@alien-form/shared";

export default defineHandler(() => undefined, {
  key: "specOnlyHandler",
  label: "Spec-only handler",
  description: "Must never be registered in production.",
  supportedTargets: [],
  defaultConfig: {},
  params: [],
});
