import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Flex,
  Space,
  Tag,
  Typography,
  message,
  Input,
} from "antd";
import { GithubOutlined } from "@ant-design/icons";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  type FormConfig,
  type FormInstance,
  type IFormSchema,
} from "@alien-form/react";
import {
  formComponents,
  formDecorators,
} from "../../../shared/schema-form-scene";

const { Title, Paragraph, Text, Link } = Typography;

const GITHUB_URL = "https://github.com/xbenduan/alien-form";

/**
 * AboutPage
 *
 * 内置的轻量教程,采用「左侧真实运行组件 + 右侧源码」的对照形式:
 * - alien-form:schema 驱动的无头表单运行时(用法)
 * - alien-cms:基于 alien-form 的 CMS 工作台(简单代码与示例)
 *
 * 左侧示例使用项目真实的 adapters(formComponents / formDecorators)
 * 通过 useCreateForm + FormProvider + SchemaField 实时渲染,可直接交互。
 */

// 代码块
const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  padding: 16,
  background: "#0f172a",
  color: "#e2e8f0",
  border: "1px solid #1e293b",
  borderRadius: 8,
  fontSize: 12,
  lineHeight: 1.7,
  overflow: "auto",
  whiteSpace: "pre",
  wordBreak: "normal",
  height: "100%",
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={codeBlockStyle}>
      <code>{children}</code>
    </pre>
  );
}

// 左右对照布局:左=真实组件,右=代码
interface LiveExampleProps {
  title: string;
  description?: React.ReactNode;
  live: React.ReactNode;
  code: string;
}

function LiveExample({ title, description, live, code }: LiveExampleProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
        {title}
      </Title>
      {description ? (
        <Paragraph type="secondary" style={{ marginTop: -4 }}>
          {description}
        </Paragraph>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.1fr)",
          gap: 16,
          alignItems: "stretch",
        }}
      >
        {/* 左:真实运行的组件 */}
        <Card
          size="small"
          title="实时预览"
          styles={{ body: { padding: 16 } }}
          style={{ background: "#fafcff" }}
        >
          {live}
        </Card>
        {/* 右:对应源码 */}
        <CodeBlock>{code}</CodeBlock>
      </div>
    </div>
  );
}

// 通用:用项目真实 adapters 渲染一个可交互表单
function useDemoForm(schema: IFormSchema, initialValues?: Record<string, unknown>) {
  const config: FormConfig = useMemo(
    () => ({ schema, initialValues }),
    [schema, initialValues],
  );
  return useCreateForm(config, [schema]);
}

function LiveSchemaForm({
  form,
  footer,
}: {
  form: FormInstance;
  footer?: React.ReactNode;
}) {
  return (
    <FormProvider
      form={form}
      components={formComponents as never}
      decorators={formDecorators as never}
    >
      <SchemaField />
      {footer}
    </FormProvider>
  );
}

// 示例 1:基础表单 + 校验 + 提交
const BASIC_SCHEMA: IFormSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "姓名",
      component: "Input",
      props: { placeholder: "请输入姓名" },
      required: true,
      decorator: "FormItem",
    },
    role: {
      type: "string",
      title: "角色",
      component: "Select",
      props: { placeholder: "请选择角色" },
      decorator: "FormItem",
      dataSource: [
        { label: "管理员", value: "admin" },
        { label: "普通用户", value: "user" },
      ],
    },
  },
};

const BASIC_CODE = `import {
  useCreateForm,
  FormProvider,
  SchemaField,
} from "@alien-form/react";
import { formComponents, formDecorators } from "@/shared/components/SchemaFormShared";

const schema = {
  type: "object",
  properties: {
    name: {
      type: "string", title: "姓名",
      component: "Input", decorator: "FormItem",
      props: { placeholder: "请输入姓名" },
      required: true,
    },
    role: {
      type: "string", title: "角色",
      component: "Select", decorator: "FormItem",
      props: { placeholder: "请选择角色" },
      dataSource: [
        { label: "管理员", value: "admin" },
        { label: "普通用户", value: "user" },
      ],
    },
  },
};

function BasicForm() {
  const form = useCreateForm({ schema });
  return (
    <FormProvider
      form={form}
      components={formComponents}
      decorators={formDecorators}
    >
      <SchemaField />
      <button onClick={async () => {
        if (await form.validate()) console.log(form.values());
      }}>
        提交
      </button>
    </FormProvider>
  );
}`;

