import { DatePicker as AntDatePicker } from "antd";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import type { ComponentProps } from "@alien-form/react";
import { DetailValue, buildProps } from "./shared";

dayjs.locale("zh-cn");

export function DatePicker(props: ComponentProps) {
  const { mode, controlProps, value, onChange } = buildProps(props);
  const showTime = controlProps.showTime === true;
  const format = showTime ? "YYYY-MM-DD HH:mm:ss" : "YYYY-MM-DD";
  if (mode === "detail") {
    const date =
      value === undefined || value === null || value === ""
        ? null
        : dayjs(value as string | number);
    return <DetailValue value={date?.isValid() ? date.format(format) : value} />;
  }

  const dateValue =
    value === undefined || value === null || value === "" ? null : dayjs(value as string | number);
  return (
    <AntDatePicker
      {...controlProps}
      value={dateValue?.isValid() ? dateValue : null}
      showTime={showTime}
      format={format}
      style={{ width: "100%", ...(controlProps.style as object) }}
      onChange={(next) => onChange?.(next ? next.format(format) : undefined)}
    />
  );
}
