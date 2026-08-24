# school-user 数据管线示例（Node.js + SQLite）

以 [nail-employee.ts](./nail-employee.ts)（模型 `school-user`）为例，把一份 schema
从「源头」走到「前端拿到的 JSON」，拆成 4 个阶段，每个阶段**具体产出什么**。

核心结论先放这里：

> **只有一份手写的东西 —— canonical schema。**
> 「建库 DDL」和「面向前端的 schema」都是它的 **投影（projection）**，不是两份并行维护的 DSL。
> 顺序不是「先写建表 DSL 再写前端 schema」，而是「写一次模型，`compile()` 出两个下游产物」。

```
                       ┌────────────────────────────┐
   ①源头(手写一份)  →  │      canonical schema       │  = 展示层 marker + x-database 存储层 marker
                       └──────────────┬─────────────┘
                                      │  SchemaCompiler.project(...)
                    ┌─────────────────┴──────────────────┐
                    ▼                                     ▼
        ② DDL 投影(建库)                        ② 前端 schema 投影
        CREATE TABLE school_user ...            form / table / filter
                    │                                     │
                    ▼                                     ▼
        ③ SQLite 物理行(存的是"码值")          ④ 接口 JSON(传的也是"码值")
```

---

## 〇 marker 分层：按「事实归属」切，不按「场景」切

在展开管线前，先厘清一件比命名更根本的事 —— schema 里的扩展 marker **不该按场景切**
（table 场景 / filter 场景 / database 场景），而该按 **「这个事实归谁拥有」** 切：

| 层         | marker       | 归属                 | 事实性质                                 | 例子                                               |
| ---------- | ------------ | -------------------- | ---------------------------------------- | -------------------------------------------------- |
| **能力层** | `x-database` | **后端**（存储决定） | 字段**能不能**被查询/排序/建索引，怎么存 | 列类型、`nullable`、`default`、`index`、`relation` |
| **表现层** | `x-table`    | **前端**（展示偏好） | 纯 UI 偏好，不影响数据能力               | 列宽 `width`、`ellipsis`、表格显隐 `visible`       |

由此推出三条修正（对应本轮三个问题）：

1. **`x-column` → 更名 `x-database`**：`x-table` 已占用「表格**列**」语义，再叫 `x-column`（数据库列）
   必然混淆。`x-database` 表达「字段在库里怎么存 + 支持什么操作」，与「表格列」彻底脱钩。
2. **filter 可见性归后端**：一个字段能不能进筛选区，是被**存储能力约束死的**，不是前端偏好。
   反例就是上面的 `contact`（JSON 字符串列）——它物理上**无法建索引、无法按子键查询**，
   那它就**不可能**成为 filter，前端想显示也没用。所以「可筛选」是后端的能力事实。
3. **`x-filter` 并入 `x-database`，作为独立 marker 消失**：既然可筛选是存储能力，就该和存储声明待在一起。

而且有个优雅收敛：**`index` 与「可筛选」本质是同一个事实** —— 能高效筛选 ⟺ 有索引。
所以 `x-database.index: true` **一处声明、两处产出**：DDL 建索引 + filter 投影纳入该字段，零漂移。

```jsonc
// 一个 marker 说清「后端事实」
"x-database": {
  "type": "text",
  "nullable": false,
  "default": "active",
  "index": true          // ← 既建 SQL 索引，又让该字段出现在筛选区（可筛选 ⟺ 有索引）
}
```

> 注意区分两种「不显示」：
>
> - `x-table.visible: false`（如 id/createdAt）= 后端**能**给，前端选择不展示 → **纯偏好**，留在 `x-table`；
> - filter 不出现 = 后端**给不了**（无索引/JSON 列）→ **能力约束**，由 `x-database.index` 决定。
>
> `x-table.sortable` 也略带能力色彩（无索引排序 = 全表扫描），但排序可退化成全扫，不像筛选那么硬；
> 现阶段先留在 `x-table` 保持简单，真需要时再从 `x-database.index` 派生。

---