function BasicFormDemo() {
  const form = useDemoForm(BASIC_SCHEMA, { role: "user" });
  return (
    <LiveSchemaForm
      form={form}
      footer={
        <Space style={{ marginTop: 12 }}>
          <Button
            type="primary"
            onClick={async () => {
              if (await form.validate()) {
                message.success(`提交成功:${JSON.stringify(form.values())}`);
              } else {
                message.warning("请先填写姓名");
              }
            }}
          >
            提交
          </Button>
          <Button onClick={() => form.reset()}>重置</Button>
        </Space>
      }
    />
  );
}

// 示例 2:x-reaction 联动 + dataSourcePolicy
const REACTION_SCHEMA: IFormSchema = {
  type: "object",
  properties: {
    account: {
      type: "string",
      title: "账号类型",
      component: "Select",
      props: { placeholder: "请选择账号类型" },
      decorator: "FormItem",
      dataSource: [
        { label: "管理员", value: "admin" },
        { label: "普通用户", value: "user" },
      ],
    },
    permission: {
      type: "string",
      title: "权限",
      component: "Select",
      props: { placeholder: "请选择权限" },
      decorator: "FormItem",
      dataSourcePolicy: "first",
      "x-reaction": {
        dataSource:
          "{{ account === 'admin' ? [{ label: '全部', value: '*' }] : [{ label: '只读', value: 'read' }] }}",
        display: "{{ account ? 'visible' : 'none' }}",
      },
    },
  },
};

const REACTION_CODE = `const schema = {
  type: "object",
  properties: {
    account: {
      type: "string", title: "账号类型",
      component: "Select", decorator: "FormItem",
      props: { placeholder: "请选择账号类型" },
      dataSource: [
        { label: "管理员", value: "admin" },
        { label: "普通用户", value: "user" },
      ],
    },
    permission: {
      type: "string", title: "权限",
      component: "Select", decorator: "FormItem",
      props: { placeholder: "请选择权限" },
      // 选项变化后,当前值落到第一个可用选项
      dataSourcePolicy: "first",
      // 表达式联动:根据 account 动态切换选项与显隐
      "x-reaction": {
        dataSource:
          "{{ account === 'admin' " +
          "? [{ label: '全部', value: '*' }] " +
          ": [{ label: '只读', value: 'read' }] }}",
        display: "{{ account ? 'visible' : 'none' }}",
      },
    },
  },
};`;

function ReactionFormDemo() {
  const form = useDemoForm(REACTION_SCHEMA);
  return (
    <LiveSchemaForm
      form={form}
      footer={
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          切换「账号类型」,观察下方「权限」选项与显隐的实时联动。
        </Paragraph>
      }
    />
  );
}

// 示例 3:x-validate 自定义校验
const VALIDATE_SCHEMA: IFormSchema = {
  type: "object",
  properties: {
    nickname: {
      type: "string",
      title: "昵称(至少 3 个字符)",
      component: "Input",
      props: { placeholder: "请输入昵称" },
      decorator: "FormItem",
      "x-validate":
        "{{ $value && $value.length >= 3 ? true : '昵称至少需要 3 个字符' }}",
    },
  },
};

const VALIDATE_CODE = `const schema = {
  type: "object",
  properties: {
    nickname: {
      type: "string", title: "昵称",
      component: "Input", decorator: "FormItem",
      props: { placeholder: "请输入昵称" },
      // 自定义校验:返回 true 通过;返回 string / { message } 失败
      "x-validate":
        "{{ $value && $value.length >= 3 " +
        "? true : '昵称至少需要 3 个字符' }}",
    },
  },
};

// 触发校验
const ok = await form.validate(); // false 时字段下方显示错误`;

