import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

interface ThemeToken {
  colorPrimary?: string;
  borderRadius?: number;
  colorBgLayout?: string;
  colorText?: string;
  fontFamily?: string;
}

const ThemeContext = createContext<ThemeToken>({
  colorPrimary: "#C96442",
  borderRadius: 16,
  colorBgLayout: "#f4ede3",
  colorText: "#2f261f",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
});

export const theme = {
  defaultAlgorithm: Symbol("defaultAlgorithm"),
};

export function ConfigProvider({
  children,
  theme: configTheme,
}: {
  children?: ReactNode;
  theme?: {
    token?: ThemeToken;
    algorithm?: unknown;
    components?: Record<string, unknown>;
  };
}) {
  const value = useMemo<ThemeToken>(
    () => ({
      colorPrimary: configTheme?.token?.colorPrimary ?? "#C96442",
      borderRadius: configTheme?.token?.borderRadius ?? 16,
      colorBgLayout: configTheme?.token?.colorBgLayout ?? "#f4ede3",
      colorText: configTheme?.token?.colorText ?? "#2f261f",
      fontFamily:
        configTheme?.token?.fontFamily ?? "Inter, ui-sans-serif, system-ui, sans-serif",
    }),
    [configTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        className="ant-config-provider"
        style={
          {
            "--af-primary": value.colorPrimary,
            "--af-radius": `${value.borderRadius ?? 16}px`,
            "--af-bg-layout": value.colorBgLayout,
            "--af-text": value.colorText,
            "--af-font-ui": value.fontFamily,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

type MessageType = "success" | "error" | "info" | "warning";
interface MessageNotice {
  id: number;
  type: MessageType;
  content: ReactNode;
}

let messageId = 0;
const messageListeners = new Set<(notice: MessageNotice) => void>();

function emitMessage(type: MessageType, content: ReactNode) {
  const notice = { id: ++messageId, type, content };
  messageListeners.forEach((listener) => listener(notice));
  return notice.id;
}

type MessageInstance = {
  success: (content: ReactNode) => number;
  error: (content: ReactNode) => number;
  info: (content: ReactNode) => number;
  warning: (content: ReactNode) => number;
  useMessage: () => [MessageInstance, ReactNode];
};

export const message: MessageInstance = {
  success: (content) => emitMessage("success", content),
  error: (content) => emitMessage("error", content),
  info: (content) => emitMessage("info", content),
  warning: (content) => emitMessage("warning", content),
  useMessage: () => [message, null],
};

function MessageViewport() {
  const [notices, setNotices] = useState<MessageNotice[]>([]);

  useEffect(() => {
    const listener = (notice: MessageNotice) => {
      setNotices((current) => [...current, notice]);
      window.setTimeout(() => {
        setNotices((current) => current.filter((item) => item.id !== notice.id));
      }, 2800);
    };
    messageListeners.add(listener);
    return () => {
      messageListeners.delete(listener);
    };
  }, []);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[1500] flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-2">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role="status"
          className={cn(
            "pointer-events-auto rounded-[12px] border px-3.5 py-2.5 text-sm shadow-[0_12px_28px_rgba(91,68,47,0.1)] backdrop-blur",
            notice.type === "success" &&
              "border-[rgba(103,133,103,0.22)] bg-[rgba(246,250,245,0.96)] text-[#4a6040]",
            notice.type === "error" &&
              "border-[rgba(201,100,66,0.24)] bg-[rgba(255,246,243,0.96)] text-[#9e4f33]",
            notice.type === "info" &&
              "border-[rgba(117,96,77,0.18)] bg-[rgba(250,247,242,0.96)] text-[#6B5B4D]",
            notice.type === "warning" &&
              "border-[rgba(185,135,64,0.24)] bg-[rgba(255,249,241,0.96)] text-[#8C642B]",
          )}
        >
          {notice.content}
        </div>
      ))}
    </div>,
    document.body,
  );
}

const AppContext = createContext<{ message: MessageInstance }>({ message });

function AppRoot({ children }: { children?: ReactNode }) {
  return (
    <AppContext.Provider value={{ message }}>
      {children}
      <MessageViewport />
    </AppContext.Provider>
  );
}

export const App = Object.assign(AppRoot, {
  useApp() {
    return useContext(AppContext);
  },
});
