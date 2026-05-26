/**
 * @alien-form/core — Reaction rule runtime helpers.
 *
 * Keeps schema rule execution, dependency resolution, scope building and
 * reaction application outside of the Form orchestration class.
 */

import type {
  IForm,
  IField,
  SchemaXRule,
  SchemaReactionKey,
  RuntimeRuleHandler,
  FormError,
} from "../../schema/types";
import { evaluateExpression } from "../../schema/expression";
import { isPromiseLike } from "../../utils";
import { normalizeDataSource } from "../field/validation";

export type RuleKind = "x-reaction" | "x-format" | "x-validate";

export interface RuleRuntimeHost {
  form: IForm;
  scope: Record<string, any>;
  handlers?: Record<string, RuntimeRuleHandler>;
  fields: Map<string, IField>;
  getField(path: string): IField | undefined;
  getValuesSnapshot(): Record<string, any>;
  getRawValuesSnapshot(): Record<string, any>;
  beginFieldLoading(field: IField): void;
  endFieldLoading(field: IField): void;
  emitError(error: FormError): void;
}

export interface ResolvedDependencies {
  deps: Record<string, any>;
  depsArray: any[];
}

export function buildReactionScope(
  host: RuleRuntimeHost,
  selfField: IField,
  deps: Record<string, any>,
  depsArray: any[],
): Record<string, any> {
  return {
    $self: selfField,
    $form: host.form,
    $values: host.getValuesSnapshot(),
    $deps: depsArray.length > 0 ? depsArray : deps,
    $dependencies: deps,
    $value: selfField.value,
    ...host.scope,
  };
}

export function buildValueScope(
  host: RuleRuntimeHost,
  value: any,
  field?: IField,
): Record<string, any> {
  return {
    $self: field,
    $form: host.form,
    $values: host.getRawValuesSnapshot(),
    $deps: {},
    $dependencies: {},
    $value: value,
    ...host.scope,
  };
}

export function resolveDependencies(
  host: RuleRuntimeHost,
  dependencies: string[] | Record<string, string> | undefined,
  selfPath: string,
): ResolvedDependencies {
  const deps: Record<string, any> = {};
  const depsArray: any[] = [];

  if (!dependencies) return { deps, depsArray };

  if (Array.isArray(dependencies)) {
    for (const depPath of dependencies) {
      const resolvedPath = resolveFieldPath(depPath, selfPath);
      const depField = host.getField(resolvedPath);
      const value = depField ? depField.value : undefined;
      depsArray.push(value);
      deps[depPath] = value;
    }
  } else {
    for (const [alias, depPath] of Object.entries(dependencies)) {
      const resolvedPath = resolveFieldPath(depPath, selfPath);
      const depField = host.getField(resolvedPath);
      const value = depField ? depField.value : undefined;
      deps[alias] = value;
    }
  }

  return { deps, depsArray };
}

export function resolveFieldPath(depPath: string, selfPath: string): string {
  if (depPath.startsWith(".")) {
    const parts = selfPath.split(".");
    parts.pop();
    return parts.join(".") + depPath;
  }
  return depPath;
}

export function resolveXRuleValue(
  host: RuleRuntimeHost,
  field: IField | undefined,
  key: string,
  rule: SchemaXRule,
  scope: Record<string, any>,
  kind: RuleKind,
): any {
  switch (rule.type) {
    case "static":
      return rule.value;
    case "expression":
      return evaluateExpression(rule.expression, scope);
    case "match": {
      const source = rule.source
        ? evaluateExpression(rule.source, scope)
        : kind === "x-format" || kind === "x-validate"
          ? scope.$value
          : defaultMatchSource(scope);
      const matchKey = source === undefined || source === null ? "default" : String(source);
      return Object.prototype.hasOwnProperty.call(rule.match, matchKey)
        ? rule.match[matchKey]
        : rule.match.default;
    }
    case "computed": {
      const handler = host.handlers?.[rule.handler];
      if (!handler) return undefined;
      const shouldSetLoading = kind === "x-reaction" && !!field;
      if (shouldSetLoading) host.beginFieldLoading(field as IField);
      const result = handler({
        field: field as IField,
        form: host.form,
        values: host.getRawValuesSnapshot(),
        deps: scope.$dependencies,
        dependencies: scope.$dependencies,
        scope,
        key,
        rule,
        value: scope.$value,
        kind,
      });
      if (isPromiseLike(result)) {
        return result.finally(() => {
          if (shouldSetLoading) host.endFieldLoading(field as IField);
        });
      }
      if (shouldSetLoading) host.endFieldLoading(field as IField);
      return result;
    }
  }
}

