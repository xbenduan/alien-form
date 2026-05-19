# 编辑态初始化

## 场景

一个“编辑详情”页面需要先请求后端详情，再把已有数据带入表单。例如：

- 编辑用户资料
- 编辑项目配置
- 编辑订单草稿

这类场景的关键不是“怎么把值塞进 schema”，而是**先拿到详情，再创建表单渲染面**。

## 反模式 (Anti-Pattern)

### 1. 不要把详情请求写进 schema

`schema` 负责描述字段结构、联动和校验，不应该承担“编辑态详情获取”这类页面级控制逻辑。

因此不要尝试：

- 在 `x-reaction` 里拉整份详情
- 在 `x-format` 里等待异步结果
- 在组件内部一边渲染空表单，一边慢慢把编辑值补进去

### 2. 不要先渲染空表单，再把它当成编辑态

```tsx
// ❌ 不推荐：页面先挂出空表单，再异步回填
const form = useMemo(() => createForm(), [])

useEffect(() => {
  fetch(`/api/users/${id}`)
    .then((res) => res.json())
    .then((detail) => {
      form.setInitialValues(detail)
      form.setValues(detail)
    })
}, [id, form])

return (
  <FormProvider form={form} components={components} decorators={decorators}>
    <SchemaField schema={schema} />
  </FormProvider>
)
```

这样做的问题是：

- 首屏会先渲染一套“空创建态”字段
- 编辑页会出现闪动，用户会先看到空值再看到回填值
- 如果页面级 loading 还没结束，表单却已经挂出来，职责边界会变乱

## 标准范式

把“详情请求”和“表单渲染”拆成两层：

1. 外层页面负责 `fetch` 和 `loading`
2. `loading` 结束前，不渲染表单组件
3. 详情拿到后，再挂载真正的编辑表单组件
4. 表单组件在创建时就拿到编辑态初始值

### 1. 页面层负责请求与 loading

```tsx
function UserEditPage({ id }: { id: string }) {
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<any>(null)

  useEffect(() => {
    let disposed = false

    async function load() {
      setLoading(true)
      const response = await fetch(`/api/users/${id}`)
      const data = await response.json()
      if (!disposed) {
        setDetail(data)
        setLoading(false)
      }
    }

    load()
    return () => {
      disposed = true
    }
  }, [id])

  if (loading) {
    return <PageLoading />
  }

  if (!detail) {
    return <Empty description="详情不存在" />
  }

  return <UserEditForm detail={detail} />
}
```

### 2. 表单层只负责渲染编辑态

```tsx
function UserEditForm({ detail }: { detail: any }) {
  const form = useMemo(
    () =>
      createForm({
        initialValues: detail,
      }),
    [detail],
  )

  return (
    <FormProvider form={form} components={components} decorators={decorators}>
      <SchemaField schema={schema} />
    </FormProvider>
  )
}
```

这个范式的重点是：

- 表单组件挂载时，`initialValues` 已经准备好了
- 字段会直接以编辑态初始值完成创建
- 用户不会先看到空表单，再看到数据回填

## 如果详情会在同一个表单实例里刷新

如果你的页面不会卸载表单组件，而是会在同一个实例里切换记录，那么要同时更新：

- `form.setInitialValues(detail)`
- `form.setValues(detail)`

```tsx
useEffect(() => {
  if (!detail) return
  form.setInitialValues(detail)
  form.setValues(detail)
}, [detail, form])
```

这两个方法的职责不同：

- `setInitialValues()`：更新“重置基线”
- `setValues()`：把当前值写进已存在的字段

如果只调 `setValues()`，界面虽然会显示编辑值，但后续执行 `reset()` 时，仍然可能回到旧的初始快照。

## 为什么这是推荐范式

- 页面级 `loading` 与表单级状态边界清晰
- schema 保持纯粹，只负责字段协议
- 编辑态首屏没有空值闪动
- `reset()` 能正确回到服务端详情
- 创建态与编辑态可以共享同一份 schema，只是在外层控制器决定“何时挂载表单”

## 一句话原则

**编辑态初始化属于页面控制器逻辑，不属于 schema 逻辑。先 fetch，等 loading 结束后再挂表单，并把详情作为表单初始值传入。**
