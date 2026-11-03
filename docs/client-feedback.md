# 应用反馈组件

`apps/client/src/components/ui` 提供公共反馈组件，样式沿用 Cream Mint 主题。Formwork core 只维护错误和确认协议，不依赖应用 UI。

## 全局 Message

在 `main.tsx` 中每个浏览器文档挂载一个 `MessageHost`。登录页、管理端、Modal/Drawer 和本地预览使用同一入口。

```tsx
import { ErrorMessage, Message } from "./components/ui/message";

try {
  await save();
  Message.success("已保存");
} catch (error) {
  Message.error(error);
}

// Resource 的错误变化触发提示，卸载或错误解除时清理。
<ErrorMessage error={resource.error} retry={refetch} retryLabel="重新加载" />;
```

- 相同可见消息合并；取消请求不提示。
- 普通消息自动消失，带重试入口的错误保留至操作或手动关闭。鼠标悬停、键盘聚焦时暂停计时。
- `Alt+T` 聚焦消息区；消息在 Modal 内也可访问，出现时不抢输入焦点。
- 业务捕获错误或响应式错误出口负责调用，避免同时在请求拦截器重复提示。
- 字段校验保留文字与 `aria-invalid` 定位；提交失败显示一条全局提示。Schema 诊断仍供逐项核对。

## Popconfirm

```tsx
import { Popconfirm } from "./components/ui/popconfirm";

<Popconfirm message="确定撤销此 token 吗？" onConfirm={revoke}>
  撤销
</Popconfirm>;
```

支持异步提交，处理中禁用重复确认，拒绝时由 Message 显示错误，返回 `false` 保留浮层。取消或 Esc 关闭后恢复按钮焦点；点击外部关闭并保留用户新焦点。

Formwork 的 `Confirmation` 使用 `anchor` 和受控 `open` 接入同一组件：`delete(snapshot)` 仍先确认，再按双 revision 删除；请求期间列表删除按钮禁用。无需额外业务弹窗或二次确认。