function ValidateFormDemo() {
  const form = useDemoForm(VALIDATE_SCHEMA);
  return (
    <LiveSchemaForm
      form={form}
      footer={
        <Button style={{ marginTop: 12 }} onClick={() => form.validate()}>
          触发校验
        </Button>
      }
    />
  );
}

// alien-cms 代码示例(纯代码)
const ALIEN_CMS_PROVIDER = `import {
  createProviders,
  listSchemas,
  listRecords,
  createRecord,
} from "@alien-form/cms";

// 方式一:统一 providers(schema / record / log)
const providers = createProviders({
  type: "http",
  baseUrl: "https://api.example.com",
});
const { list } = await providers.recordProvider.list({
  modelName: "article",
  pagination: { current: 1, pageSize: 20 },
});

// 方式二:直接调用异步 API 函数(由浏览器缓存解析当前 provider)
const models = await listSchemas();
const records = await listRecords({
  modelName: "article",
  pagination: { current: 1, pageSize: 20 },
});
await createRecord({
  modelName: "article",
  data: { title: "Hello AlienForm", status: "draft" },
});`;

const ALIEN_CMS_PROJECTION = `import {
  getSchema,
  projectTableColumns,
  projectFilterFields,
} from "@alien-form/cms";

// 同一份模型 schema,投影出多种视图所需的配置
const { schema } = await getSchema({ modelName: "article" });

const tableColumns = projectTableColumns(schema);  // 列表表格列
const filterFields = projectFilterFields(schema);  // 筛选条件表单

// add / edit / detail 表单直接复用同一份 schema,
// 这正是「一份 schema 同时驱动 filter / table / add / edit / detail」的核心。`;

function PlaygroundDemo() {
  const [schemaStr, setSchemaStr] = useState(() => JSON.stringify(BASIC_SCHEMA, null, 2));
  const [schema, setSchema] = useState<IFormSchema>(BASIC_SCHEMA);
  const [submitData, setSubmitData] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    try {
      const parsed = JSON.parse(schemaStr);
      setSchema(parsed);
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, [schemaStr]);

  const form = useDemoForm(schema);

  return (
    <Flex vertical gap={16}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="实时预览" size="small" styles={{ body: { padding: 16 } }} style={{ background: "#fafcff" }}>
          <LiveSchemaForm
            form={form}
            footer={
              <Space style={{ marginTop: 12 }}>
                <Button
                  type="primary"
                  onClick={async () => {
                    if (await form.validate()) {
                      setSubmitData(JSON.stringify(form.values(), null, 2));
                    } else {
                      setSubmitData("校验失败，请检查表单填写");
                    }
                  }}
                >
                  提交
                </Button>
                <Button onClick={() => {
                  form.reset();
                  setSubmitData("");
                }}>重置</Button>
              </Space>
            }
          />
        </Card>
        <Card title="Schema 编辑" size="small" styles={{ body: { padding: 0 } }}>
          <Input.TextArea
            value={schemaStr}
            onChange={(e) => setSchemaStr(e.target.value)}
            style={{ 
              fontFamily: "monospace", 
              minHeight: 400, 
              border: "none", 
              resize: "none",
              padding: 16,
              background: "#0f172a",
              color: "#e2e8f0",
            }}
          />
          {error && <div style={{ color: "red", padding: "8px 16px", background: "#fff1f0", borderTop: "1px solid #ffa39e" }}>{error}</div>}
        </Card>
      </div>
      <Card title="提交数据" size="small" styles={{ body: { padding: 16 } }}>
        <CodeBlock>{submitData || "暂无数据"}</CodeBlock>
      </Card>
    </Flex>
  );
}

