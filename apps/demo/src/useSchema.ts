import type { IFormSchema } from '@alien-form/core'

export interface SchemaItem {
  id: string
  name: string
  description: string
  category?: string
  order?: number
  tags?: string[]
  schema: IFormSchema
}

type SchemaModule = SchemaItem

const modules = import.meta.glob<SchemaModule>('./schema/**/*.json', {
  eager: true,
  import: 'default',
})

export const schemas: SchemaItem[] = Object.entries(modules)
  .map(([path, schema]) => ({
    ...schema,
    order: schema.order ?? Number.MAX_SAFE_INTEGER,
    category: schema.category ?? '未分类',
    tags: schema.tags ?? [],
    id: schema.id || path,
  }))
  .sort((a, b) => {
    const orderDiff = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
    if (orderDiff !== 0) return orderDiff
    return a.name.localeCompare(b.name)
  })

export function useSchema() {
  return schemas
}