## ① 源头：一份 canonical schema（唯一真相源）

现有的 [nail-employee.ts](./nail-employee.ts) **已经就是** canonical schema 的展示层部分。
要支持建库，只需给需要落库的字段补一个 **`x-database` 存储层 marker**（缺省时由 `FieldDescriptor`
的默认列类型兜底）。展示层（`component` / `dataSource` / `x-table`）保持不动。

关键点：**枚举值、关联关系只声明一次**，DDL 投影直接复用，不重复表达。

```ts
// 枚举字段：CHECK 约束的取值直接来自 dataSource，不再重写一遍
userType: {
  type: "string",
  title: "用户类型",
  component: "Select",
  required: true,
  dataSource: [
    { label: "学生", value: "student" },
    { label: "教师", value: "teacher" },
    { label: "教务管理员", value: "academic-admin" },
    { label: "系统管理员", value: "system-admin" },
  ],
  "x-database": { type: "text", index: true },   // ← index:true → 建索引 + 进筛选区
},

// 多选 → 多对多关系：声明一次，DDL 投影自动产出 junction 表
roleIds: {
  component: "MultiSelect",
  required: true,
  dataSource: { plugin: "$af-dataSource", model: "school-role", label: "roleName", value: "id" },
  "x-database": { relation: "many-to-many", target: "school-role", through: "school_user_role" },
},

// 单选外键（自引用：班主任也是一个 school-user）
homeroomTeacherId: {
  component: "Select",
  dataSource: { plugin: "$af-dataSource", model: "school-user", label: "displayName", value: "id" },
  "x-database": { relation: "many-to-one", target: "school-user" },
},

// 状态：有默认值 + 索引（index:true 同时驱动 DDL 索引与 filter 可见）
status: {
  component: "Select",
  required: true,
  dataSource: [ /* active / pending / disabled / closed */ ],
  "x-database": { type: "text", nullable: false, default: "active", index: true },
},

// 时间：物理层用 epoch ms 存整型（与 seeds.ts 的 getTime() 一致）
lastLoginAt: {
  component: "DateInput",
  "x-database": { type: "integer" },
},

// 对象字段：表里不做嵌套，整体序列化成一个 JSON 字符串列（JSON 列不可索引 → 天然不进筛选区）
contact: {
  type: "object",
  title: "联系方式",
  properties: {
    wechat: { type: "string", title: "微信" },
    qq:     { type: "string", title: "QQ" },
    address:{ type: "string", title: "住址" },
  },
  // 缺省即 { type: "json" }，可显式写以表意
  "x-database": { type: "json" },
},
```

`required: true` → `NOT NULL`；`type: "string"` 无 marker → 默认 `TEXT`；
`DateInput` → 默认 `INTEGER(epoch ms)`；
**`type: "object"`（及 `array`）无 marker → 默认 `TEXT`，整体 JSON 序列化**；
**`x-database.index: true` → DDL 建索引 + 该字段进入 filter 投影**（可筛选 ⟺ 有索引）。
这些都是 **显式映射表**，不靠猜。

> **`x-filter` 已废弃**：字段是否进筛选区不再由前端 schema 的 `x-filter.visible` 声明，
> 而是由后端的 `x-database.index` 决定。filter 投影从「读 `x-filter.visible !== false`」
> 改为「读 `x-database.index === true`」。

### object / array 的落库策略

表里**绝不做嵌套结构**（不拆子表、不 flatten 成 `contact_wechat` 这类列）。
一个 `type: "object"` 字段 = 一个 `TEXT` 列，存 `JSON.stringify(value)`：

- **写入**：`contact` 对象 → `JSON.stringify` → 存进 `contact` 列（TEXT）；
- **读取**：取出字符串 → `JSON.parse` → 还原成对象给前端；
- **前端**：`properties` 照常投影出子表单控件，用户编辑的是结构化对象，**只有物理层是字符串**；
- **代价**：JSON 列**不能建索引 / 不能按子键查询**。如果某个子键需要被查询或过滤，
  说明它其实该是一个独立的顶层字段，而不是塞进 object。

