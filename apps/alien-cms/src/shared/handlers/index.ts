import { createHandlerCatalog, createHandlerRegistry } from '@alien-form/cms';
import compareValue from './compare-value';
import copyFromSelector from './copy-from-selector';
import modelRecordOptions from './model-record-options';
import optionsFromMap from './options-from-map';
import relatedRecordFieldOptions from './related-record-field-options';
import schemaFieldOptions from './schema-field-options';
import templateText from './template-text';

export {
  compareValue,
  copyFromSelector,
  modelRecordOptions,
  optionsFromMap,
  relatedRecordFieldOptions,
  schemaFieldOptions,
  templateText,
};

export const handlers = createHandlerRegistry({
  compareValue,
  copyFromSelector,
  modelRecordOptions,
  optionsFromMap,
  relatedRecordFieldOptions,
  schemaFieldOptions,
  templateText,
});

export const handlerCatalog = createHandlerCatalog(handlers);

export const schemaHandlers = handlers;
export const recordSchemaHandlers = handlers;
export const schemaHandlerCatalog = handlerCatalog;