export function runXRuleListSync(
  host: RuleRuntimeHost,
  field: IField | undefined,
  key: string,
  ruleOrRules: SchemaXRule | SchemaXRule[],
  scope: Record<string, any>,
  kind: RuleKind,
  fallback: any,
): any {
  const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];
  let current = fallback;
  for (const rule of rules) {
    const valueScope = { ...scope, $value: current };
    const value = resolveXRuleValue(host, field, key, rule, valueScope, kind);
    if (isPromiseLike(value)) {
      const path = field?.path || "<root>";
      const msg =
        `[alien-form] ${kind} "${key}" for "${path}" returned a Promise in a synchronous phase. ` +
        (kind === "x-format"
          ? "x-format handlers must be synchronous — move async work to x-reaction (computed) where Promises are awaited."
          : "This phase does not await Promises; the rule was skipped.");
      if (kind === "x-format") {
        throw new Error(msg);
      }
      host.emitError({ scope: kind, path: field?.path || "", key, message: msg });
      continue;
    }
    if (value !== undefined) current = value;
  }
  return current;
}

export async function runXRuleListAsync(
  host: RuleRuntimeHost,
  field: IField | undefined,
  key: string,
  ruleOrRules: SchemaXRule | SchemaXRule[],
  scope: Record<string, any>,
  kind: RuleKind,
  fallback: any,
): Promise<any> {
  const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];
  let current = fallback;
  for (const rule of rules) {
    const valueScope = { ...scope, $value: current };
    const value = await resolveXRuleValue(host, field, key, rule, valueScope, kind);
    if (value !== undefined) current = value;
  }
  return current;
}

export function applyReactionValue(
  host: RuleRuntimeHost,
  field: IField,
  reactionKey: string,
  value: any,
): void {
  if (value === undefined) return;

  switch (reactionKey as SchemaReactionKey | string) {
    case "value":
      field.setValue(value);
      break;
    case "display":
      field.setDisplay(value);
      break;
    case "visible":
      field.setState({ visible: value });
      break;
    case "hidden":
      field.setState({ hidden: value });
      break;
    case "pattern":
      field.setPattern(value);
      break;
    case "disabled":
      field.setState({ disabled: value });
      break;
    case "readOnly":
      field.setState({ readOnly: value });
      break;
    case "readPretty":
      field.setState({ readPretty: value });
      break;
    case "editable":
      field.setState({ editable: value });
      break;
    case "required":
      field.setState({ required: value });
      break;
    case "title":
      field.setState({ title: value });
      break;
    case "description":
      field.setState({ description: value });
      break;
    case "props":
      field.setState({ componentProps: { ...field.componentProps, ...value } });
      break;
    case "decoratorProps":
      field.setState({ decoratorProps: { ...field.decoratorProps, ...value } });
      break;
    case "component":
      if (Array.isArray(value)) field.setComponent(value[0], value[1]);
      else field.setComponent(value);
      break;
    case "decorator":
      if (Array.isArray(value)) field.setDecorator(value[0], value[1]);
      else field.setDecorator(value);
      break;
    case "dataSource":
      field.setDataSource(normalizeDataSource(value));
      break;
    default:
      host.emitError({
        scope: "reaction",
        path: field.path,
        key: reactionKey,
        message: `unsupported reaction key "${reactionKey}"`,
      });
  }
}

function defaultMatchSource(scope: Record<string, any>): any {
  const deps = scope.$dependencies || {};
  const values = Object.values(deps);
  return values.length === 1 ? values[0] : undefined;
}
