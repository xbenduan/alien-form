export interface MountMetric {
  /** 从挂载开始到首次 commit 完成的墙钟耗时 (ms) */
  wallMs: number;
  /** React Profiler 报告的首次 commit actualDuration (ms) */
  commitMs: number;
}

export interface InputMetric {
  /** 从派发输入事件到 commit 完成的墙钟耗时 (ms) */
  wallMs: number;
  /** 本次 commit 的 actualDuration (ms) */
  commitMs: number;
}

/** 找到容器内第一个可输入的原生 input 元素 */
export function findFirstInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>("input:not([type=hidden])");
}

/** 用原生 setter + input 事件模拟一次真实键入,触发受控组件 onChange */
export function dispatchNativeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const round = (value: number) => Math.round(value * 100) / 100;
export const fmt = round;
