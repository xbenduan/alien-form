import * as React from "react";
import { Input } from "./input";
import { Select } from "./select";
import { Textarea } from "./textarea";
import { Switch } from "./switch";

type SchemaFieldCommonProps = {
  readPretty?: boolean;
  pattern?: string;
  loading?: boolean;
};

type SchemaInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> &
  SchemaFieldCommonProps & {
    value?: string | null;
    onChange?: (value: string) => void;
  };

type SchemaTextareaProps = Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange"> &
  SchemaFieldCommonProps & {
    value?: string | null;
    onChange?: (value: string) => void;
  };

type SchemaSelectProps = React.ComponentProps<typeof Select> & SchemaFieldCommonProps;

function omitSchemaOnlyProps<T extends SchemaFieldCommonProps>(props: T) {
  const { readPretty: _readPretty, pattern: _pattern, loading: _loading, ...rest } = props;
  void _readPretty;
  void _pattern;
  void _loading;
  return rest;
}

function LoadingSpinner() {
  return (
    <div className="absolute right-8 top-1/2 -translate-y-1/2">
      <svg className="h-4 w-4 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

export function SchemaInput(props: SchemaInputProps) {
  const { value, onChange, ...rest } = props;
  return (
    <Input
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      {...omitSchemaOnlyProps(rest)}
    />
  );
}

export function SchemaTextarea(props: SchemaTextareaProps) {
  const { value, onChange, ...rest } = props;
  return (
    <Textarea
      value={value ?? ""}
      onChange={(event) => onChange?.(event.target.value)}
      {...omitSchemaOnlyProps(rest)}
    />
  );
}

export function SchemaSelect(props: SchemaSelectProps) {
  return (
    <div className="relative">
      <Select {...omitSchemaOnlyProps(props)} />
      {props.loading ? <LoadingSpinner /> : null}
    </div>
  );
}

type SchemaSwitchProps = SchemaFieldCommonProps & {
  value?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  dataSource?: any;
};

export function SchemaSwitch(props: SchemaSwitchProps) {
  const { readPretty: _, pattern: _p, loading: _l, dataSource: _ds, ...rest } = props;
  return <Switch {...rest} />;
}

export type { SchemaInputProps, SchemaTextareaProps, SchemaSelectProps, SchemaSwitchProps };
