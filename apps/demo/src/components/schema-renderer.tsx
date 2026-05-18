import React, { useState, useMemo, useCallback } from 'react'
import { createForm } from '@formily-bao/core'
import { FormProvider, SchemaField } from '@formily-bao/react'
import type { FormConfig } from '@formily-bao/core'
import type { ComponentMap, DecoratorMap } from '@formily-bao/react'
import {
  Card, CardHeader, CardTitle, CardContent, CardFooter,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Button,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  DateInput,
  ItemInput,
  RadioGroup,
  Rating,
  FormItem,
  FormGrid,
  FormLayout,
  FormSection,
  ArrayCards,
  ArrayTable,
} from '@formily-bao/ui'
import type { SchemaItem } from '../useSchema'

// --- Async data source services (for demo) ---

const categoryData: Record<string, Array<{ label: string; value: string }>> = {
  tech: [
    { label: 'Frontend', value: 'frontend' },
    { label: 'Backend', value: 'backend' },
    { label: 'DevOps', value: 'devops' },
    { label: 'AI/ML', value: 'ai' },
  ],
  design: [
    { label: 'UI Design', value: 'ui' },
    { label: 'UX Research', value: 'ux' },
    { label: 'Brand Design', value: 'brand' },
  ],
  business: [
    { label: 'Marketing', value: 'marketing' },
    { label: 'Sales', value: 'sales' },
    { label: 'Strategy', value: 'strategy' },
  ],
}

const asyncServices: FormConfig['services'] = {
  fetchCategories: async () => {
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800))
    return [
      { label: 'Technology', value: 'tech' },
      { label: 'Design', value: 'design' },
      { label: 'Business', value: 'business' },
    ]
  },
  fetchSubCategories: async (params) => {
    await new Promise((r) => setTimeout(r, 600))
    const cat = params.category
    if (!cat) return []
    return categoryData[cat] || []
  },
}

const asyncTransformers: FormConfig['transformers'] = {
  parseCountries: (json: any) => {
    if (!Array.isArray(json)) return []
    return json
      .map((c: any) => ({
        label: c.name?.common || c.name,
        value: c.cca2 || c.name?.common,
      }))
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
      .slice(0, 20) // Limit to 20 for demo
  },
}

// Register all components
const components: ComponentMap = {
  Input: (props: any) => {
    const { value, onChange, loading, ...rest } = props
    return <Input value={value ?? ''} onChange={(e: any) => onChange(e.target.value)} {...rest} />
  },
  Textarea: (props: any) => {
    const { value, onChange, loading, ...rest } = props
    return <Textarea value={value ?? ''} onChange={(e: any) => onChange(e.target.value)} {...rest} />
  },
  Select: (props: any) => {
    const { loading, ...rest } = props
    return (
      <div className="relative">
        <Select {...rest} />
        {loading && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>
    )
  },
  Checkbox,
  Switch,
  DateInput,
  ItemInput,
  RadioGroup,
  Rating,
  // Layout components
  FormGrid,
  FormLayout,
  FormSection,
  // Array components
  ArrayCards,
  ArrayTable,
}

const decorators: DecoratorMap = {
  FormItem,
}

interface SchemaRendererProps {
  schema: SchemaItem
}

export const SchemaRenderer: React.FC<SchemaRendererProps> = ({ schema }) => {
  const [result, setResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useMemo(() => createForm({
    services: asyncServices,
    transformers: asyncTransformers,
  }), [schema.id])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    try {
      const values = await form.submit()
      setResult({ success: true, values, timestamp: new Date().toISOString() })
    } catch (err: any) {
      setResult({ success: false, errors: err?.messages || [String(err)], timestamp: new Date().toISOString() })
    } finally {
      setSubmitting(false)
    }
  }, [form])

  const handleReset = useCallback(() => {
    form.reset()
    setResult(null)
  }, [form])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{schema.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{schema.description}</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="form">
            <TabsList className="mb-4">
              <TabsTrigger value="form">Form Render</TabsTrigger>
              <TabsTrigger value="json">Schema JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="form">
              <FormProvider form={form} components={components} decorators={decorators}>
                <SchemaField schema={schema.schema} />
              </FormProvider>
            </TabsContent>
            <TabsContent value="json">
              <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto max-h-[500px]">
                <code>{JSON.stringify(schema.schema, null, 2)}</code>
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex gap-2 border-t pt-4">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
        </CardFooter>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Submit Result
              <span className={`inline-block h-2 w-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-destructive'}`} />
            </CardTitle>
            <p className="text-xs text-muted-foreground">{result.timestamp}</p>
          </CardHeader>
          <CardContent>
            <pre className="rounded-lg bg-muted p-4 text-sm overflow-auto max-h-[300px]">
              <code>
                {result.success
                  ? JSON.stringify(result.values, null, 2)
                  : JSON.stringify(result.errors, null, 2)}
              </code>
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
