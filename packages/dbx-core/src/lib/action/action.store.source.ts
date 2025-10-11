import { first, switchMap, Observable, Subscription } from 'rxjs';
import { LockSet, filterMaybe, LoadingState, LoadingStateType } from '@dereekb/rxjs';
import { Destroyable, Maybe, ReadableError } from '@dereekb/util';
import { ActionContextState, ActionContextStore } from './action.store';
import { DbxActionDisabledKey, DbxActionRejectedPair, DbxActionState, DbxActionSuccessPair, DbxActionWorkOrWorkProgress, DbxActionWorkProgress } from './action';

/**
 * Source that provides a ActionContextStore observable.
 */
export abstract class ActionContextStoreSource<T = unknown, O = unknown> {
  /**
   * Observable referencing the ActionContextStore.
   *
   * This observable by design is pre-filtered to not return null values.
   */
  abstract readonly store$: Observable<ActionContextStore<T, O>>;
}

/**
 * Secondary source. Used by DbxActionContextComponent to find secondary sources.
 */
export abstract class SecondaryActionContextStoreSource<T = unknown, O = unknown> extends ActionContextStoreSource<T, O> {}

export function actionContextStoreSourcePipe<T, O>(obs: Observable<Maybe<ActionContextStore<T, O>>>): Observable<ActionContextStore<T, O>> {
  return obs.pipe(filterMaybe());
}

export type PipeActionStoreFunction<R, T, O> = (store: ActionContextStore<T, O>) => Observable<R>;

export function pipeActionStore<R = unknown, T = unknown, O = unknown>(source: ActionContextStoreSource<T, O>, pipeFn: PipeActionStoreFunction<R, T, O>): Observable<R> {
  return source.store$.pipe(switchMap(pipeFn));
}

export type UseActionStoreFunction<T, O> = (store: ActionContextStore<T, O>) => void;

/**
 * Convenience function for subscribing to the input source once and using the provided store.
 */
export function useActionStore<T = unknown, O = unknown>(source: ActionContextStoreSource<T, O>, useFn: UseActionStoreFunction<T, O>): Subscription {
  return source.store$.pipe(first()).subscribe(useFn);
}

/**
 * Service that wraps a ActionContextStoreSource.
 */
export class DbxActionContextStoreSourceInstance<T = unknown, O = unknown> implements ActionContextStoreSource<T, O>, Destroyable {
  readonly lockSet = new LockSet();

  private readonly _source: ActionContextStoreSource<T, O>;

  constructor(source: ActionContextStoreSource<T, O>) {
    if (!source) {
      throw new Error('Source is required.');
    }

    this._source = source;
  }

  get source(): ActionContextStoreSource<T, O> {
    return this._source;
  }

  public destroy(): void {
    this.lockSet.destroyOnNextUnlock();
  }

  // MARK: Store
  get store$(): Observable<ActionContextStore<T, O>> {
    return this.source.store$;
  }

  pipeStore<R>(pipeFn: PipeActionStoreFunction<R, T, O>): Observable<R> {
    return pipeActionStore(this.source, pipeFn);
  }

  useStore(useFn: UseActionStoreFunction<T, O>): Subscription {
    return useActionStore(this.source, useFn);
  }

  get state$(): Observable<ActionContextState<T, O>> {
    return this.pipeStore((x) => x.state$);
  }

  get idle$(): Observable<boolean> {
    return this.pipeStore((x) => x.idle$);
  }

  get triggered$(): Observable<boolean> {
    return this.pipeStore((x) => x.triggered$);
  }

  get valueReady$(): Observable<T> {
    return this.pipeStore((x) => x.valueReady$);
  }

  get success$(): Observable<Maybe<O>> {
    return this.pipeStore((x) => x.success$);
  }

  get successPair$(): Observable<DbxActionSuccessPair<T, O>> {
    return this.pipeStore((x) => x.successPair$);
  }

  get workProgress$(): Observable<Maybe<DbxActionWorkProgress>> {
    return this.pipeStore((x) => x.workProgress$);
  }

  get error$(): Observable<Maybe<ReadableError>> {
    return this.pipeStore((x) => x.error$);
  }

  get rejected$(): Observable<Maybe<ReadableError>> {
    return this.pipeStore((x) => x.rejected$);
  }

  get rejectedPair$(): Observable<DbxActionRejectedPair<T>> {
    return this.pipeStore((x) => x.rejectedPair$);
  }

  get isModified$(): Observable<boolean> {
    return this.pipeStore((x) => x.isModified$);
  }

  get canTrigger$(): Observable<boolean> {
    return this.pipeStore((x) => x.canTrigger$);
  }

  get isModifiedAndCanTriggerUpdates$(): Observable<boolean> {
    return this.pipeStore((x) => x.isModifiedAndCanTriggerUpdates$);
  }

  get isModifiedAndCanTrigger$(): Observable<boolean> {
    return this.pipeStore((x) => x.isModifiedAndCanTrigger$);
  }

  get actionState$(): Observable<DbxActionState> {
    return this.pipeStore((x) => x.actionState$);
  }

  get loadingState$(): Observable<LoadingState<O>> {
    return this.pipeStore((x) => x.loadingState$);
  }

  get loadingStateType$(): Observable<LoadingStateType> {
    return this.pipeStore((x) => x.loadingStateType$);
  }

  get isWorking$(): Observable<boolean> {
    return this.pipeStore((x) => x.isWorking$);
  }

  get workingOrWorkProgress$(): Observable<DbxActionWorkOrWorkProgress> {
    return this.pipeStore((x) => x.workOrWorkProgress$);
  }

  get isSuccess$(): Observable<boolean> {
    return this.pipeStore((x) => x.isSuccess$);
  }

  get disabledKeys$(): Observable<string[]> {
    return this.pipeStore((x) => x.disabledKeys$);
  }

  get isDisabled$(): Observable<boolean> {
    return this.pipeStore((x) => x.isDisabled$);
  }

  get errorCountSinceLastSuccess$(): Observable<number> {
    return this.pipeStore((x) => x.errorCountSinceLastSuccess$);
  }

  public enable(key?: DbxActionDisabledKey, enable = true): void {
    this.disable(key, !enable);
  }

  public disable(key?: DbxActionDisabledKey, disable = true): void {
    this.useStore((x) => (disable ? x.disable(key) : x.enable(key)));
  }

  public setIsSame(isSame?: boolean | Observable<boolean> | Observable<void>): void {
    this.useStore((x) => x.setIsSame(isSame));
  }

  public setIsModified(isModified?: boolean | Observable<boolean> | Observable<void>): void {
    this.useStore((x) => x.setIsModified(isModified));
  }

  public trigger(): void {
    this.useStore((x) => x.trigger());
  }

  public triggerWithValue(value: T | Observable<T>): void {
    this.useStore((x) => {
      x.trigger();
      x.readyValue(value);
    });
  }

  public readyValue(value: T | Observable<T>): void {
    this.useStore((x) => x.readyValue(value));
  }

  public startWorking(): void {
    this.useStore((x) => x.startWorking());
  }

  public reject(error: Maybe<ReadableError | Observable<ReadableError>>): void {
    this.useStore((x) => x.reject(error));
  }

  public resolve(value: O | Observable<O>): void {
    this.useStore((x) => x.resolve(value));
  }

  public reset(): void {
    this.useStore((x) => x.reset());
  }
}
