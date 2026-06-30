import { DeleteOutlined } from "../../../shared/ui";
import type { BuilderReactionTarget, ModelBuilderReactionDraft } from '@alien-form/cms';
import { Empty, Input, Select } from "../../../shared/ui";
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
      {reactions.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据，点击右上角「添加」" /> : null}

      {reactions.map((reaction) => {
        const handlerOptions = getHandlerOptions(reaction.target);
        const selectedHandler = getHandlerMeta(reaction.handler);

        return (
          <div key={reaction.id} className="builder-reaction-card">
            <div className="builder-reaction-card-header">
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
              <button
                type="button"
                className="builder-reaction-delete-btn"
                onClick={() => onChange(reactions.filter((item) => item.id !== reaction.id))}
                aria-label="删除"
              >
                <DeleteOutlined />
              </button>
            </div>
            {reaction.mode === 'expression' ? (
              <Input.TextArea
                value={reaction.expressionText}
                autoSize={{ minRows: 2, maxRows: 4 }}
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
                  placeholder="选择 handler"
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
                  <div key={param.name} className="builder-reaction-param">
                    <span className="builder-reaction-param-label">{param.name}</span>
                    <Input
                      value={reaction.handlerParams[param.name] ?? ''}
                      placeholder={`$row.${param.name}`}
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
          </div>
        );
      })}
    </div>
  );
}
