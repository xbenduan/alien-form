import React from 'react';
import type { CmsFieldSchema } from '@alien-form/cms';
import * as adapters from '../adapters';

export const recordFormComponents = {
  Input: adapters.Input,
  Textarea: adapters.Textarea,
  NumberInput: adapters.NumberInput,
  Select: adapters.Select,
  Switch: adapters.Switch,
  DateInput: adapters.DateInput,
  Radio: adapters.Radio,
  CheckboxGroup: adapters.CheckboxGroup,
  Rate: adapters.Rate,
  ArrayCards: adapters.ArrayCards,
  SectionCard: adapters.SectionCard,
  TagsInput: adapters.TagsInput,
  SkuTable: adapters.SkuTable,
};

export const recordFormDecorators = {
  FormItem: adapters.FormItem,
};

export const detailFieldDisplayComponents = {
  Input: adapters.DisplayText,
  Textarea: adapters.DisplayText,
  NumberInput: adapters.DisplayText,
  Select: adapters.DisplayChoice,
  Switch: adapters.DisplayBoolean,
  DateInput: adapters.DisplayDate,
  Radio: adapters.DisplayChoice,
  CheckboxGroup: adapters.DisplayChoice,
  Rate: adapters.DisplayRate,
  TagsInput: adapters.DisplayTags,
};

function isObjectItemsArray(field: Pick<CmsFieldSchema, 'type' | 'items'>) {
  return field.type === 'array'
    && Boolean(field.items)
    && !Array.isArray(field.items)
    && typeof field.items === 'object'
    && 'type' in field.items
    && field.items.type === 'object';
}

export function canUseSharedDisplayComponent(
  field: Pick<CmsFieldSchema, 'type' | 'component' | 'items'>,
) {
  if (field.type === 'object' || field.type === 'void') {
    return false;
  }

  if (isObjectItemsArray(field)) {
    return false;
  }

  if (!field.component) {
    return field.type !== 'array';
  }

  return field.component in detailFieldDisplayComponents;
}

export function resolveSharedDisplayComponent(
  field: Pick<CmsFieldSchema, 'type' | 'component'>,
) {
  if (field.component && field.component in detailFieldDisplayComponents) {
    return detailFieldDisplayComponents[field.component as keyof typeof detailFieldDisplayComponents];
  }

  if (field.type === 'boolean') {
    return adapters.DisplayBoolean;
  }

  return adapters.DisplayText;
}

function ReadonlyArrayCards(props: Record<string, unknown>) {
  return React.createElement(adapters.ArrayCards as never, {
    ...props,
    disabled: true,
  });
}

function ReadonlySkuTable(props: Record<string, unknown>) {
  return React.createElement(adapters.SkuTable as never, {
    ...props,
    disabled: true,
  });
}

export const detailFormComponents = {
  ...detailFieldDisplayComponents,
  ArrayCards: ReadonlyArrayCards,
  SectionCard: adapters.SectionCard,
  SkuTable: ReadonlySkuTable,
};
