import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { BuilderReactionTarget, ModelBuilderReactionDraft } from '@alien-form/cms';
import { Button, Empty, Input, Select, Space, Typography } from 'antd';
import { getHandlerMeta, getHandlerOptions } from '../../../shared/handlers';

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

const reactionModeOptions = [
  { label: '表达式', value: 'expression' },
  { label: 'Handler', value: 'handler' },
] as const;

interface HandlerSelectEditorProps {
  reactions: ModelBuilderReactionDraft[];
  onChange: (nextReactions: ModelBuilderReactionDraft[]) => void;
}

function buildHandlerParams(
  handlerName: string,
  previousParams: Record<string, string> = {},
): Record<string, string> {
  const handlerMeta = getHandlerMeta(handlerName);
  if (!handlerMeta) {
    return {};
  }

  return Object.fromEntries(
    handlerMeta.params.map((param) => [param.name, previousParams[param.name] ?? '']),
  );
}

export function HandlerSelectEditor({ reactions, onChange }: HandlerSelectEditorProps) {
  const updateReaction = (
    reactionId: string,
    updater: (reaction: ModelBuilderReactionDraft) => ModelBuilderReactionDraft,
  ) => {
    onChange(reactions.map((reaction) => (reaction.id === reactionId ? updater(reaction) : reaction)));
  };

  return (
    <div className="builder-reaction-list">
      <div className="builder-panel-subtitle">Handlers / Reactions</div>

      {reactions.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂未配置 reaction" /> : null}

      {reactions.map((reaction) => {
        const handlerOptions = getHandlerOptions(reaction.target);
        const selectedHandler = getHandlerMeta(reaction.handler);
        const paramsHint = selectedHandler?.params
          .map((param) => {
            const requiredText = param.required ? '必填' : '可选';
            return `${param.name} (${param.type}, ${requiredText})${param.description ? `: ${param.description}` : ''}`;
          })
          .join('；');

        return (
          <div key={reaction.id} className="builder-reaction-card">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Select
                value={reaction.target}
                options={reactionTargetOptions}
                onChange={(target) =>
                  updateReaction(reaction.id, (currentReaction) => {
                    if (currentReaction.mode !== 'handler' || !currentReaction.handler) {
                      return { ...currentReaction, target };
                    }

                    const nextHandlerOptions = getHandlerOptions(target);
                    const canKeepHandler = nextHandlerOptions.some(
                      (option) => option.name === currentReaction.handler,
                    );

                    return canKeepHandler
                      ? { ...currentReaction, target }
                      : { ...currentReaction, target, handler: '', handlerParams: {} };
                  })
                }
              />
              <Select
                value={reaction.mode}
                options={reactionModeOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
                onChange={(mode) =>
                  updateReaction(reaction.id, (currentReaction) =>
                    mode === 'expression'
                      ? {
                          ...currentReaction,
                          mode,
                          handler: '',
                          handlerParams: {},
                        }
                      : {
                          ...currentReaction,
                          mode,
                          expressionText: '',
                        },
                  )
                }
              />
              {reaction.mode === 'expression' ? (
                <Input.TextArea
                  value={reaction.expressionText}
                  autoSize={{ minRows: 3, maxRows: 6 }}
                  placeholder='$values.status === "draft"'
                  onChange={(event) =>
                    updateReaction(reaction.id, (currentReaction) => ({
                      ...currentReaction,
                      expressionText: event.target.value,
                    }))
                  }
                />
              ) : (
                <>
                  <Select
                    value={reaction.handler || undefined}
                    placeholder="选择全局 handler"
                    options={handlerOptions.map((item) => ({
                      label: item.label,
                      value: item.value,
                    }))}
                    onChange={(handler) =>
                      updateReaction(reaction.id, (currentReaction) => ({
                        ...currentReaction,
                        handler,
                        handlerParams: buildHandlerParams(handler, currentReaction.handlerParams),
                      }))
                    }
                  />
                  {selectedHandler?.params.map((param) => (
                    <div key={param.name}>
                      <Typography.Text type="secondary">
                        {param.name}
                        {param.description ? `: ${param.description}` : ''}
                      </Typography.Text>
                      <Input
                        value={reaction.handlerParams[param.name] ?? ''}
                        placeholder={`例如 $row.${param.name}`}
                        onChange={(event) =>
                          updateReaction(reaction.id, (currentReaction) => ({
                            ...currentReaction,
                            handlerParams: {
                              ...currentReaction.handlerParams,
                              [param.name]: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </>
              )}
              <div className="builder-reaction-card-footer">
                <Typography.Text type="secondary">
                  {reaction.mode === 'expression'
                    ? '表达式会写入 x-reaction'
                    : `配置写入 x-cms.reactions.params${selectedHandler ? `（${selectedHandler.description}）` : ''}`}
                </Typography.Text>
                {reaction.mode === 'handler' && paramsHint ? (
                  <Typography.Text type="secondary">参数：{paramsHint}</Typography.Text>
                ) : null}
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
              mode: 'expression',
              handler: '',
              expressionText: '',
              handlerParams: {},
            },
          ])
        }
      >
        新增 Reaction
      </Button>
    </div>
  );
}
