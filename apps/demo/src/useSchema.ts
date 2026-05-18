import type { IFormSchema } from '@formily-bao/core'

export interface SchemaItem {
  id: string
  name: string
  description: string
  schema: IFormSchema
}

type SchemaModule = SchemaItem

const modules = import.meta.glob<SchemaModule>('./schema/**/*.json', {
  eager: true,
  import: 'default',
})

export const schemas: SchemaItem[] = Object.entries(modules)
  .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
  .map(([, schema]) => schema)

export function useSchema() {
  return schemas
}
