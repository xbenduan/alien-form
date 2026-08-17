import { defineHandler } from "@alien-form/shared";

export default defineHandler(() => undefined, {
  key: "testDirectoryOnlyHandler",
  label: "Test-directory-only handler",
  description: "Must never be registered in production.",
  supportedTargets: [],
  defaultConfig: {},
  params: [],
});
