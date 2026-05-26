import { effect } from "alien-signals";
import { getFormInternals } from "../form/internals";
import type { InternalForm } from "../form/methods";
import type { IField, IFieldSchema, IForm, IFormSchema, SchemaXRule } from "../../schema/types";
import { isPromiseLike } from "../../utils";
import {
  applyReactionValue,
  buildReactionScope,
  resolveFieldPath,
  resolveDependencies,
  resolveXRuleValue,
  type RuleRuntimeHost,
} from "./reaction";

/**
 * Maximum times a single value-reaction can fire per microtask.
 * Prevents infinite loops from misconfigured reaction graphs.
 */
const MAX_REACTION_RUNS_PER_TICK = 20;

interface ReactionEntry {
  effectKey: string;
  path: string;
  reactionKey: string;
  rule: SchemaXRule;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function installSchemaRuleEffects(form: IForm): void {
  const internals = getFormInternals(form);
  if (!internals.schema?.properties) return;

  const installerDispose = effect(() => {
    internals.fieldRegistryVersion();
    if (internals.destroyed || !internals.schema) return;
    syncRuleEffects(form, internals.schema);
  });

  internals.installedRuleEffects.set("__installer__", installerDispose);
}

export function disposeSchemaRuleEffects(form: IForm): void {
  const internals = getFormInternals(form);
  for (const dispose of Array.from(internals.installedRuleEffects.values())) {
    dispose();
  }
  internals.installedRuleEffects.clear();
  internals.asyncReactionVersions.clear();
  internals.fieldLoadingCounts.clear();
}

// ─── Sync installed effects with current schema ──────────────────────────────

function syncRuleEffects(form: IForm, schema: IFormSchema): void {
  const internals = getFormInternals(form);
  const entries = collectReactionEntries(form, schema);
  reportStaticReactionCycles(form, entries);
  const nextKeys = new Set(entries.map((entry) => entry.effectKey));
  nextKeys.add("__installer__");

  for (const entry of entries) {
    if (internals.installedRuleEffects.has(entry.effectKey)) continue;
    if (!form.getField(entry.path)) continue;
    const dispose = installRuleEffect(form, entry);
    internals.installedRuleEffects.set(entry.effectKey, dispose);
  }

  for (const [effectKey, dispose] of Array.from(internals.installedRuleEffects.entries())) {
    if (nextKeys.has(effectKey)) continue;
    dispose();
    internals.installedRuleEffects.delete(effectKey);
  }
}

// ─── Static cycle detection (graph-based, compile-time warning) ──────────────

function reportStaticReactionCycles(form: IForm, entries: ReactionEntry[]): void {
  const valueEntries = entries.filter((e) => e.reactionKey === "value");
  if (valueEntries.length === 0) return;

  const effectKeysByPath = new Map<string, string[]>();
  for (const entry of valueEntries) {
    const current = effectKeysByPath.get(entry.path) || [];
    current.push(entry.effectKey);
    effectKeysByPath.set(entry.path, current);
  }

  // Build dependency graph: effectKey -> effectKeys it depends on
  const graph = new Map<string, string[]>();
  const labels = new Map<string, string>();

  for (const entry of valueEntries) {
    labels.set(entry.effectKey, `${entry.path}.value`);
    graph.set(
      entry.effectKey,
      resolveDependencyPaths(entry.rule, entry.path).flatMap(
        (depPath) => effectKeysByPath.get(depPath) || [],
      ),
    );
  }

  // DFS cycle detection
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const reported = new Set<string>();

  const walk = (key: string, stack: string[]) => {
    if (visiting.has(key)) {
      const cycleStart = stack.indexOf(key);
      const cycleKeys = [...stack.slice(cycleStart), key];
      const sig = cycleKeys.join("->");
      if (!reported.has(sig)) {
        reported.add(sig);
        (form as InternalForm)._emitError({
          scope: "reaction",
          path: labels.get(key)?.replace(/\.value$/, "") || "",
          key: "value",
          message: `reaction cycle detected: ${cycleKeys.map((k) => `"${labels.get(k) || k}"`).join(" -> ")}`,
        });
      }
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    graph.get(key)?.forEach((next) => walk(next, [...stack, key]));
    visiting.delete(key);
    visited.add(key);
  };

  for (const key of graph.keys()) walk(key, []);
}

function resolveDependencyPaths(rule: SchemaXRule, selfPath: string): string[] {
  const { dependencies } = rule;
  if (!dependencies) return [];
  if (Array.isArray(dependencies)) {
    return dependencies.map((p) => resolveFieldPath(p, selfPath));
  }
  return Object.values(dependencies).map((p) => resolveFieldPath(p, selfPath));
}

// ─── Reaction entry collection ───────────────────────────────────────────────

function collectReactionEntries(form: IForm, schema: IFormSchema): ReactionEntry[] {
  if (!schema.properties) return [];
  return collectFieldReactionEntries(form, "", schema.properties);
}

function collectFieldReactionEntries(
  form: IForm,
  prefix: string,
  properties: Record<string, IFieldSchema>,
): ReactionEntry[] {
  return Object.entries(properties).flatMap(([key, schema]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const ownEntries = collectSingleSchemaReactionEntries(path, schema);

    const objectEntries = schema.properties
      ? collectFieldReactionEntries(form, path, schema.properties)
      : [];

    if (!schema.items) return [...ownEntries, ...objectEntries];

    const itemSchema = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (!itemSchema || typeof itemSchema !== "object") return [...ownEntries, ...objectEntries];

    const rowCount = getArrayRowCount(form.getField(path));
    const arrayItemEntries = Array.from({ length: rowCount }).flatMap((_, index) => {
      const itemPath = `${path}.${index}`;
      if ((itemSchema as IFieldSchema).properties) {
        return collectFieldReactionEntries(form, itemPath, (itemSchema as IFieldSchema).properties || {});
      }
      return collectSingleSchemaReactionEntries(itemPath, itemSchema as IFieldSchema);
    });

    return [...ownEntries, ...objectEntries, ...arrayItemEntries];
  });
}

function collectSingleSchemaReactionEntries(path: string, schema: IFieldSchema): ReactionEntry[] {
  return Object.entries(schema["x-reaction"] || {}).flatMap(([reactionKey, ruleOrRules]) => {
    if (!ruleOrRules) return [];
    const rules = Array.isArray(ruleOrRules) ? ruleOrRules : [ruleOrRules];
    return rules.map((rule, index) => ({
      effectKey: `${path}:${reactionKey}:${index}`,
      path,
      reactionKey,
      rule,
    }));
  });
}

// ─── Individual effect installation ──────────────────────────────────────────

function installRuleEffect(form: IForm, entry: ReactionEntry): () => void {
  const host = createRuleRuntimeHost(form);

  // NOTE: We create the effect at top level. The effect callback itself reads
  // reactive dependencies (field values via resolveDependencies), so
  // alien-signals will track those correctly. No need to manipulate
  // getActiveSub/setActiveSub — the effect is installed from a non-reactive
  // context (the syncRuleEffects function runs inside the installer effect's
  // callback which already provides a tracking scope).
  return effect(() => {
    const internals = getFormInternals(form);
    internals.fieldRegistryVersion();
    if (internals.destroyed) return;

    const field = form.getField(entry.path);
    if (!field) return;

    trackImplicitSelfDependency(field, entry.reactionKey, entry.rule);
    const { deps, depsArray } = resolveDependencies(host, entry.rule.dependencies, entry.path);
    const scope = buildReactionScope(host, field, deps, depsArray);

    runReactionWithGuard(form, entry, field, () => {
      try {
        const result = resolveXRuleValue(host, field, entry.reactionKey, entry.rule, scope, "x-reaction");

        if (!isPromiseLike(result)) {
          applyReactionValue(host, field, entry.reactionKey, result);
          return;
        }

        // Async reaction: version-stamp to discard stale results
        const versionKey = `${entry.path}:${entry.reactionKey}`;
        const currentVersion = (internals.asyncReactionVersions.get(versionKey) || 0) + 1;
        internals.asyncReactionVersions.set(versionKey, currentVersion);
        void result
          .then((resolved) => {
            if (getFormInternals(form).asyncReactionVersions.get(versionKey) !== currentVersion) return;
            applyReactionValue(host, field, entry.reactionKey, resolved);
          })
          .catch((error) => {
            if (getFormInternals(form).asyncReactionVersions.get(versionKey) !== currentVersion) return;
            host.emitError({
              scope: "reaction",
              path: field.path,
              key: entry.reactionKey,
              message: error instanceof Error ? error.message : String(error),
              cause: error,
            });
          });
      } catch (error) {
        host.emitError({
          scope: "reaction",
          path: field.path,
          key: entry.reactionKey,
          message: error instanceof Error ? error.message : String(error),
          cause: error,
        });
      }
    });
  });
}

// ─── Runtime host factory ────────────────────────────────────────────────────

function createRuleRuntimeHost(form: IForm): RuleRuntimeHost {
  const internalForm = form as InternalForm;
  return {
    form,
    get scope() { return getFormInternals(form).scope; },
    get handlers() { return getFormInternals(form).config.handlers; },
    get fields() { return getFormInternals(form).fields; },
    getField: (path) => internalForm.getField(path),
    getValuesSnapshot: () => internalForm._valuesSnapshot(),
    getRawValuesSnapshot: () => internalForm._rawValues(),
    beginFieldLoading: (field) => {
      const internals = getFormInternals(form);
      const nextCount = (internals.fieldLoadingCounts.get(field.path) || 0) + 1;
      internals.fieldLoadingCounts.set(field.path, nextCount);
      if (nextCount === 1) field.setLoading(true);
    },
    endFieldLoading: (field) => {
      const internals = getFormInternals(form);
      const currentCount = internals.fieldLoadingCounts.get(field.path) || 0;
      if (currentCount <= 1) {
        internals.fieldLoadingCounts.delete(field.path);
        field.setLoading(false);
        return;
      }
      internals.fieldLoadingCounts.set(field.path, currentCount - 1);
    },
    emitError: (error) => internalForm._emitError(error),
  };
}

// ─── Reaction guard (cycle prevention) ───────────────────────────────────────
// Two layers:
// 1. Static graph analysis (reportStaticReactionCycles) — warns at schema load
// 2. Runtime re-entry detection via reactionExecutionStack — prevents infinite loops

function runReactionWithGuard(
  form: IForm,
  entry: ReactionEntry,
  field: IField,
  runner: () => void,
): void {
  // Non-value reactions cannot cause cycles (they don't trigger other reactions)
  if (entry.reactionKey !== "value") {
    runner();
    return;
  }

  const internals = getFormInternals(form);

  // Re-entry check: if this exact effect is already on the stack, it's a cycle
  if (internals.reactionExecutionStack.has(entry.effectKey)) {
    (form as InternalForm)._emitError({
      scope: "reaction",
      path: field.path,
      key: entry.reactionKey,
      message: `reaction cycle detected: "${field.path}.${entry.reactionKey}" re-entered before the previous run completed`,
    });
    return;
  }

  // Frequency check: cap total runs per microtask to catch indirect cycles
  const nextCount = (internals.reactionRunCounts.get(entry.effectKey) || 0) + 1;
  if (nextCount > MAX_REACTION_RUNS_PER_TICK) {
    (form as InternalForm)._emitError({
      scope: "reaction",
      path: field.path,
      key: entry.reactionKey,
      message: `reaction cycle detected: "${field.path}.${entry.reactionKey}" ran more than ${MAX_REACTION_RUNS_PER_TICK} times in one tick`,
    });
    return;
  }

  internals.reactionRunCounts.set(entry.effectKey, nextCount);
  scheduleRunCountReset(internals);
  internals.reactionExecutionStack.add(entry.effectKey);
  try {
    runner();
  } finally {
    internals.reactionExecutionStack.delete(entry.effectKey);
  }
}

function scheduleRunCountReset(internals: ReturnType<typeof getFormInternals>): void {
  if (internals.reactionRunResetQueued) return;
  internals.reactionRunResetQueued = true;
  queueMicrotask(() => {
    internals.reactionRunCounts.clear();
    internals.reactionRunResetQueued = false;
  });
}

// ─── Implicit dependency tracking ────────────────────────────────────────────

function trackImplicitSelfDependency(field: IField, reactionKey: string, rule: SchemaXRule): void {
  // Value reactions always track self.value to re-run when the field value changes externally
  if (reactionKey === "value") {
    void field.value;
    return;
  }
  // Other reactions without explicit deps track self.value as implicit dependency
  if (rule.dependencies) return;
  void field.value;
}

function getArrayRowCount(field: IField | undefined): number {
  if (!field?.isArrayField) return 0;
  return Array.isArray(field.value) ? field.value.length : 0;
}
