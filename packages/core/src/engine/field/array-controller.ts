/**
 * Array field runtime helpers.
 *
 * Keeps row creation, deletion, reindexing, and value collection out of field
 * factories so array behaviour stays algorithmic rather than class-based.
 */

import { endBatch, startBatch } from "alien-signals";
import type { IField, IFieldSchema } from "../../schema/types";

export interface RenameableField extends IField {
  _renamePath?(newPath: string): void;
}

export interface ArrayFieldHost {
  fields: Map<string, IField>;
  getField(path: string): IField | undefined;
  createField(path: string, schema: IFieldSchema, initialValue?: any): IField;
  _createFieldTree?(
    path: string,
    schema: IFieldSchema,
    initialValue?: any,
    parentRequired?: boolean | string[],
  ): void;
  _notifyFieldStructureChange?(): void;
}

export interface ArrayFieldControllerOptions {
  path: string;
  itemSchema: IFieldSchema | null;
  getHost(): ArrayFieldHost | null;
  getRowCount(): number;
  setRowCount(count: number): void;
  setStoredValue(value: any[]): void;
}

export interface ArrayFieldController {
  collectValue(fallback: any): any;
  getItems(): IField[][];
  push(initialValues?: any): boolean;
  remove(index: number): boolean;
  moveUp(index: number): boolean;
  moveDown(index: number): boolean;
  setValue(value: any[]): boolean;
  resetRows(initialValue: any): void;
}

