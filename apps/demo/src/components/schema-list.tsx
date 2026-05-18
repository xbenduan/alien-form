import React from 'react'
import { ScrollArea, Badge, cn } from '@formily-bao/ui'
import type { SchemaItem } from '../useSchema'

interface SchemaListProps {
  schemas: SchemaItem[]
  selectedId: string
  onSelect: (id: string) => void
}

export const SchemaList: React.FC<SchemaListProps> = ({ schemas, selectedId, onSelect }) => {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">FormBao</h2>
        <p className="text-sm text-muted-foreground">
          共 {schemas.length} 个示例
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {schemas.map((schema) => (
            <button
              key={schema.id}
              onClick={() => onSelect(schema.id)}
              className={cn(
                'w-full rounded-lg p-3 text-left transition-colors hover:bg-accent',
                selectedId === schema.id && 'bg-accent'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{schema.name}</span>
                <Badge variant="outline" className="text-xs">
                  {Object.keys(schema.schema.properties || {}).length} 个字段
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {schema.description}
              </p>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
