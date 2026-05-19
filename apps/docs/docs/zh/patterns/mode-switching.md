# 形态切换

## 场景

很多企业表单不是只有一种固定形态，而是会随着页面模式切换，例如：

- 创建态 / 编辑态 / 只读态
- 草稿态 / 发布态
- 内部视图 / 外部视图

这类场景的共同点是：

- schema 结构大体相同
- 但 `scope`、联动结果、只读状态、提示文案、按钮显隐会随模式变化

## 反模式 (Anti-Pattern)

### 1. 不要在旧 form 实例上强行打补丁

例如在 React 里监听 `mode`，然后对已有 form 做一连串命令式改写：

```tsx
// ❌ 不推荐：在旧 form 上不断修补状态
const form = useMemo(() => createForm(), [])

useEffect(() => {
  form.setFieldState("name", (state) => {
    state.pattern = mode === "readonly" ? "readOnly" : "editable"
  })
  form.setFieldState("description", (state) => {
    state.componentProps = {
      ...state.componentProps,
      placeholder: mode === "readonly" ? "当前为只读模式" : "请输入内容",
    }
  })
}, [mode, form])
```

这样做的问题是：

- 模式切换后的状态来源不清晰
- 很容易遗漏某些字段，导致旧模式残留
- `scope` 变化和字段状态变化被混在一起，职责边界模糊
- schema 里的 reaction 明明依赖 `mode`，却还要额外做一遍 React 层补丁

### 2. 不要把 `mode` 当成普通表单字段来回写

如果 `mode` 只是页面形态，而不是用户要提交的数据，就不应该把它混进 `form.values`。

## 标准范式

把 `mode` 当成 form 的外部上下文，通过 `scope` 注入给 schema。

当 `mode` 变化时，直接创建一个新的 form 实例：

```tsx
const form = useMemo(
  () =>
    createForm({
      scope: { mode },
      initialValues,
    }),
  [mode]
)
```

这条范式的含义是：

1. `mode` 属于表单运行时上下文，不属于用户输入值
2. schema reaction 通过 `scope.mode` 或 `$scope.mode` 参与计算
3. 形态发生根变化时，直接切换到一个新的 form 实例

## 推荐写法

### 1. 页面层持有 `mode`

```tsx
function UserPage({ mode }: { mode: "create" | "edit" | "readonly" }) {
  const form = useMemo(
    () =>
      createForm({
        scope: { mode },
        initialValues: getInitialValues(mode),
      }),
    [mode]
  )

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  )
}
```

### 2. schema 只关心 `mode` 如何影响表现

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "title": "姓名",
      "component": "Input",
      "decorator": "FormItem",
      "x-reaction": {
        "pattern": {
          "type": "expression",
          "expression": "$scope.mode === 'readonly' ? 'readOnly' : 'editable'"
        },
        "props": {
          "type": "expression",
          "expression": "{ placeholder: $scope.mode === 'readonly' ? '当前为只读模式' : '请输入姓名' }"
        }
      }
    }
  }
}
```

这样 schema 负责的是：

- 根据 `mode` 决定字段表现
- 根据 `mode` 切换 `pattern`
- 根据 `mode` 派生占位文案、按钮文案和显隐逻辑

而不是由 React `useEffect` 去逐个字段打补丁。

## 为什么这是推荐范式

- `mode` 的来源清晰，它是外部上下文，不是用户输入值
- form 实例和运行时 `scope` 一一对应，不会残留旧形态状态
- schema reaction 可以天然基于 `scope.mode` 推导结果
- React 层只负责根据 `mode` 重建 form，不负责修补字段树

## 什么时候应该重建 form

推荐在这些情况下直接重建：

- 创建态切换到只读态
- 编辑态切换到只读态
- 一个页面的整体交互语义已经变化
- 大量 reaction、pattern、props 都依赖 `mode`

这本质上是“切换表单运行时上下文”，而不是“微调某个字段”。

## 什么时候不需要重建 form

如果只是局部字段联动，例如：

- 切换一个开关后显示额外字段
- 根据分类切换下拉选项
- 根据某个值切换某一块显示状态

这类仍然应该优先使用：

- `x-reaction`
- `form.setFieldState`
- 数组字段操作

而不是把它提升为整个 form 的 `mode` 切换。

## 与编辑态初始化的关系

如果你的页面既有“形态切换”，又有“编辑详情初始化”，推荐组合写法是：

```tsx
function UserForm({ mode, detail }: { mode: "edit" | "readonly"; detail: any }) {
  const form = useMemo(
    () =>
      createForm({
        scope: { mode },
        initialValues: detail,
      }),
    [mode, detail]
  )

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  )
}
```

也就是说：

- `detail` 决定初始数据
- `mode` 决定运行时形态
- 两者都属于创建 form 时应该确定的输入

## 一句话原则

**形态切换不是在旧 form 上修补字段状态，而是根据新的 `mode` 重新创建一个带有对应 `scope` 的 form：`useMemo(() => createForm({ scope: { mode } }), [mode])`。**