> `type: "array"`（如非关系型的标签数组 `["a","b"]`）同理：也是一个 `TEXT` 列存 JSON。
> 唯一例外是 `roleIds` 这种 **`$af-dataSource` 关联型多选** —— 它是关系不是数据，走 junction 表（见下）。
> 区分标准：**值是"引用别的表的 id" → junction 表；值是"自包含的数据" → JSON 字符串列。**

---

## ② 第一步产出：建库 DDL 投影（SQLite）

`SchemaCompiler` 的 `ddl` 投影读上面的 `x-database`，产出建表语句。
命名从 `camelCase` 转 `snake_case`（这是投影的一条规则，前端字段名不受影响）。

```sql
-- 主表
CREATE TABLE school_user (
  id                  TEXT PRIMARY KEY,
  user_no             TEXT NOT NULL UNIQUE,
  username            TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  user_type           TEXT NOT NULL
                        CHECK (user_type IN ('student','teacher','academic-admin','system-admin')),
  gender              TEXT CHECK (gender IN ('male','female','other')),
  phone               TEXT,
  email               TEXT,
  grade               TEXT CHECK (grade IN ('grade-1','grade-2','grade-3','grade-4','grade-5','grade-6')),
  class_name          TEXT,
  student_no          TEXT,
  department          TEXT,
  teacher_title       TEXT CHECK (teacher_title IN ('assistant','lecturer','associate-professor','professor')),
  homeroom_teacher_id TEXT REFERENCES school_user(id),          -- 自引用外键
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','pending','disabled','closed')),
  last_login_at       INTEGER,                                  -- epoch ms
  contact             TEXT,                                     -- type:object → JSON 字符串，不拆列
  remark              TEXT,
  created_at          INTEGER,
  updated_at          INTEGER,
  generated_at        INTEGER,
  created_by          TEXT,
  updated_by          TEXT,
  deleted_at          INTEGER
);

CREATE INDEX idx_school_user_user_type ON school_user(user_type);
CREATE INDEX idx_school_user_status    ON school_user(status);
CREATE INDEX idx_school_user_homeroom  ON school_user(homeroom_teacher_id);
-- ↑ 这三个 index 由 x-database.index:true 产出，同时也是前端筛选区的三个 filter 字段

-- roleIds 是 MultiSelect → 多对多，落地成独立 junction 表（不塞进主表）
CREATE TABLE school_user_role (
  user_id TEXT NOT NULL REFERENCES school_user(id)  ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES school_role(id)  ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
```

> SQLite 没有原生 `ENUM` / `BOOLEAN` / `DATETIME`：枚举用 `TEXT + CHECK`，
> 布尔用 `INTEGER 0/1`，时间用 `INTEGER(epoch)`。这些是 SQLite dialect 的映射细节。

---

## ② 第二步产出：面向前端的 schema 投影

前端拿到的配置态 schema **就是 [nail-employee.ts](./nail-employee.ts)**（`x-database` 的存储细节
前端不关心，但 `index` 布尔会被保留下来驱动 filter）。前端再经 `SchemaCompiler` 投影成
form / table / filter。例如 `userType` 字段：

```jsonc
// form 投影（新增/编辑用）
{
  "userType": {
    "type": "string",
    "component": "Select",
    "title": "用户类型",
    "required": true,
    "enum": [
      { "label": "学生", "value": "student" },
      { "label": "教师", "value": "teacher" },
      { "label": "教务管理员", "value": "academic-admin" },
      { "label": "系统管理员", "value": "system-admin" },
    ],
  },
}
```

`roleIds` 的 `$af-dataSource` marker 会在这一步被解析成 `props.service`
（`{ model: "school-role", labelKey: "roleName", valueKey: "id" }`），由组件自取选项。

**filter 投影**只收 `x-database.index === true` 的字段（本例：`userType` / `status` / `homeroomTeacherId`），
和 DDL 建的索引一一对应 —— 前端无法凭空声明一个后端查不了的筛选项。

