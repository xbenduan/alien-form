import React from 'react'
import { ScrollArea, Badge, cn } from '@alien-form/ui'
import type { SchemaItem } from '../useSchema'

interface SchemaListProps {
  schemas: SchemaItem[]
  selectedId: string
  onSelect: (id: string) => void
}

export const SchemaList: React.FC<SchemaListProps> = ({ schemas, selectedId, onSelect }) => {
  const groups = schemas.reduce<Record<string, SchemaItem[]>>((acc, schema) => {
    const category = schema.category || '未分类'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(schema)
    return acc
  }, {})

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">AlienForm Demo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          企业级 Schema 协议学习路径，共 {schemas.length} 个示例
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-2">
          {Object.entries(groups).map(([category, items]) => (
            <section key={category}>
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </div>
              <div className="space-y-1">
                {items.map((schema) => (
                  <button
                    key={schema.id}
                    onClick={() => onSelect(schema.id)}
                    className={cn(
                      'w-full rounded-lg p-3 text-left transition-colors hover:bg-accent',
                      selectedId === schema.id && 'bg-accent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{schema.name}</span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {Object.keys(schema.schema.properties || {}).length} 字段
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {schema.description}
                    </p>
                    {!!schema.tags?.length && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {schema.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
