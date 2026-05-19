/**
 * @alien-form/core — Coalesced notification scheduler.
 *
 * Keeps Form focused on orchestration while this small scheduler owns batching,
 * deduping and flush ordering for field/value/version notifications.
 */

import type { IField } from '../types'

export interface NotificationSchedulerHost {
  runReactionTriggers(path: string): void
  commitVersionChange(): void
  emitFieldChange(path: string, field: IField): void
  emitValuesChange(): void
  beforeFlush?(): void
  afterFlush?(): void
}

export class NotificationScheduler {
  private _batchDepth = 0
  private _pendingFieldChanges: Map<string, IField> = new Map()
  private _pendingValueChange = false
  private _pendingReactionTriggerPaths: Set<string> = new Set()
  private _pendingVersionChange = false
  private _flushing = false

  constructor(private readonly host: NotificationSchedulerHost) {}

  get isBatching(): boolean {
    return this._batchDepth > 0
  }

  get isFlushing(): boolean {
    return this._flushing
  }

  beginBatch(): void {
    this._batchDepth += 1
  }

  endBatch(): void {
    if (this._batchDepth === 0) return
    this._batchDepth -= 1
    if (this._batchDepth === 0) {
      this.flush()
    }
  }

  queueFieldChange(path: string, field: IField): void {
    this._pendingFieldChanges.set(path, field)
  }

  queueValueChange(): void {
    this._pendingValueChange = true
  }

  queueReactionTrigger(path: string): void {
    this._pendingReactionTriggerPaths.add(path)
  }

  queueVersionChange(): void {
    this._pendingVersionChange = true
  }

  flush(): void {
    if (this._batchDepth > 0 || this._flushing) return
    if (
      this._pendingReactionTriggerPaths.size === 0 &&
      this._pendingFieldChanges.size === 0 &&
      !this._pendingValueChange &&
      !this._pendingVersionChange
    ) {
      return
    }

    this._flushing = true
    this.host.beforeFlush?.()
    try {
      while (
        this._pendingReactionTriggerPaths.size > 0 ||
        this._pendingFieldChanges.size > 0 ||
        this._pendingValueChange ||
        this._pendingVersionChange
      ) {
        const reactionPaths = Array.from(this._pendingReactionTriggerPaths)
        this._pendingReactionTriggerPaths.clear()
        for (const path of reactionPaths) {
          this.host.runReactionTriggers(path)
        }

        const fieldChanges = Array.from(this._pendingFieldChanges.entries())
        this._pendingFieldChanges.clear()
        const shouldNotifyValues = this._pendingValueChange
        const shouldBumpVersion = this._pendingVersionChange || fieldChanges.length > 0 || shouldNotifyValues
        this._pendingValueChange = false
        this._pendingVersionChange = false

        if (shouldBumpVersion) {
          this.host.commitVersionChange()
        }

        for (const [path, field] of fieldChanges) {
          this.host.emitFieldChange(path, field)
        }

        if (shouldNotifyValues) {
          this.host.emitValuesChange()
        }
      }
    } finally {
      this.host.afterFlush?.()
      this._flushing = false
    }
  }
}
