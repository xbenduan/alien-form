/**
 * Array field runtime helpers.
 *
 * Keeps row creation, deletion, reindexing, and value collection out of Field
 * so the Field class can focus on state, validation, and notifications.
 */

import { startBatch, endBatch } from "alien-signals";
import type { IField, IFieldSchema } from "../types";

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
  _rebuildReactions?(): void;
}

interface RenameableField extends IField {
  _renamePath(newPath: string): void;
}

export interface ArrayFieldControllerOptions {
  path: string;
  itemSchema: IFieldSchema | null;
  getHost(): ArrayFieldHost | null;
  getRowCount(): number;
  setRowCount(count: number): void;
  setStoredValue(value: any[]): void;
}

export class ArrayFieldController {
  constructor(private readonly options: ArrayFieldControllerOptions) {}

  collectValue(fallback: any): any {
    const host = this.options.getHost();
    const itemSchema = this.options.itemSchema;
    if (!host || !itemSchema) return fallback;

    const result: any[] = [];
    const rowCount = this.options.getRowCount();
    for (let index = 0; index < rowCount; index++) {
      if (itemSchema.properties) {
        result.push(this.collectObjectRow(host, itemSchema, index));
        continue;
      }

      const itemField = host.getField(`${this.options.path}.${index}`);
      result.push(itemField ? itemField.value : undefined);
    }
    return result;
  }

  getItems(): IField[][] {
    const host = this.options.getHost();
    const itemSchema = this.options.itemSchema;
    if (!host || !itemSchema) return [];

    const items: IField[][] = [];
    const rowCount = this.options.getRowCount();
    for (let index = 0; index < rowCount; index++) {
      const rowFields: IField[] = [];
      if (itemSchema.properties) {
        for (const key of Object.keys(itemSchema.properties)) {
          const field = host.getField(`${this.options.path}.${index}.${key}`);
          if (field) rowFields.push(field);
        }
      } else {
        const field = host.getField(`${this.options.path}.${index}`);
        if (field) rowFields.push(field);
      }
      items.push(rowFields);
    }
    return items;
  }

  push(initialValues?: any): boolean {
    const host = this.options.getHost();
    const itemSchema = this.options.itemSchema;
    if (!host || !itemSchema) return false;

    const newIndex = this.options.getRowCount();
    this.createRowFields(host, itemSchema, newIndex, initialValues);
    this.options.setRowCount(newIndex + 1);
    host._rebuildReactions?.();
    return true;
  }

  remove(index: number): boolean {
    const host = this.options.getHost();
    const itemSchema = this.options.itemSchema;
    if (!host || !itemSchema) return false;

    const currentRows = this.options.getRowCount();
    if (index < 0 || index >= currentRows) return false;

    this.deleteRowFields(host, index);
    for (let row = index + 1; row < currentRows; row++) {
      this.renameRow(host, row, row - 1);
    }

    this.options.setRowCount(currentRows - 1);
    host._rebuildReactions?.();
    return true;
  }

  moveUp(index: number): boolean {
    if (index <= 0) return false;
    return this.swapRows(index, index - 1);
  }

  moveDown(index: number): boolean {
    if (index >= this.options.getRowCount() - 1) return false;
    return this.swapRows(index, index + 1);
  }

  setValue(value: any[]): boolean {
    const host = this.options.getHost();
    const itemSchema = this.options.itemSchema;
    if (!host || !itemSchema) return false;

    const normalizedRows = Array.isArray(value) ? value : [];
    const currentRows = this.options.getRowCount();
    startBatch();
    try {
      for (let index = 0; index < normalizedRows.length; index++) {
        this.upsertRowValue(
          host,
          itemSchema,
          index,
          normalizedRows[index],
          currentRows,
        );
      }

      for (
        let index = currentRows - 1;
        index >= normalizedRows.length;
        index--
      ) {
        this.deleteRowFields(host, index);
      }

      this.options.setRowCount(normalizedRows.length);
      this.options.setStoredValue(normalizedRows);
      if (currentRows !== normalizedRows.length) {
        host._rebuildReactions?.();
      }
    } finally {
      endBatch();
    }
    return true;
  }

  resetRows(initialValue: any): void {
    const rows = Array.isArray(initialValue) ? initialValue : [];
    this.setValue(rows);
  }

  private collectObjectRow(
    host: ArrayFieldHost,
    itemSchema: IFieldSchema,
    index: number,
  ): Record<string, any> {
    const row: Record<string, any> = {};
    for (const key of Object.keys(itemSchema.properties || {})) {
      const childField = host.getField(`${this.options.path}.${index}.${key}`);
      if (childField) row[key] = childField.value;
    }
    return row;
  }