// 页面
export default function AboutPage() {
  const [activeTabKey, setActiveTabKey] = useState<string>("playground");

  const tabList = [
    { key: "overview", tab: "项目介绍" },
    { key: "guide", tab: "指南" },
    { key: "scenarios", tab: "场景案例" },
    { key: "advanced", tab: "进阶指南" },
    { key: "playground", tab: "演练场" },
  ];

  const contentList: Record<string, React.ReactNode> = {
    overview: (
      <Flex vertical gap={4}>
        <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
          AlienForm: 用一份 Schema 驱动整个后台
        </Title>
        <Paragraph type="secondary" italic style={{ marginBottom: 16 }}>
          这不是又一个表单库,也不是又一个低代码平台。AlienForm 想要回答一个更朴素的问题:
          <Text strong>当我们写后台的时候,究竟在重复什么?能不能只写一次?</Text>
        </Paragraph>

        <Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
          一、为什么会有 AlienForm
        </Title>
        <Paragraph type="secondary">
          任何一个稍具规模的后台,都会反复出现同一组视图:筛选条件、列表表格、新增弹窗、
          编辑表单、只读详情。它们看起来形态各异,本质却共享同一份业务模型 ——
          <Text strong>字段叫什么、是什么类型、有什么约束、用什么组件展示</Text>。
          但在传统实现里,这份模型被拆散在四五个文件中:列定义在 <Text code>columns.tsx</Text>,
          校验写在 <Text code>schema.ts</Text>,筛选写在 <Text code>FilterForm.tsx</Text>,
          详情又抄一份在 <Text code>DetailPage.tsx</Text>。结果就是,同一个字段每改一次,
          都要在 N 个文件里同步修改;改漏一处,线上就会出现「列表能搜、详情看不到」的灵异 bug。
        </Paragraph>
        <Paragraph type="secondary">
          AlienForm 的出发点很简单:<Text strong>把业务模型当作一等公民</Text>,
          其他视图都只是它的投影(projection)。一份 schema 进去,filter / table / add /
          edit / detail 出来 —— 这就是项目想要验证的核心命题。
        </Paragraph>

        <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
          二、项目分层:从无头内核到完整工作台
        </Title>
        <Paragraph type="secondary">
          整个仓库是一个 pnpm monorepo,自下而上分成三层,每一层都可以独立使用:
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 4 }}>
          <Text strong>1. <Text code>@alien-form/core</Text> —— 无头运行时</Text>
        </Paragraph>
        <Paragraph type="secondary" style={{ marginLeft: 16, marginBottom: 8 }}>
          完全不依赖任何 UI 框架。它只做一件事:把 JSON Schema 编译成响应式的字段树,
          运行 <Text code>x-reaction</Text>(联动)、<Text code>x-format</Text>(双向格式化)、
          <Text code>x-validate</Text>(校验),并按需投影出可提交的值。
          它可以跑在浏览器、Node.js、甚至小程序里,也可以接到任何渲染框架。
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 4 }}>
          <Text strong>2. <Text code>@alien-form/react</Text> —— React 绑定层</Text>
        </Paragraph>
        <Paragraph type="secondary" style={{ marginLeft: 16, marginBottom: 8 }}>
          只负责把 core 接到 React 组件树:<Text code>useCreateForm</Text> 创建实例、
          <Text code>FormProvider</Text> 注入组件/装饰器映射、<Text code>SchemaField</Text>{" "}
          按 schema 自动渲染。UI 组件来自哪里完全由用户决定 —— 可以是 Ant Design、
          Arco、Material UI,也可以是自研组件库。
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 4 }}>
          <Text strong>3. <Text code>@alien-form/cms</Text> + <Text code>apps/alien-cms</Text> —— 工作台样例</Text>
        </Paragraph>
        <Paragraph type="secondary" style={{ marginLeft: 16, marginBottom: 0 }}>
          在 core / react 之上,补齐了「模型注册、数据 provider、视图投影」三件套,
          再用一个真实可跑的 CMS 应用把它们串起来,作为整个理念的活靶子和参考实现。
        </Paragraph>

        <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
          三、四个核心理念
        </Title>

        <Paragraph type="secondary" strong style={{ marginBottom: 4 }}>
          1. Schema 是唯一真相源(Single Source of Truth)
        </Paragraph>
        <Paragraph type="secondary">
          字段的类型、标题、组件、校验、联动、格式化,统统写在一份 schema 里。
          视图差异不是通过「再写一份配置」来表达,而是通过<Text strong>投影函数</Text>:
          <Text code>projectTableColumns</Text>、
          <Text code>projectFilterFields</Text>{" "}
          各自从同一份 schema 中抽取自己需要的部分(表单则直接复用 schema)。
          字段改名时只改一处,所有视图同步生效;新增字段时也只需在一个地方追加。
        </Paragraph>

        <Paragraph type="secondary" strong style={{ marginBottom: 4 }}>
          2. 无头内核 + 可替换绑定(Headless Core)
        </Paragraph>
        <Paragraph type="secondary">
          受 Headless UI、TanStack Table 等项目的启发,AlienForm 把「逻辑」和「外观」彻底解耦。
          core 不知道按钮长什么样、表单项如何排版,它只关心字段树、值变化、依赖追踪与校验结果。
          这意味着:同一份 schema,既可以渲染成 Ant Design 风格的后台,也可以渲染成移动端
          H5 表单,甚至可以在没有 DOM 的环境下做服务端校验。
        </Paragraph>

        <Paragraph type="secondary" strong style={{ marginBottom: 4 }}>
          3. 小而一致的运行时值模型(One Value Model)
        </Paragraph>
        <Paragraph type="secondary">
          为了让 schema 里的「值」既能写死、又能联动、还能扩展,AlienForm 收敛出一套统一的值模型 ——
          任意位置(<Text code>value</Text>、<Text code>display</Text>、
          <Text code>dataSource</Text>、<Text code>x-validate</Text> 等)都接受同一组形态:
        </Paragraph>
        <Paragraph type="secondary" style={{ marginLeft: 16, marginBottom: 8 }}>
          • <Text strong>字面量</Text>(字符串、数字、对象、数组)<br />
          • <Text strong>表达式字符串</Text> <Text code>{"{{ a === 'admin' ? 'all' : 'read' }}"}</Text><br />
          • <Text strong>handler 字符串</Text> <Text code>@handlerName</Text>{" "}
          (引用注册到 form 的副作用函数)<br />
          • <Text strong>直接函数</Text>(在编程式调用场景下使用)<br />
          • 以及上述形态组成的<Text strong>数组</Text>
        </Paragraph>
        <Paragraph type="secondary">
          一套写法贯穿所有位置,意味着学一次就够了 —— 不会再出现「这里支持表达式、那里只支持字符串」
          的认知断裂,也不会再有「读取支持嵌套路径、写入只支持一级」的语义不对称。
        </Paragraph>

        <Paragraph type="secondary" strong style={{ marginBottom: 4 }}>
          4. 安全的表达式运行时(Safe Expression)
        </Paragraph>
        <Paragraph type="secondary">
          schema 里允许写表达式,但<Text strong>不使用</Text> <Text code>eval</Text> 或{" "}
          <Text code>new Function</Text>。AlienForm 自带一个受限的解释器:
          只允许属性访问、二元运算、三元运算、字面量与逻辑运算,
          <Text strong>拒绝</Text>函数调用、赋值、模板字符串以及{" "}
          <Text code>window</Text> / <Text code>document</Text> / <Text code>__proto__</Text> 等
          危险访问。这让 schema 既能从远端动态下发,也不会把整个页面的攻击面打开。
        </Paragraph>

        <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
          四、工程约定:让协议保持「精简而完整」
        </Title>
        <Paragraph type="secondary">
          AlienForm 在长期演进中沉淀了几条工程纪律,共同作用,才能让一份 schema 真正「能用」:
        </Paragraph>
        <Paragraph type="secondary" style={{ marginLeft: 16, marginBottom: 8 }}>
          • <Text strong>奥卡姆剃刀</Text>:<Text code>packages/core</Text> 严禁保留零引用代码或
          「声明但未实现」的协议。每砍掉一行死代码,理解成本就少一分。<br />
          • <Text strong>语义对称</Text>:get/set、read/write、enter/leave 必须行为一致,
          不允许出现「读取支持嵌套但写入只支持一级」这种半截实现。<br />
          • <Text strong>模型驱动</Text>:UI 配置应当能从注册元数据自动生成,
          而不是再写一份「配置的配置」。<br />
          • <Text strong>架构分层</Text>:shell / layout 与业务 domain 必须保持清晰边界,
          业务页面只通过 provider 操作数据,不直接接触持久层。
        </Paragraph>

        <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
          五、数据层解耦:本地与远端可互换
        </Title>
        <Paragraph type="secondary">
          所有数据访问统一走 provider / API 函数,页面层不直接操作数据源。
          默认实现支持<Text strong>本地 IndexedDB(Dexie)</Text>和{" "}
          <Text strong>远端 HTTP(Cloudflare Workers + D1)</Text>两种 provider,
          可以在不改页面层一行代码的前提下互换。这不仅让本地开发与离线演示成为可能,
          也让整个仓库具备「先本地跑通,再无痛上云」的部署路径。
        </Paragraph>

        <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
          六、它适合谁
        </Title>
        <Paragraph type="secondary">
          AlienForm 不是要替代 Ant Design Form 或 Formily,也不是要做又一个低代码平台。
          它更像一个<Text strong>实验性的「后台运行时」</Text>:
          如果你正在为一个数据驱动的中后台项目做选型,厌倦了「列表抄一份、详情抄一份、编辑再抄一份」,
          想要一种 schema 即真相、视图皆投影的写法 —— 那么 AlienForm 提供的内核与约定,
          可以直接拿来用,也可以作为参考自己实现一套。
        </Paragraph>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          源码、文档与示例全部开放在{" "}
          <Link href={GITHUB_URL} target="_blank" rel="noreferrer">
            {GITHUB_URL}
          </Link>
          ,欢迎一起把这个朴素的命题继续推下去。
        </Paragraph>
      </Flex>
    ),
    guide: (
      <Flex vertical gap={4}>
        <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
          按 Formily 学习路径快速入门
        </Title>
        <Paragraph type="secondary">
          这一部分参考 Formily 官方“学习建议”的组织方式来写:先理解为什么需要 schema 驱动,
          再从一个最小可运行表单开始,随后补上联动、校验和组件映射。AlienForm 与 Formily
          一样,都强调<Text strong>先理解领域模型,再查具体组件文档</Text>。
        </Paragraph>
        <Card size="small" title="推荐阅读顺序" styles={{ body: { padding: 16 } }}>
          <Paragraph style={{ marginBottom: 8 }}>
            1. <Text strong>先看理念</Text>:理解表单不只是输入框集合,而是字段状态、校验、联动、布局共同组成的领域模型。
          </Paragraph>
          <Paragraph style={{ marginBottom: 8 }}>
            2. <Text strong>再看最小示例</Text>:先掌握 <Text code>useCreateForm</Text>、<Text code>FormProvider</Text>、<Text code>SchemaField</Text> 这三件套。
          </Paragraph>
          <Paragraph style={{ marginBottom: 8 }}>
            3. <Text strong>然后看协议驱动</Text>:把字段标题、组件、校验、联动都收敛到一份 schema 中。
          </Paragraph>
          <Paragraph style={{ marginBottom: 0 }}>
            4. <Text strong>遇到细节再查字典</Text>:组件能力、装饰器能力、字段协议都按需查文档,不要一上来把所有 API 背完。
          </Paragraph>
        </Card>

        <LiveExample
          title="快速开始: 创建表单实例并提交"
          description={
            <>
              先只掌握最核心的渲染链路: <Text code>schema</Text> 描述字段, <Text code>useCreateForm</Text> 创建表单实例, <Text code>FormProvider</Text> 注入上下文, <Text code>SchemaField</Text> 负责递归渲染。
            </>
          }
          live={<BasicFormDemo />}
          code={BASIC_CODE}
        />
      </Flex>
    ),
    scenarios: (
      <Flex vertical gap={4}>
        <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
          场景案例
        </Title>
        <Paragraph type="secondary">
          Formily 官方推荐从具体业务场景里理解协议驱动的价值。AlienForm 这里提供两个常见场景: 
          字段联动与自定义校验。你不必先记住所有协议,先从“这个场景为什么适合 schema 驱动”开始看。
        </Paragraph>

        <LiveExample
          title="场景 1: 角色权限联动"
          description={
            <>
              当一个字段的选项、显隐、可编辑态依赖另一个字段时,不要把逻辑散落在多个组件状态里,而是直接把依赖写进协议。<Text code>{"{{ ... }}"}</Text> 表达式描述字段之间的依赖关系。
            </>
          }
          live={<ReactionFormDemo />}
          code={REACTION_CODE}
        />

        <LiveExample
          title="场景 2: 自定义校验"
          description={
            <>
              <Text code>x-validate</Text> 返回 <Text code>true</Text> 表示通过,返回 <Text code>string</Text> 或 <Text code>{"{ message }"}</Text> 表示失败。先把规则放进 schema,再考虑抽成复用函数。
            </>
          }
          live={<ValidateFormDemo />}
          code={VALIDATE_CODE}
        />
      </Flex>
    ),
    advanced: (
      <Flex vertical gap={4}>
        <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
          进阶指南
        </Title>
        <Paragraph type="secondary">
          当你已经能写基础 schema 后,下一步不是机械堆字段,而是把组件抽象、数据访问和多视图投影串起来。
          真正的进阶点不在于多写几个 <Text code>x-*</Text> 属性,而在于能否把一份模型协议稳定地投影到多个界面中,并保持语义一致。
        </Paragraph>

        <Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
          1. 数据访问抽象: provider 与 API 函数
        </Title>
        <Paragraph type="secondary">
          复杂后台通常不止有表单渲染,还要处理列表查询、详情读取、保存提交。AlienForm 把这些访问统一收敛到 provider / API
          函数层,避免页面组件直接耦合具体数据源。
        </Paragraph>
        <CodeBlock>{ALIEN_CMS_PROVIDER}</CodeBlock>

        <Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
          2. 协议投影: 一份 schema 驱动多种后台视图
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 8 }}>
          这是 AlienForm 最贴近 Formily“协议复用”思想的场景。不是只渲染一个表单,而是让同一份模型 schema
          同时驱动筛选、表格、编辑和详情,避免多份配置长期漂移。
        </Paragraph>
        <CodeBlock>{ALIEN_CMS_PROJECTION}</CodeBlock>
      </Flex>
    ),
    playground: (
      <Flex vertical gap={4}>
        <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
          演练场
        </Title>
        <Paragraph type="secondary">
          你可以在这里实时修改 Schema，左侧的表单会即时热更新。填写表单并点击「提交」后，下方会展示导出的 JSON 数据。
        </Paragraph>
        <PlaygroundDemo />
      </Flex>
    ),
  };

  return (
    <Flex vertical gap={16}>
      {/* 概览 */}
      <Card styles={{ body: { padding: 24 } }}>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
          <div>
            <Title level={4} style={{ marginTop: 0 }}>
              AlienForm 学习中心
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 8, maxWidth: 720 }}>
              这里集中放置 AlienForm 的项目介绍、入门教程、场景案例与进阶指南。学习顺序参考 Formily
              文档:先理解 schema 驱动,再从最小示例入门,最后进入联动、校验与多视图投影。
            </Paragraph>
            <Flex gap={8} wrap="wrap">
              <Tag color="blue">指南</Tag>
              <Tag color="cyan">场景案例</Tag>
              <Tag color="geekblue">进阶指南</Tag>
              <Tag color="purple">演练场</Tag>
            </Flex>
          </div>
          <Button
            icon={<GithubOutlined />}
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </Button>
        </Flex>
      </Card>

      {/* 内容:Card.tabList —— 项目介绍 / 指南 / 场景案例 / 进阶指南 */}
      <Card
        style={{ width: "100%" }}
        tabList={tabList}
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
      >
        {contentList[activeTabKey]}
      </Card>
    </Flex>
  );
}
