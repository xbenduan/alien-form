import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({
  children,
  viewBox = "0 0 24 24",
  width = "1em",
  height = "1em",
  fill = "none",
  stroke = "currentColor",
  strokeWidth = 1.8,
  strokeLinecap = "round",
  strokeLinejoin = "round",
  ...props
}: IconProps) {
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

function FilledIcon({
  children,
  viewBox = "0 0 24 24",
  width = "1em",
  height = "1em",
  ...props
}: IconProps) {
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ProfileOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="3" />
      <path d="M9 8.5h6" />
      <path d="M9 12h6" />
      <path d="M9 15.5h4" />
    </BaseIcon>
  );
}

export function DownloadOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4v10" />
      <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
      <path d="M5 18.5h14" />
    </BaseIcon>
  );
}

export function UploadOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 19V9" />
      <path d="m8.5 12.5 3.5-3.5 3.5 3.5" />
      <path d="M5 5.5h14" />
    </BaseIcon>
  );
}

export function PlusOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function ReloadOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 11a8 8 0 0 0-13.66-5.66L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 13.66 5.66L20 16" />
      <path d="M20 20v-4h-4" />
    </BaseIcon>
  );
}

export function SettingOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7.8 7.8 0 0 0-1.7-1l-.3-2.5h-4l-.3 2.5a7.8 7.8 0 0 0-1.7 1l-2.3-1-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7.8 7.8 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.8 7.8 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5c.07-.33.1-.66.1-1Z" />
    </BaseIcon>
  );
}

export function DeleteOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 7h15" />
      <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
      <path d="M7 7l1 12h8l1-12" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </BaseIcon>
  );
}

export function DownOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </BaseIcon>
  );
}

export function DragOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="8" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="17" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="17" r="1" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function DisconnectOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M8.5 15.5 5 19" />
      <path d="M19 5 8.5 15.5" />
      <path d="M7 7a4 4 0 0 1 5.66 0l1.17 1.17" />
      <path d="m15.17 11.34 1.83 1.83a4 4 0 0 1 0 5.66 4 4 0 0 1-5.66 0l-1.83-1.83" />
    </BaseIcon>
  );
}

export function GithubOutlined(props: IconProps) {
  return (
    <FilledIcon {...props}>
      <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54 0-.27-.01-1.16-.02-2.1-3.14.68-3.8-1.33-3.8-1.33-.5-1.28-1.23-1.62-1.23-1.62-1-.7.08-.69.08-.69 1.11.08 1.7 1.14 1.7 1.14.98 1.69 2.58 1.2 3.2.91.1-.72.39-1.2.71-1.47-2.5-.28-5.14-1.25-5.14-5.56 0-1.23.44-2.24 1.15-3.03-.11-.28-.5-1.43.11-2.98 0 0 .94-.3 3.08 1.16a10.77 10.77 0 0 1 5.6 0c2.13-1.46 3.07-1.16 3.07-1.16.62 1.55.23 2.7.12 2.98.72.79 1.14 1.8 1.14 3.03 0 4.32-2.64 5.27-5.16 5.55.4.35.76 1.03.76 2.08 0 1.5-.01 2.71-.01 3.08 0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" />
    </FilledIcon>
  );
}

export function QuestionCircleOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.9-2.5 2.05-2.5 4" />
      <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function EditOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="m12.5 5.5 4 4" />
    </BaseIcon>
  );
}

export function EyeOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.6" />
    </BaseIcon>
  );
}

export function SaveOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 4.5h11l3 3V19.5H5Z" />
      <path d="M8 4.5v5h8v-5" />
      <path d="M9 19.5v-6h6v6" />
    </BaseIcon>
  );
}

export function ArrowLeftOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </BaseIcon>
  );
}

export function AppstoreOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="4" y="4" width="6" height="6" rx="1.2" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" />
    </BaseIcon>
  );
}

export function FileTextOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 3.5h7l4 4V20.5H7Z" />
      <path d="M14 3.5v4h4" />
      <path d="M10 11h5" />
      <path d="M10 14.5h5" />
      <path d="M10 18h3" />
    </BaseIcon>
  );
}

export function InfoCircleOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v5" />
      <circle cx="12" cy="7" r=".8" fill="currentColor" stroke="none" />
    </BaseIcon>
  );
}

export function SearchOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.35-4.35" />
    </BaseIcon>
  );
}

export function ArrowDownOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="m7 14 5 5 5-5" />
    </BaseIcon>
  );
}

export function ArrowUpOutlined(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 19V5" />
      <path d="m17 10-5-5-5 5" />
    </BaseIcon>
  );
}