export function createArrayFieldController(options: ArrayFieldControllerOptions): ArrayFieldController {
  const createFieldTreeOrField = (
    host: ArrayFieldHost,
    path: string,
    schema: IFieldSchema,
    initialValue?: any,
    parentRequired?: boolean | string[],
  ) => {
    if (host._createFieldTree) {
      host._createFieldTree(path, schema, initialValue, parentRequired);
      return;
    }
    host.createField(path, schema, initialValue);
  };

  const ensureField = (
    host: ArrayFieldHost,
    path: string,
    schema: IFieldSchema,
    initialValue: any,
    parentRequired?: boolean | string[],
  ) => {
    const existing = host.getField(path);
    if (existing) return existing;
    createFieldTreeOrField(host, path, schema, initialValue, parentRequired);
    return host.getField(path);
  };

  /** Collect all field paths belonging to a given row index. */
  const getRowPaths = (host: ArrayFieldHost, index: number | string): string[] => {
    const rowPrefix = `${options.path}.${index}`;
    const childPrefix = `${rowPrefix}.`;
    return Array.from(host.fields.keys()).filter(
      (p) => p === rowPrefix || p.startsWith(childPrefix),
    );
  };

  const deleteRowFields = (host: ArrayFieldHost, index: number | string) => {
    for (const p of getRowPaths(host, index)) {
      host.fields.delete(p);
    }
  };

  const renameRow = (host: ArrayFieldHost, fromIndex: number | string, toIndex: number | string) => {
    const fromPrefix = `${options.path}.${fromIndex}`;
    const toPrefix = `${options.path}.${toIndex}`;
    const paths = getRowPaths(host, fromIndex);

    for (const fromPath of paths) {
      const toPath = toPrefix + fromPath.slice(fromPrefix.length);
      const field = host.fields.get(fromPath) as RenameableField | undefined;
      if (!field) continue;
      host.fields.delete(fromPath);
      field._renamePath?.(toPath);
      host.fields.set(toPath, field);
    }
  };

  const collectObjectRow = (
    host: ArrayFieldHost,
    itemSchema: IFieldSchema,
    index: number,
  ): Record<string, any> =>
    Object.fromEntries(
      Object.keys(itemSchema.properties || {})
        .map((key) => [key, host.getField(`${options.path}.${index}.${key}`)?.value] as const)
        .filter(([, value]) => value !== undefined),
    );

  const createRowFields = (
    host: ArrayFieldHost,
    itemSchema: IFieldSchema,
    index: number,
    initialValues?: any,
  ) => {
    if (itemSchema.properties) {
      Object.entries(itemSchema.properties).forEach(([key, childSchema]) => {
        createFieldTreeOrField(
          host,
          `${options.path}.${index}.${key}`,
          { ...(childSchema as IFieldSchema) },
          initialValues ? initialValues[key] : undefined,
          itemSchema.required,
        );
      });
      return;
    }

    createFieldTreeOrField(host, `${options.path}.${index}`, { ...itemSchema }, initialValues);
  };

  const upsertRowValue = (
    host: ArrayFieldHost,
    itemSchema: IFieldSchema,
    index: number,
    rowValue: any,
    currentRows: number,
  ) => {
    if (index >= currentRows) {
      createRowFields(host, itemSchema, index, rowValue);
    }

    if (itemSchema.properties) {
      const safeRowValue = rowValue || {};
      Object.keys(itemSchema.properties).forEach((key) => {
        const childField = ensureField(
          host,
          `${options.path}.${index}.${key}`,
          { ...(itemSchema.properties![key] as IFieldSchema) },
          safeRowValue[key],
          itemSchema.required,
        );
        childField?.setValue(safeRowValue[key]);
      });
      return;
    }

    ensureField(host, `${options.path}.${index}`, { ...itemSchema }, rowValue)?.setValue(rowValue);
  };

  /**
   * Swap two rows by directly exchanging their field entries in the Map.
   * Single-pass: collect both sets of paths, delete them, rename, re-insert.
   */
  const swapRows = (indexA: number, indexB: number) => {
    const host = options.getHost();
    const itemSchema = options.itemSchema;
    const rowCount = options.getRowCount();
    if (!host || !itemSchema || indexA === indexB) return false;
    if (indexA < 0 || indexB < 0 || indexA >= rowCount || indexB >= rowCount) return false;

    const prefixA = `${options.path}.${indexA}`;
    const prefixB = `${options.path}.${indexB}`;

    // Collect entries for both rows
    const entriesA: [string, IField][] = [];
    const entriesB: [string, IField][] = [];

    for (const [path, field] of host.fields) {
      if (path === prefixA || path.startsWith(`${prefixA}.`)) {
        entriesA.push([path, field]);
      } else if (path === prefixB || path.startsWith(`${prefixB}.`)) {
        entriesB.push([path, field]);
      }
    }

    // Remove both sets
    for (const [path] of entriesA) host.fields.delete(path);
    for (const [path] of entriesB) host.fields.delete(path);

    // Re-insert with swapped prefixes
    for (const [fromPath, field] of entriesA) {
      const toPath = prefixB + fromPath.slice(prefixA.length);
      (field as RenameableField)._renamePath?.(toPath);
      host.fields.set(toPath, field);
    }
    for (const [fromPath, field] of entriesB) {
      const toPath = prefixA + fromPath.slice(prefixB.length);
      (field as RenameableField)._renamePath?.(toPath);
      host.fields.set(toPath, field);
    }

    host._notifyFieldStructureChange?.();
    return true;
  };

  return {
    collectValue(fallback) {
      const host = options.getHost();
      const itemSchema = options.itemSchema;
      if (!host || !itemSchema) return fallback;

      return Array.from({ length: options.getRowCount() }, (_, index) => {
        if (itemSchema.properties) return collectObjectRow(host, itemSchema, index);
        return host.getField(`${options.path}.${index}`)?.value;
      });
    },
    getItems() {
      const host = options.getHost();
      const itemSchema = options.itemSchema;
      if (!host || !itemSchema) return [];

      return Array.from({ length: options.getRowCount() }, (_, index) => {
        if (itemSchema.properties) {
          return Object.keys(itemSchema.properties)
            .map((key) => host.getField(`${options.path}.${index}.${key}`))
            .filter((field): field is IField => !!field);
        }
        const field = host.getField(`${options.path}.${index}`);
        return field ? [field] : [];
      });
    },
    push(initialValues) {
      const host = options.getHost();
      const itemSchema = options.itemSchema;
      if (!host || !itemSchema) return false;

      const newIndex = options.getRowCount();
      createRowFields(host, itemSchema, newIndex, initialValues);
      options.setRowCount(newIndex + 1);
      host._notifyFieldStructureChange?.();
      return true;
    },
    remove(index) {
      const host = options.getHost();
      const itemSchema = options.itemSchema;
      if (!host || !itemSchema) return false;

      const currentRows = options.getRowCount();
      if (index < 0 || index >= currentRows) return false;

      deleteRowFields(host, index);
      for (let row = index + 1; row < currentRows; row++) {
        renameRow(host, row, row - 1);
      }

      options.setRowCount(currentRows - 1);
      host._notifyFieldStructureChange?.();
      return true;
    },
    moveUp(index) {
      if (index <= 0) return false;
      return swapRows(index, index - 1);
    },
    moveDown(index) {
      if (index >= options.getRowCount() - 1) return false;
      return swapRows(index, index + 1);
    },
    setValue(value) {
      const host = options.getHost();
      const itemSchema = options.itemSchema;
      if (!host || !itemSchema) return false;

      const normalizedRows = Array.isArray(value) ? value : [];
      const currentRows = options.getRowCount();
      startBatch();
      try {
        normalizedRows.forEach((rowValue, index) => {
          upsertRowValue(host, itemSchema, index, rowValue, currentRows);
        });

        for (let index = currentRows - 1; index >= normalizedRows.length; index -= 1) {
          deleteRowFields(host, index);
        }

        options.setRowCount(normalizedRows.length);
        options.setStoredValue(normalizedRows);
        if (currentRows !== normalizedRows.length) {
          host._notifyFieldStructureChange?.();
        }
      } finally {
        endBatch();
      }
      return true;
    },
    resetRows(initialValue) {
      this.setValue(Array.isArray(initialValue) ? initialValue : []);
    },
  };
}
