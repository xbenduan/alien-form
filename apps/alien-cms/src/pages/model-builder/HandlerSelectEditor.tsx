import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Select, Space, Typography } from 'antd';
import { schemaHandlerCatalog } from '../../app/schema-handlers';
import type { BuilderReactionTarget, ModelBuilderReactionDraft } from '../../types/model-builder';

const reactionTargetOptions: Array<{ label: string; value: BuilderReactionTarget }> = [
  { label: 'value', value: 'value' },
  { label: 'display', value: 'display' },
  { label: 'disabled', value: 'disabled' },
  { label: 'required', value: 'required' },
  { label: 'title', value: 'title' },
  { label: 'description', value: 'description' },
  { label: 'props', value: 'props' },
  { label: 'dataSource', value: 'dataSource' },
];

interface HandlerSelectEditorProps {
  reactions: ModelBuilderReactionDraft[];
  onChange: (nextReactions: ModelBuilderReactionDraft[]) => void;
}

export function HandlerSelectEditor({ reactions, onChange }: HandlerSelectEditorProps) {
  return (
    <div className="builder-reaction-list">
      <div className="builder-panel-subtitle">Handlers / Reactions</div>

      {reactions.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未配置 reaction" /> : null}

      {reactions.map((reaction) => {
        const handlerOptions = schemaHandlerCatalog
          .filter((item) => item.supportedTargets.includes(reaction.target))
          .map((item) => ({
            label: item.label,
            value: item.name,
          }));

        return (
          <div key={reaction.id} className="builder-reaction-card">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Select
                value={reaction.target}
                options={reactionTargetOptions}
                onChange={(target) =>
                  onChange(reactions.map((item) => (item.id === reaction.id ? { ...item, target } : item)))
                }
              />
              <Select
                value={reaction.handler || undefined}
                placeholder="选择全局 handler"
                options={handlerOptions}
                onChange={(handler) =>
                  onChange(reactions.map((item) => (item.id === reaction.id ? { ...item, handler } : item)))
                }
              />
              <Input.TextArea
                value={reaction.paramsText}
                autoSize={{ minRows: 3, maxRows: 6 }}
                placeholder='{"selector":"status","equals":"draft"}'
                onChange={(event) =>
                  onChange(
                    reactions.map((item) =>
                      item.id === reaction.id ? { ...item, paramsText: event.target.value } : item,
                    ),
                  )
                }
              />
              <div className="builder-reaction-card-footer">
                <Typography.Text type="secondary">`params` 使用 JSON 对象</Typography.Text>
                <Button
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => onChange(reactions.filter((item) => item.id !== reaction.id))}
                >
                  删除
                </Button>
              </div>
            </Space>
          </div>
        );
      })}

      <Button
        block
        icon={<PlusOutlined />}
        onClick={() =>
          onChange([
            ...reactions,
            {
              id: `reaction-${Date.now()}`,
              target: 'value',
              handler: '',
              paramsText: '{}',
            },
          ])
        }
      >
        新增 Reaction
      </Button>
    </div>
  );
}
