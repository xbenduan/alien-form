import React, { useCallback, useState } from "react";
import { Card, Button, Space, Divider, Typography, Tag, Alert, Badge } from "antd";
import {
  FormProvider,
  SchemaField,
  useCreateForm,
  useForm,
  useFieldValue,
  useFieldDisplay,
  useFieldDisabled,
  useFieldRequired,
  useFormValues,
  useFormErrors,
  useFormValid,
  useSignalValue,
  createForm,
  type IFormSchema,
  type FormConfig,
  type FormInstance,
} from "@alien-form/react";
import { signal as createSig } from "@alien-form/core";
import {
  Input,
  Textarea,
  NumberInput,
  Select,
  Switch,
  Radio,
  CheckboxGroup,
  FormItem,
  SectionCard,
  ArrayCards,
  TagsInput,
} from "@/adapters";

const { Title, Text, Paragraph } = Typography;

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Case Test Schema
// ═══════════════════════════════════════════════════════════════════════════════

const edgeCaseSchema: IFormSchema = {
  type: "object",
  properties: {
    // ─── E1: Circular/self-referencing reaction ─────────────────────────────
    // A field's reaction reads its own value (should stabilize, not infinite loop)
    e1: {
      type: "void",
      title: "E1: Self-referencing reaction (reads own value)",
      component: "SectionCard",
      order: 10,
      properties: {
        selfRef: {
          type: "string",
          title: "Self-ref field",
          component: "Input",
          decorator: "FormItem",
          default: "hello",
          order: 10,
          "x-reaction": {
            // Title should reflect current value — reaction reads $self's value
            title: (ctx: any) => {
              const val = ctx.get("selfRef");
              return `当前值: "${val || ""}" (长度=${(val || "").length})`;
            },
          },
        },
      },
    },

    // ─── E2: Diamond dependency ─────────────────────────────────────────────
    // A → B, A → C, B+C → D (diamond pattern, D should update once per A change)
    e2: {
      type: "void",
      title: "E2: Diamond dependency (A→B, A→C, B+C→D)",
      component: "SectionCard",
      order: 20,
      properties: {
        diamondA: {
          type: "string",
          title: "A (根源)",
          component: "Select",
          decorator: "FormItem",
          default: "x",
          dataSource: [
            { label: "X", value: "x" },
            { label: "Y", value: "y" },
            { label: "Z", value: "z" },
          ],
          order: 10,
        },
        diamondB: {
          type: "string",
          title: "B (= A + '-B')",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: "{{ diamondA + '-B' }}",
          },
        },
        diamondC: {
          type: "string",
          title: "C (= A + '-C')",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 30,
          "x-reaction": {
            value: "{{ diamondA + '-C' }}",
          },
        },
        diamondD: {
          type: "string",
          title: "D (= B + '|' + C) — 应等于 'x-B|x-C'",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 40,
          "x-reaction": {
            value: "{{ diamondB + '|' + diamondC }}",
          },
        },
      },
    },

    // ─── E3: Rapid toggle (display none → visible → none) ──────────────────
    // Field toggles display rapidly; ensure no stale state
    e3: {
      type: "void",
      title: "E3: Rapid display toggle + value preservation",
      component: "SectionCard",
      order: 30,
      properties: {
        toggleSwitch: {
          type: "boolean",
          title: "快速开关 (点击多次)",
          component: "Switch",
          decorator: "FormItem",
          default: true,
          order: 10,
        },
        toggleTarget: {
          type: "string",
          title: "受控字段 — 隐藏再显示后值应保持",
          component: "Input",
          decorator: "FormItem",
          default: "我的值应该保持不变",
          order: 20,
          "x-reaction": {
            display: "{{ toggleSwitch ? 'visible' : 'none' }}",
          },
        },
      },
    },

    // ─── E4: Chained reactions (A→B→C→D, 4 levels deep) ────────────────────
    e4: {
      type: "void",
      title: "E4: 4-level chain reaction (A→B→C→D)",
      component: "SectionCard",
      order: 40,
      properties: {
        chainA: {
          type: "string",
          title: "Chain A (输入任意值)",
          component: "Input",
          decorator: "FormItem",
          default: "start",
          order: 10,
        },
        chainB: {
          type: "string",
          title: "Chain B (= A + '→B')",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: "{{ chainA + '→B' }}",
          },
        },
        chainC: {
          type: "string",
          title: "Chain C (= B + '→C')",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 30,
          "x-reaction": {
            value: "{{ chainB + '→C' }}",
          },
        },
        chainD: {
          type: "string",
          title: "Chain D (= C + '→D') — 应等于 'start→B→C→D'",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 40,
          "x-reaction": {
            value: "{{ chainC + '→D' }}",
          },
        },
      },
    },

    // ─── E5: Reaction on multiple targets simultaneously ────────────────────
    // One trigger controls display, disabled, required, title, component of another field
    e5: {
      type: "void",
      title: "E5: One trigger → multiple targets on same field",
      component: "SectionCard",
      order: 50,
      properties: {
        multiMode: {
          type: "string",
          title: "模式选择",
          component: "Select",
          decorator: "FormItem",
          default: "normal",
          dataSource: [
            { label: "正常模式", value: "normal" },
            { label: "只读模式", value: "readonly" },
            { label: "隐藏模式", value: "hidden" },
            { label: "必填模式", value: "required" },
          ],
          order: 10,
        },
        multiTarget: {
          type: "string",
          title: "目标字段",
          component: "Input",
          decorator: "FormItem",
          default: "test value",
          order: 20,
          "x-reaction": {
            display: "{{ multiMode === 'hidden' ? 'hidden' : 'visible' }}",
            disabled: "{{ multiMode === 'readonly' }}",
            required: "{{ multiMode === 'required' }}",
            title: (ctx: any) => {
              const mode = ctx.get("multiMode");
              const map: Record<string, string> = {
                normal: "目标字段 [正常]",
                readonly: "目标字段 [只读🔒]",
                hidden: "目标字段 [隐藏]",
                required: "目标字段 [必填*]",
              };
              return map[mode] || "目标字段";
            },
          },
        },
      },
    },

    // ─── E6: Array field — reaction within rows using $row ──────────────────
    // Each row's "price" × "quantity" = "total", all via $row selector
    e6: {
      type: "void",
      title: "E6: Array rows — $row cross-field calculation",
      component: "SectionCard",
      order: 60,
      properties: {
        orderItems: {
          type: "array",
          title: "订单明细",
          component: "ArrayCards",
          decorator: "FormItem",
          props: { addText: "+ 添加商品" },
          order: 10,
          items: {
            type: "object",
            properties: {
              itemName: {
                type: "string",
                title: "商品名",
                component: "Input",
                decorator: "FormItem",
                default: "商品A",
                order: 10,
              },
              price: {
                type: "number",
                title: "单价",
                component: "Input",
                decorator: "FormItem",
                default: 100,
                props: { type: "number" },
                order: 20,
              },
              quantity: {
                type: "number",
                title: "数量",
                component: "Input",
                decorator: "FormItem",
                default: 1,
                props: { type: "number" },
                order: 30,
              },
              total: {
                type: "string",
                title: "小计",
                component: "Input",
                decorator: "FormItem",
                props: { disabled: true },
                order: 40,
                "x-reaction": {
                  value: (ctx: any) => {
                    const p = Number(ctx.get("$row.price")) || 0;
                    const q = Number(ctx.get("$row.quantity")) || 0;
                    return String(p * q);
                  },
                  title: (ctx: any) => {
                    const p = Number(ctx.get("$row.price")) || 0;
                    const q = Number(ctx.get("$row.quantity")) || 0;
                    return `小计: ¥${p * q}`;
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── E7: Conditional validation — x-validate + dynamic required ─────────
    e7: {
      type: "void",
      title: "E7: Conditional validation (动态校验规则)",
      component: "SectionCard",
      order: 70,
      properties: {
        contactType: {
          type: "string",
          title: "联系方式类型",
          component: "Radio",
          decorator: "FormItem",
          default: "email",
          dataSource: [
            { label: "邮箱", value: "email" },
            { label: "手机", value: "phone" },
          ],
          order: 10,
        },
        contactValue: {
          type: "string",
          title: "联系方式",
          component: "Input",
          decorator: "FormItem",
          order: 20,
          "x-reaction": {
            required: "{{ contactType === 'email' || contactType === 'phone' }}",
            props: (ctx: any) => {
              const type = ctx.get("contactType");
              return {
                placeholder: type === "email" ? "请输入邮箱地址" : "请输入手机号",
              };
            },
            title: (ctx: any) => {
              const type = ctx.get("contactType");
              return type === "email" ? "邮箱地址" : "手机号码";
            },
          },
          "x-validate": (ctx: any) => {
            const type = ctx.get("contactType");
            const val = ctx.value;
            if (!val) return undefined; // let required handle empty
            if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
              return "请输入有效的邮箱地址";
            }
            if (type === "phone" && !/^1\d{10}$/.test(val)) {
              return "请输入有效的手机号";
            }
            return undefined;
          },
        },
      },
    },

    // ─── E8: form.setValues external push (programmatic update) ─────────────
    e8: {
      type: "void",
      title: "E8: Programmatic setValues → reactions should fire",
      component: "SectionCard",
      order: 80,
      properties: {
        extSource: {
          type: "string",
          title: "数据源 (通过按钮模拟外部写入)",
          component: "Select",
          decorator: "FormItem",
          default: "none",
          dataSource: [
            { label: "无", value: "none" },
            { label: "套餐A", value: "planA" },
            { label: "套餐B", value: "planB" },
          ],
          order: 10,
        },
        extResult: {
          type: "string",
          title: "联动结果",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: (ctx: any) => {
              const src = ctx.get("extSource");
              const map: Record<string, string> = {
                none: "未选择套餐",
                planA: "套餐A: 100元/月, 10GB流量",
                planB: "套餐B: 200元/月, 50GB流量",
              };
              return map[src] || "未知";
            },
          },
        },
      },
    },

    // ─── E9: Deep nesting — void > object > void > primitive ────────────────
    e9: {
      type: "void",
      title: "E9: Deep nesting (void→object→void→primitive) + reaction",
      component: "SectionCard",
      order: 90,
      properties: {
        deepObj: {
          type: "object",
          title: "嵌套对象",
          properties: {
            innerVoid: {
              type: "void",
              title: "内部 Void 容器",
              component: "SectionCard",
              properties: {
                deepTrigger: {
                  type: "string",
                  title: "深层触发器",
                  component: "Select",
                  decorator: "FormItem",
                  default: "off",
                  dataSource: [
                    { label: "关闭", value: "off" },
                    { label: "开启", value: "on" },
                  ],
                  order: 10,
                },
                deepTarget: {
                  type: "string",
                  title: "深层目标",
                  component: "Input",
                  decorator: "FormItem",
                  default: "深层嵌套的值",
                  order: 20,
                  "x-reaction": {
                    disabled: "{{ deepTrigger === 'off' }}",
                    title: "{{ deepTrigger === 'on' ? '深层目标 [可编辑]' : '深层目标 [已锁定🔒]' }}",
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── E10: Cross-section reaction (field in one void reacts to field in another)
    e10: {
      type: "void",
      title: "E10: Cross-section reaction (跨 section 联动)",
      component: "SectionCard",
      order: 100,
      properties: {
        crossTrigger: {
          type: "string",
          title: "本 section 的触发器",
          component: "Input",
          decorator: "FormItem",
          default: "hello",
          order: 10,
        },
      },
    },
    e10target: {
      type: "void",
      title: "E10-target: 另一个 section 中的目标",
      component: "SectionCard",
      order: 101,
      properties: {
        crossResult: {
          type: "string",
          title: "跨 section 联动结果",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 10,
          "x-reaction": {
            value: "{{ crossTrigger + ' → 跨section到达!' }}",
          },
        },
      },
    },

    // ─── E11: Reaction returns undefined/null/empty — should not crash ──────
    e11: {
      type: "void",
      title: "E11: Reaction edge values (undefined/null/0/false/empty string)",
      component: "SectionCard",
      order: 110,
      properties: {
        edgeSelector: {
          type: "string",
          title: "选择边界值",
          component: "Select",
          decorator: "FormItem",
          default: "normal",
          dataSource: [
            { label: "正常值", value: "normal" },
            { label: "空字符串", value: "empty" },
            { label: "数字0", value: "zero" },
            { label: "false", value: "boolFalse" },
            { label: "null-ish", value: "nullish" },
          ],
          order: 10,
        },
        edgeTarget: {
          type: "string",
          title: "边界值目标",
          component: "Input",
          decorator: "FormItem",
          default: "initial",
          order: 20,
          "x-reaction": {
            value: (ctx: any) => {
              const sel = ctx.get("edgeSelector");
              switch (sel) {
                case "normal": return "正常文本";
                case "empty": return "";
                case "zero": return 0;
                case "boolFalse": return false;
                case "nullish": return undefined; // should not overwrite
                default: return "fallback";
              }
            },
          },
        },
      },
    },

    // ─── E12: Array — add/remove/move/reset ─────────────────────────────────
    e12: {
      type: "void",
      title: "E12: Array CRUD + reset (add→remove→move→reset)",
      component: "SectionCard",
      order: 120,
      properties: {
        crudList: {
          type: "array",
          title: "CRUD 列表",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [
            { label: "预置项1", priority: "high" },
            { label: "预置项2", priority: "low" },
          ],
          props: { addText: "+ 添加" },
          order: 10,
          items: {
            type: "object",
            properties: {
              label: {
                type: "string",
                title: "标签",
                component: "Input",
                decorator: "FormItem",
                order: 10,
              },
              priority: {
                type: "string",
                title: "优先级",
                component: "Select",
                decorator: "FormItem",
                default: "medium",
                dataSource: [
                  { label: "高", value: "high" },
                  { label: "中", value: "medium" },
                  { label: "低", value: "low" },
                ],
                order: 20,
              },
              // Row-level reaction: priority affects label style hint
              hint: {
                type: "string",
                title: "提示",
                component: "Input",
                decorator: "FormItem",
                props: { disabled: true },
                order: 30,
                "x-reaction": {
                  value: (ctx: any) => {
                    const p = ctx.get("$row.priority");
                    const map: Record<string, string> = {
                      high: "🔴 高优先级",
                      medium: "🟡 中优先级",
                      low: "🟢 低优先级",
                    };
                    return map[p] || "未知";
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── E13: Async reaction (simulated API call) ───────────────────────────
    e13: {
      type: "void",
      title: "E13: Async reaction (模拟异步 API 调用)",
      component: "SectionCard",
      order: 130,
      properties: {
        asyncTrigger: {
          type: "string",
          title: "搜索关键词",
          component: "Input",
          decorator: "FormItem",
          default: "",
          props: { placeholder: "输入关键词触发异步联动" },
          order: 10,
        },
        asyncResult: {
          type: "string",
          title: "异步结果",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: (ctx: any) => {
              const keyword = ctx.get("asyncTrigger");
              if (!keyword) return "请输入关键词";
              // Simulate async API call
              return new Promise<string>((resolve) => {
                setTimeout(() => {
                  resolve(`异步结果: 找到 "${keyword}" 相关的 ${keyword.length * 3} 条记录`);
                }, 500);
              });
            },
          },
        },
      },
    },

    // ─── E14: Mutually exclusive fields (A↔B toggle) ────────────────────────
    e14: {
      type: "void",
      title: "E14: Mutually exclusive fields (互斥显示)",
      component: "SectionCard",
      order: 140,
      properties: {
        exclusiveMode: {
          type: "string",
          title: "选择模式",
          component: "Radio",
          decorator: "FormItem",
          default: "text",
          dataSource: [
            { label: "文本输入", value: "text" },
            { label: "选项选择", value: "select" },
            { label: "标签输入", value: "tags" },
          ],
          order: 10,
        },
        exclusiveText: {
          type: "string",
          title: "文本输入",
          component: "Input",
          decorator: "FormItem",
          default: "文本模式的值",
          props: { placeholder: "仅在文本模式显示" },
          order: 20,
          "x-reaction": {
            display: "{{ exclusiveMode === 'text' ? 'visible' : 'none' }}",
          },
        },
        exclusiveSelect: {
          type: "string",
          title: "选项选择",
          component: "Select",
          decorator: "FormItem",
          default: "opt1",
          dataSource: [
            { label: "选项1", value: "opt1" },
            { label: "选项2", value: "opt2" },
          ],
          order: 30,
          "x-reaction": {
            display: "{{ exclusiveMode === 'select' ? 'visible' : 'none' }}",
          },
        },
        exclusiveTags: {
          type: "string",
          title: "标签输入",
          component: "TagsInput",
          decorator: "FormItem",
          order: 40,
          "x-reaction": {
            display: "{{ exclusiveMode === 'tags' ? 'visible' : 'none' }}",
          },
        },
      },
    },

    // ─── E15: form.effect() watcher — external side effect ──────────────────
    e15: {
      type: "void",
      title: "E15: form.effect() 外部 watcher (见 console)",
      component: "SectionCard",
      order: 150,
      properties: {
        watchedField: {
          type: "string",
          title: "被 form.effect() 监听的字段",
          component: "Input",
          decorator: "FormItem",
          default: "watch me",
          props: { placeholder: "修改后查看 console 输出" },
          order: 10,
        },
      },
    },

    // ─── E16: Array inside Array (数组嵌套数组) ────────────────────────────
    e16: {
      type: "void",
      title: "E16: Array inside Array (数组嵌套数组)",
      component: "SectionCard",
      order: 160,
      properties: {
        departments: {
          type: "array",
          title: "部门列表",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [
            {
              deptName: "研发部",
              members: [
                { name: "张三", role: "开发" },
                { name: "李四", role: "测试" },
              ],
            },
          ],
          props: { addText: "+ 添加部门" },
          order: 10,
          items: {
            type: "object",
            properties: {
              deptName: {
                type: "string",
                title: "部门名称",
                component: "Input",
                decorator: "FormItem",
                order: 10,
              },
              members: {
                type: "array",
                title: "成员列表",
                component: "ArrayCards",
                decorator: "FormItem",
                props: { addText: "+ 添加成员" },
                order: 20,
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      title: "姓名",
                      component: "Input",
                      decorator: "FormItem",
                      order: 10,
                    },
                    role: {
                      type: "string",
                      title: "角色",
                      component: "Select",
                      decorator: "FormItem",
                      default: "开发",
                      dataSource: [
                        { label: "开发", value: "开发" },
                        { label: "测试", value: "测试" },
                        { label: "产品", value: "产品" },
                        { label: "设计", value: "设计" },
                      ],
                      order: 20,
                    },
                    // Inner array reaction: role controls badge display
                    badge: {
                      type: "string",
                      title: "角色徽章",
                      component: "Input",
                      decorator: "FormItem",
                      props: { disabled: true },
                      order: 30,
                      "x-reaction": {
                        value: (ctx: any) => {
                          const r = ctx.get("$row.role");
                          const map: Record<string, string> = {
                            "开发": "💻 Developer",
                            "测试": "🧪 QA",
                            "产品": "📋 PM",
                            "设计": "🎨 Designer",
                          };
                          return map[r] || "❓ Unknown";
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── E17: Object inside Object (对象嵌套对象 + 深层联动) ────────────────
    e17: {
      type: "void",
      title: "E17: Object inside Object (对象嵌套对象)",
      component: "SectionCard",
      order: 170,
      properties: {
        company: {
          type: "object",
          title: "公司信息",
          component: "SectionCard",
          properties: {
            companyName: {
              type: "string",
              title: "公司名称",
              component: "Input",
              decorator: "FormItem",
              default: "Acme Inc.",
              order: 10,
            },
            address: {
              type: "object",
              title: "公司地址",
              component: "SectionCard",
              properties: {
                province: {
                  type: "string",
                  title: "省份",
                  component: "Select",
                  decorator: "FormItem",
                  default: "beijing",
                  dataSource: [
                    { label: "北京", value: "beijing" },
                    { label: "上海", value: "shanghai" },
                    { label: "广东", value: "guangdong" },
                  ],
                  order: 10,
                },
                city: {
                  type: "string",
                  title: "城市",
                  component: "Select",
                  decorator: "FormItem",
                  order: 20,
                  "x-reaction": {
                    dataSource: (ctx: any) => {
                      const prov = ctx.get("company.address.province");
                      const map: Record<string, any[]> = {
                        beijing: [{ label: "朝阳区", value: "chaoyang" }, { label: "海淀区", value: "haidian" }],
                        shanghai: [{ label: "浦东", value: "pudong" }, { label: "徐汇", value: "xuhui" }],
                        guangdong: [{ label: "广州", value: "guangzhou" }, { label: "深圳", value: "shenzhen" }],
                      };
                      return map[prov] || [];
                    },
                    value: (ctx: any) => {
                      // Reset city when province changes
                      const prov = ctx.get("company.address.province");
                      const map: Record<string, string> = {
                        beijing: "chaoyang", shanghai: "pudong", guangdong: "guangzhou",
                      };
                      return map[prov] || undefined;
                    },
                  },
                },
                // Deep nested reaction: full address summary reads from multiple nested levels
                summary: {
                  type: "string",
                  title: "地址摘要 (自动拼接)",
                  component: "Input",
                  decorator: "FormItem",
                  props: { disabled: true },
                  order: 30,
                  "x-reaction": {
                    value: (ctx: any) => {
                      const name = ctx.get("company.companyName");
                      const prov = ctx.get("company.address.province");
                      const city = ctx.get("company.address.city");
                      return `${name} — ${prov || "?"}/${city || "?"}`;
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── E18: Outside field depends on array items (外部依赖数组内字段) ──────
    e18: {
      type: "void",
      title: "E18: 外部字段依赖数组内字段 (聚合计算)",
      component: "SectionCard",
      order: 180,
      properties: {
        scores: {
          type: "array",
          title: "评分列表",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [
            { subject: "数学", score: 90 },
            { subject: "语文", score: 85 },
            { subject: "英语", score: 92 },
          ],
          props: { addText: "+ 添加科目" },
          order: 10,
          items: {
            type: "object",
            properties: {
              subject: {
                type: "string",
                title: "科目",
                component: "Input",
                decorator: "FormItem",
                order: 10,
              },
              score: {
                type: "number",
                title: "分数",
                component: "Input",
                decorator: "FormItem",
                props: { type: "number" },
                order: 20,
              },
            },
          },
        },
        // Outside field reads ALL scores from array via collection selector
        totalScore: {
          type: "string",
          title: "总分 (自动汇总数组内所有 score)",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: (ctx: any) => {
              const allScores = ctx.get("scores[].score");
              if (!Array.isArray(allScores) || allScores.length === 0) return "暂无数据";
              const total = allScores.reduce((sum: number, s: any) => sum + (Number(s) || 0), 0);
              const avg = (total / allScores.length).toFixed(1);
              return `总分: ${total}, 平均: ${avg}, 共 ${allScores.length} 科`;
            },
          },
        },
        // Conditional display based on array length
        honorBadge: {
          type: "string",
          title: "荣誉徽章",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 30,
          "x-reaction": {
            value: (ctx: any) => {
              const allScores = ctx.get("scores[].score");
              if (!Array.isArray(allScores)) return "—";
              const total = allScores.reduce((sum: number, s: any) => sum + (Number(s) || 0), 0);
              const avg = allScores.length > 0 ? total / allScores.length : 0;
              if (avg >= 95) return "🏆 特优";
              if (avg >= 90) return "🥇 优秀";
              if (avg >= 80) return "🥈 良好";
              if (avg >= 60) return "🥉 及格";
              return "❌ 不及格";
            },
            display: (ctx: any) => {
              const allScores = ctx.get("scores[].score");
              return Array.isArray(allScores) && allScores.length > 0 ? "visible" : "none";
            },
          },
        },
      },
    },

    // ─── E19: Object inside Array, with reaction reading parent array's sibling ─
    e19: {
      type: "void",
      title: "E19: 数组行内对象 + 行内跨层级引用",
      component: "SectionCard",
      order: 190,
      properties: {
        invoiceItems: {
          type: "array",
          title: "发票明细",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [{ product: { name: "笔记本", unitPrice: 5000 }, qty: 2 }],
          props: { addText: "+ 添加明细" },
          order: 10,
          items: {
            type: "object",
            properties: {
              product: {
                type: "object",
                title: "商品信息",
                component: "SectionCard",
                properties: {
                  name: {
                    type: "string",
                    title: "商品名",
                    component: "Input",
                    decorator: "FormItem",
                    default: "商品",
                    order: 10,
                  },
                  unitPrice: {
                    type: "number",
                    title: "单价 (元)",
                    component: "Input",
                    decorator: "FormItem",
                    default: 0,
                    props: { type: "number" },
                    order: 20,
                  },
                },
              },
              qty: {
                type: "number",
                title: "数量",
                component: "Input",
                decorator: "FormItem",
                default: 1,
                props: { type: "number" },
                order: 20,
              },
              // Reaction reads nested object field + sibling field
              lineTotal: {
                type: "string",
                title: "行合计",
                component: "Input",
                decorator: "FormItem",
                props: { disabled: true },
                order: 30,
                "x-reaction": {
                  value: (ctx: any) => {
                    const price = Number(ctx.get("$row.product.unitPrice")) || 0;
                    const qty = Number(ctx.get("$row.qty")) || 0;
                    return `¥${(price * qty).toLocaleString()}`;
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── E20: Array move stress test (move + inner reactions integrity) ──────
    e20: {
      type: "void",
      title: "E20: 数组 move 压力测试 (5行 + move 后 reaction 完整性)",
      component: "SectionCard",
      order: 200,
      properties: {
        stressRows: {
          type: "array",
          title: "5 行压力测试 — 移动后观察每行 label 是否正确",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [
            { color: "red" },
            { color: "green" },
            { color: "blue" },
            { color: "yellow" },
            { color: "purple" },
          ],
          props: { addText: "+ 添加行" },
          order: 10,
          items: {
            type: "object",
            properties: {
              color: {
                type: "string",
                title: "颜色",
                component: "Select",
                decorator: "FormItem",
                dataSource: [
                  { label: "🔴 Red", value: "red" },
                  { label: "🟢 Green", value: "green" },
                  { label: "🔵 Blue", value: "blue" },
                  { label: "🟡 Yellow", value: "yellow" },
                  { label: "🟣 Purple", value: "purple" },
                ],
                order: 10,
              },
              colorLabel: {
                type: "string",
                title: "颜色标签 (reaction 生成)",
                component: "Input",
                decorator: "FormItem",
                props: { disabled: true },
                order: 20,
                "x-reaction": {
                  value: (ctx: any) => {
                    const c = ctx.get("$row.color");
                    const map: Record<string, string> = {
                      red: "🔴 RED-" + ctx.path,
                      green: "🟢 GREEN-" + ctx.path,
                      blue: "🔵 BLUE-" + ctx.path,
                      yellow: "🟡 YELLOW-" + ctx.path,
                      purple: "🟣 PURPLE-" + ctx.path,
                    };
                    return map[c] || "?-" + ctx.path;
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── E21: Deeply nested reaction chain across object boundaries ─────────
    e21: {
      type: "void",
      title: "E21: 跨对象层级的 reaction 链 (obj.a → obj.b.c → obj.b.d.result)",
      component: "SectionCard",
      order: 210,
      properties: {
        outerObj: {
          type: "object",
          title: "外层对象",
          component: "SectionCard",
          properties: {
            outerInput: {
              type: "string",
              title: "外层输入",
              component: "Input",
              decorator: "FormItem",
              default: "outer",
              order: 10,
            },
            innerObj: {
              type: "object",
              title: "内层对象",
              component: "SectionCard",
              properties: {
                middleField: {
                  type: "string",
                  title: "中间层 (= outer + '-mid')",
                  component: "Input",
                  decorator: "FormItem",
                  props: { disabled: true },
                  order: 10,
                  "x-reaction": {
                    value: (ctx: any) => {
                      const outer = ctx.get("outerObj.outerInput");
                      return (outer || "") + "-mid";
                    },
                  },
                },
                deepObj: {
                  type: "object",
                  title: "最深层对象",
                  component: "SectionCard",
                  properties: {
                    deepResult: {
                      type: "string",
                      title: "最深层结果 (= middle + '-deep')",
                      component: "Input",
                      decorator: "FormItem",
                      props: { disabled: true },
                      order: 10,
                      "x-reaction": {
                        value: (ctx: any) => {
                          const mid = ctx.get("outerObj.innerObj.middleField");
                          return (mid || "") + "-deep";
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ─── E22: Array with display=none rows excluded from projection ─────────
    e22: {
      type: "void",
      title: "E22: 数组行 display=none 排除 + 外部聚合联动",
      component: "SectionCard",
      order: 220,
      properties: {
        toggleActive: {
          type: "string",
          title: "显示哪些行",
          component: "Select",
          decorator: "FormItem",
          default: "all",
          dataSource: [
            { label: "全部显示", value: "all" },
            { label: "仅高优", value: "high" },
          ],
          order: 5,
        },
        taskList: {
          type: "array",
          title: "任务列表",
          component: "ArrayCards",
          decorator: "FormItem",
          default: [
            { taskName: "重构核心模块", taskPriority: "high" },
            { taskName: "写单元测试", taskPriority: "low" },
            { taskName: "修复线上bug", taskPriority: "high" },
            { taskName: "更新文档", taskPriority: "low" },
          ],
          props: { addText: "+ 添加任务" },
          order: 10,
          items: {
            type: "object",
            properties: {
              taskName: {
                type: "string",
                title: "任务名",
                component: "Input",
                decorator: "FormItem",
                order: 10,
                "x-reaction": {
                  display: (ctx: any) => {
                    const mode = ctx.get("toggleActive");
                    if (mode === "all") return "visible";
                    const prio = ctx.get("$row.taskPriority");
                    return prio === "high" ? "visible" : "none";
                  },
                },
              },
              taskPriority: {
                type: "string",
                title: "优先级",
                component: "Select",
                decorator: "FormItem",
                default: "low",
                dataSource: [
                  { label: "高", value: "high" },
                  { label: "低", value: "low" },
                ],
                order: 20,
                "x-reaction": {
                  display: (ctx: any) => {
                    const mode = ctx.get("toggleActive");
                    if (mode === "all") return "visible";
                    const prio = ctx.get("$row.taskPriority");
                    return prio === "high" ? "visible" : "none";
                  },
                },
              },
            },
          },
        },
        visibleTaskCount: {
          type: "string",
          title: "可见任务统计 (display=none 的不计入 values)",
          component: "Input",
          decorator: "FormItem",
          props: { disabled: true },
          order: 20,
          "x-reaction": {
            value: (ctx: any) => {
              const names = ctx.get("taskList[].taskName");
              const visible = Array.isArray(names) ? names.filter((n: any) => n !== undefined) : [];
              return `可见任务: ${visible.length} 个 — ${visible.join(", ") || "无"}`;
            },
          },
        },
      },
    },
  },
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

const edgeCaseHandlers: FormConfig["handlers"] = {};

// ─── Components ──────────────────────────────────────────────────────────────

const components = {
  Input,
  Textarea,
  NumberInput,
  Select,
  Switch,
  Radio,
  CheckboxGroup,
  TagsInput,
  SectionCard,
  ArrayCards,
};
const decorators = { FormItem };

// ─── Debug Panel ─────────────────────────────────────────────────────────────

const fallbackSig = createSig(false);
const emptyArrSig = createSig([] as any[]);
const emptySig = createSig("");
const undefinedSig = createSig(undefined as any);

const DebugPanel: React.FC = () => {
  const form = useForm();
  const values = useFormValues();
  const errors = useFormErrors();
  const valid = useFormValid();

  // E1: self-ref title
  const selfRefField = form.field("selfRef");
  const selfRefTitle = useSignalValue(selfRefField?.title ?? emptySig);

  // E2: diamond D value
  const diamondDValue = useFieldValue("diamondD");

  // E3: toggle target display
  const toggleDisplay = useFieldDisplay("toggleTarget");

  // E4: chain D value
  const chainDValue = useFieldValue("chainD");

  // E5: multi target states
  const multiTargetField = form.field("multiTarget");
  const multiDisabled = useSignalValue(multiTargetField?.disabled ?? fallbackSig);
  const multiRequired = useSignalValue(multiTargetField?.required ?? fallbackSig);
  const multiDisplay = useSignalValue(multiTargetField?.display ?? emptySig);

  // E10: cross section
  const crossResult = useFieldValue("crossResult");

  // E11: edge value
  const edgeValue = useFieldValue("edgeTarget");

  // E18: total score
  const totalScoreValue = useFieldValue("totalScore");

  // E21: deep result
  const deepResultValue = useFieldValue("outerObj.innerObj.deepObj.deepResult");

  // E22: visible task count
  const visibleCountValue = useFieldValue("visibleTaskCount");

  return (
    <Card
      title={
        <span>
          Edge Case Debug Panel{" "}
          <Badge
            status={valid ? "success" : "error"}
            text={valid ? "Valid" : `${errors.length} error(s)`}
          />
        </span>
      }
      size="small"
      style={{ marginTop: 16, background: "#f6f8fa" }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={4}>
        <div>
          <Tag color="blue">E1 Self-ref</Tag>
          <Text>title = <Text code>{selfRefTitle}</Text></Text>
        </div>
        <div>
          <Tag color="green">E2 Diamond</Tag>
          <Text>D = <Text code>{JSON.stringify(diamondDValue)}</Text></Text>
        </div>
        <div>
          <Tag color="orange">E3 Toggle</Tag>
          <Text>toggleTarget.display = <Text code>{toggleDisplay}</Text></Text>
        </div>
        <div>
          <Tag color="red">E4 Chain</Tag>
          <Text>D = <Text code>{JSON.stringify(chainDValue)}</Text></Text>
        </div>
        <div>
          <Tag color="purple">E5 Multi</Tag>
          <Text>
            display=<Text code>{multiDisplay}</Text>{" "}
            disabled=<Text code>{String(multiDisabled)}</Text>{" "}
            required=<Text code>{String(multiRequired)}</Text>
          </Text>
        </div>
        <div>
          <Tag color="cyan">E10 Cross</Tag>
          <Text>crossResult = <Text code>{JSON.stringify(crossResult)}</Text></Text>
        </div>
        <div>
          <Tag color="gold">E11 Edge</Tag>
          <Text>edgeTarget = <Text code>{JSON.stringify(edgeValue)}</Text> (type: {typeof edgeValue})</Text>
        </div>
        <Divider style={{ margin: "6px 0" }} />
        <Text strong style={{ fontSize: 12 }}>New Structure Cases:</Text>
        <div>
          <Tag color="magenta">E16</Tag>
          <Text>数组套数组 — 外层 add/remove/move 后内层 reaction 仍工作</Text>
        </div>
        <div>
          <Tag color="lime">E17</Tag>
          <Text>对象套对象 — 省份→城市→地址摘要 三级联动</Text>
        </div>
        <div>
          <Tag color="volcano">E18</Tag>
          <Text>外部聚合 scores[].score — totalScore = <Text code>{JSON.stringify(totalScoreValue)}</Text></Text>
        </div>
        <div>
          <Tag color="geekblue">E19</Tag>
          <Text>行内对象 + $row.product.unitPrice × $row.qty</Text>
        </div>
        <div>
          <Tag color="orange">E20</Tag>
          <Text>5行 move 压力测试 — colorLabel 含 path 便于验证</Text>
        </div>
        <div>
          <Tag color="purple">E21</Tag>
          <Text>跨对象链 deepResult = <Text code>{JSON.stringify(deepResultValue)}</Text></Text>
        </div>
        <div>
          <Tag color="cyan">E22</Tag>
          <Text>display=none 排除 — visibleCount = <Text code>{JSON.stringify(visibleCountValue)}</Text></Text>
        </div>
      </Space>
      <Divider style={{ margin: "12px 0" }} />
      <pre
        style={{
          fontSize: 11,
          maxHeight: 300,
          overflow: "auto",
          background: "#fff",
          padding: 8,
          borderRadius: 4,
        }}
      >
        {JSON.stringify(values, null, 2)}
      </pre>
    </Card>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export const EdgeCaseTest: React.FC = () => {
  const form = useCreateForm({
    schema: edgeCaseSchema,
    handlers: edgeCaseHandlers,
  });

  const [log, setLog] = useState<string[]>([]);
  const addLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  // E15: Install form.effect() watcher
  React.useEffect(() => {
    const dispose = form.effect(
      (f) => f.get("watchedField"),
      (val, prev) => {
        const msg = `form.effect: watchedField changed "${prev}" → "${val}"`;
        console.log(msg);
        addLog(msg);
      },
    );
    return dispose;
  }, [form, addLog]);

  const handleReset = useCallback(() => {
    form.reset();
    addLog("form.reset() called");
  }, [form, addLog]);

  const handleValidate = useCallback(async () => {
    const valid = await form.validate();
    addLog(`form.validate() → ${valid ? "PASS ✓" : "FAIL ✗"}`);
  }, [form, addLog]);

  const handleSetValues = useCallback(() => {
    form.setValues({
      extSource: "planB",
      chainA: "injected",
      crossTrigger: "programmatic",
      selfRef: "set-via-API",
    });
    addLog("form.setValues() called with external data");
  }, [form, addLog]);

  const handleDestroyReinit = useCallback(() => {
    addLog("Calling form.destroy()...");
    form.destroy();
    addLog("form destroyed. Calling form.reinitialize()...");
    form.reinitialize();
    addLog("form.reinitialize() done — reactions should still work");
  }, [form, addLog]);

  return (
    <Card>
      <Title level={4}>Edge Case 极端场景测试</Title>
      <Paragraph type="secondary">
        覆盖自引用、菱形依赖、链式传播、快速切换、跨 section 联动、异步 reaction、
        数组行内计算、动态校验、边界值、嵌套层级、互斥显示、programmatic setValues、
        destroy/reinitialize 生命周期等极端场景。
      </Paragraph>

      <Alert
        type="info"
        showIcon
        message="操作指南"
        description={
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li><b>E1</b>: 修改输入框，title 应实时显示当前值和长度</li>
            <li><b>E2</b>: 切换 A，D 应等于 "X-B|X-C" 格式</li>
            <li><b>E4</b>: 修改 Chain A，D 应显示完整链 "xxx→B→C→D"</li>
            <li><b>E3</b>: 快速点击开关，值应保持不变</li>
            <li><b>E6</b>: 修改单价/数量，小计自动计算</li>
            <li><b>E8</b>: 点击"模拟外部写入"按钮，多个字段应联动更新</li>
            <li><b>E13</b>: 输入关键词后 500ms 出结果</li>
            <li><b>"Destroy + Reinit"</b>: 手动触发 destroy→reinitialize，之后所有 reaction 应仍正常</li>
            <li><b>E16</b>: 数组嵌套数组 — 外层/内层分别 add/remove/move，内层 badge reaction 正常</li>
            <li><b>E17</b>: 对象嵌套对象 — 切换省份→城市联动→地址摘要三级联动</li>
            <li><b>E18</b>: 外部字段聚合数组 — 修改/增删评分行后 totalScore 和 honorBadge 实时更新</li>
            <li><b>E19</b>: 数组行内对象 — $row.product.unitPrice × $row.qty = lineTotal</li>
            <li><b>E20</b>: 5行 move 压力 — 连续移动后每行 colorLabel 显示正确 path</li>
            <li><b>E21</b>: 跨对象层级链 — 修改外层 outerInput，deepResult 应为 "xxx-mid-deep"</li>
            <li><b>E22</b>: 数组行 display=none — 切换"仅高优"后低优行隐藏，visibleTaskCount 只统计可见行</li>
          </ul>
        }
        style={{ marginBottom: 16 }}
      />

      <Space wrap style={{ marginBottom: 16 }}>
        <Button onClick={handleReset}>重置表单</Button>
        <Button onClick={handleValidate}>校验表单</Button>
        <Button type="primary" onClick={handleSetValues}>
          模拟外部 setValues
        </Button>
        <Button danger onClick={handleDestroyReinit}>
          Destroy + Reinit
        </Button>
      </Space>

      <Divider />

      <FormProvider form={form} components={components} decorators={decorators}>
        <SchemaField />
        <DebugPanel />
      </FormProvider>

      <Divider />

      {/* Operation Log */}
      <Card title="操作日志" size="small" style={{ background: "#1a1a2e" }}>
        <div style={{ maxHeight: 200, overflow: "auto", fontFamily: "monospace", fontSize: 12 }}>
          {log.length === 0 ? (
            <Text style={{ color: "#666" }}>暂无操作日志</Text>
          ) : (
            log.map((entry, i) => (
              <div key={i} style={{ color: "#0f0", lineHeight: 1.6 }}>
                {entry}
              </div>
            ))
          )}
        </div>
      </Card>
    </Card>
  );
};