---

## ③ 最终存入 SQLite 的是什么

存的是**码值（value），不是 label**。一条学生记录落库后：

`school_user` 表里的一行：

| id        | user_no | display_name | user_type | ... | status   | last_login_at | contact                                                  |
| --------- | ------- | ------------ | --------- | --- | -------- | ------------- | -------------------------------------------------------- |
| user-1001 | U1001   | 王小明       | `student` | ... | `active` | 1724200000000 | `{"wechat":"wx_alice","qq":"10001","address":"XX路1号"}` |

`school_user_role` 表里的关联行（roleIds 被拆开，**不在主表**）：

| user_id   | role_id      |
| --------- | ------------ |
| user-1001 | role-student |

注意：

- 存的是 `student` / `active` / `role-student` 这样的**码值**，绝不存"学生""正常"这些 label；
- `roleIds` 数组被拆成 junction 表的多行；
- `contact` 对象**整体存成一个 JSON 字符串**（TEXT 列），表里没有 `contact_wechat` 之类的展开列；
- 时间是整型 epoch ms。

---

## ④ 前端通过接口拿到的是什么

`GET /api/records?model=school-user&page=1&pageSize=10` 的响应。
字段名转回 `camelCase`，`roleIds` 从 junction 表**重新聚合成数组**，
`contact` 由存的 JSON 字符串 **`JSON.parse` 还原成对象**，值依然是**码值**：

```json
{
  "list": [
    {
      "id": "user-1001",
      "userNo": "U1001",
      "username": "alice",
      "displayName": "王小明",
      "userType": "student",
      "roleIds": ["role-student"],
      "gender": "male",
      "grade": "grade-3",
      "className": "三年二班",
      "studentNo": "2023001",
      "homeroomTeacherId": "user-2001",
      "status": "active",
      "lastLoginAt": 1724200000000,
      "contact": { "wechat": "wx_alice", "qq": "10001", "address": "XX路1号" },
      "createdAt": 1721600000000,
      "updatedAt": 1724100000000
    }
  ],
  "total": 1
}
```

**label 不在接口里**："student → 学生""role-student → 学生角色""user-2001 → 李老师"
都是前端在渲染时，用同一份 `dataSource`（静态 enum 或 `$af-dataSource` 拉取的关联表）解析出来的。
`contact` 则是后端 parse 后直接给的结构化对象——**物理层是字符串，接口层已还原成对象**，前端无感知。

> 这正是「非损耗数据流」：码值从表单 → 数据库 → 接口 → 表格，全程原样流动；
> label 只是渲染层的一次查表，永远不进入存储和传输。

---

## 各阶段对照总览

| 阶段   | 产物                          | `userType`                        | `roleIds`                         | `contact`（object）                 |
| ------ | ----------------------------- | --------------------------------- | --------------------------------- | ----------------------------------- |
| ① 源头 | canonical schema（唯一手写）  | `dataSource` + `x-database.index` | `$af-dataSource` + `relation:m2m` | `properties` + `x-database:json`    |
| ② 建库 | `CREATE TABLE`（DDL 投影）    | `TEXT CHECK(...)` + 索引          | 独立 `school_user_role` 表        | 单个 `TEXT` 列（不拆列）            |
| ② 前端 | form/table/filter（前端投影） | `Select` + `enum` + **进筛选区**  | `MultiSelect` + `props.service`   | 子表单控件（**不进筛选区**）        |
| ③ 存库 | SQLite 物理行                 | `'student'`（码值）               | junction 多行                     | `'{"wechat":...}'`（JSON 字符串）   |
| ④ 接口 | JSON 响应                     | `"student"`（码值）               | `["role-student"]`（聚合回数组）  | `{ "wechat": ... }`（parse 回对象） |

**一句话**：schema 不"就是"建表 DSL —— 它是上游的领域模型；建表 DSL 是它往 SQLite 方向的一个投影，
前端 schema 是它往浏览器方向的另一个投影。两个下游同源、永不漂移。