  private upsertRowValue(
    host: ArrayFieldHost,
    itemSchema: IFieldSchema,
    index: number,
    rowValue: any,
    currentRows: number,
  ): void {
    if (index >= currentRows) {
      this.createRowFields(host, itemSchema, index, rowValue);
    }

    if (itemSchema.properties) {
      const safeRowValue = rowValue || {};
      for (const key of Object.keys(itemSchema.properties)) {
        const childPath = `${this.options.path}.${index}.${key}`;
        const childSchema = { ...(itemSchema.properties[key] as IFieldSchema) };
        const childField = this.ensureField(
          host,
          childPath,
          childSchema,
          safeRowValue[key],
          itemSchema.required,
        );
        childField?.setValue(safeRowValue[key]);
      }
      return;
    }

    const itemPath = `${this.options.path}.${index}`;
    const itemField = this.ensureField(
      host,
      itemPath,
      { ...itemSchema },
      rowValue,
    );
    itemField?.setValue(rowValue);
  }

  private createRowFields(
    host: ArrayFieldHost,
    itemSchema: IFieldSchema,
    index: number,
    initialValues?: any,
  ): void {
    if (itemSchema.properties) {
      for (const [key, childSchema] of Object.entries(itemSchema.properties)) {
        const fieldPath = `${this.options.path}.${index}.${key}`;
        const initVal = initialValues ? initialValues[key] : undefined;
        this.createFieldTreeOrField(
          host,
          fieldPath,
          { ...(childSchema as IFieldSchema) },
          initVal,
          itemSchema.required,
        );
      }
      return;
    }

    this.createFieldTreeOrField(
      host,
      `${this.options.path}.${index}`,
      { ...itemSchema },
      initialValues,
    );
  }

  private ensureField(
    host: ArrayFieldHost,
    path: string,
    schema: IFieldSchema,
    initialValue: any,
    parentRequired?: boolean | string[],
  ): IField | undefined {
    const existing = host.getField(path);
    if (existing) return existing;
    this.createFieldTreeOrField(
      host,
      path,
      schema,
      initialValue,
      parentRequired,
    );
    return host.getField(path);
  }

  private createFieldTreeOrField(
    host: ArrayFieldHost,
    path: string,
    schema: IFieldSchema,
    initialValue?: any,
    parentRequired?: boolean | string[],
  ): void {
    if (host._createFieldTree) {
      host._createFieldTree(path, schema, initialValue, parentRequired);
    } else {
      host.createField(path, schema, initialValue);
    }
  }

  private deleteRowFields(host: ArrayFieldHost, index: number | string): void {
    const rowPrefix = `${this.options.path}.${index}`;
    const childPrefix = `${rowPrefix}.`;
    for (const fieldPath of Array.from(host.fields.keys())) {
      if (fieldPath === rowPrefix || fieldPath.startsWith(childPrefix)) {
        host.fields.delete(fieldPath);
      }
    }
  }

  private renameRow(
    host: ArrayFieldHost,
    fromIndex: number | string,
    toIndex: number | string,
  ): void {
    const fromPrefix = `${this.options.path}.${fromIndex}`;
    const toPrefix = `${this.options.path}.${toIndex}`;
    const movingPaths: string[] = [];
    for (const fieldPath of host.fields.keys()) {
      if (fieldPath === fromPrefix || fieldPath.startsWith(`${fromPrefix}.`)) {
        movingPaths.push(fieldPath);
      }
    }
    for (const fromPath of movingPaths) {
      const toPath = toPrefix + fromPath.slice(fromPrefix.length);
      const moving = host.fields.get(fromPath) as RenameableField | undefined;
      if (!moving) continue;
      host.fields.delete(fromPath);
      moving._renamePath(toPath);
      host.fields.set(toPath, moving);
    }
  }

  private swapRows(indexA: number, indexB: number): boolean {
    const host = this.options.getHost();
    const itemSchema = this.options.itemSchema;
    const rowCount = this.options.getRowCount();
    if (!host || !itemSchema || indexA === indexB) return false;
    if (indexA < 0 || indexB < 0 || indexA >= rowCount || indexB >= rowCount) return false;

    const tempIndex = `__swap__${indexA}_${indexB}_${Date.now()}`;
    this.renameRow(host, indexA, tempIndex);
    this.renameRow(host, indexB, indexA);
    this.renameRow(host, tempIndex, indexB);

    host._rebuildReactions?.();
    return true;
  }
}
