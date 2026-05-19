/**
 * Lifecycle registry for form field events.
 *
 * Keeps lifecycle subscription storage and matching out of Form so Form only
 * coordinates when events are emitted.
 */

import type { IField, IForm, FormLifecycleEvent, FormLifecycleHandler } from '../types'

type LifecycleHandlerMap = Map<string, Set<FormLifecycleHandler>>

type LifecycleRegistryStore = Record<FormLifecycleEvent, LifecycleHandlerMap>

const lifecycleEvents: FormLifecycleEvent[] = [
  'onFieldInit',
  'onFieldMount',
  'onFieldUnmount',
  'onFieldValueChange',
  'onFieldInputValueChange',
  'onFieldInitialValueChange',
  'onFieldValidateStart',
  'onFieldValidateEnd',
  'onFieldValidateFailed',
  'onFieldValidateSuccess',
]

export class LifecycleRegistry {
  private readonly registry: LifecycleRegistryStore

  constructor(private readonly form: IForm) {
    this.registry = lifecycleEvents.reduce((acc, event) => {
      acc[event] = new Map()
      return acc
    }, {} as LifecycleRegistryStore)
  }

  on(event: FormLifecycleEvent, path: string, handler: FormLifecycleHandler): () => void {
    const map = this.registry[event]
    if (!map) return () => {}
    if (!map.has(path)) {
      map.set(path, new Set())
    }
    map.get(path)!.add(handler)
    return () => {
      map.get(path)?.delete(handler)
    }
  }

  emit(event: FormLifecycleEvent, path: string, field: IField): void {
    const map = this.registry[event]
    if (!map) return

    this.emitHandlers(map.get(path), field)
    this.emitHandlers(map.get('*'), field)
  }

  private emitHandlers(handlers: Set<FormLifecycleHandler> | undefined, field: IField): void {
    if (!handlers) return
    for (const handler of handlers) {
      handler(field, this.form)
    }
  }
}
