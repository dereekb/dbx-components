import { first, switchMap, type Observable, type Subscription } from 'rxjs';
import { LockSet, filterMaybe, type LoadingState, type LoadingStateType, type MaybeObservableOrValue } from '@dereekb/rxjs';
import { type Destroyable, type Maybe, type ReadableError } from '@dereekb/util';
import { type ActionContextState, type ActionContextStore } from './action.store';
import { type DbxActionDisabledKey, type DbxActionRejectedPair, type DbxActionState, type DbxActionSuccessPair, type DbxActionWorkOrWorkProgress, type DbxActionWorkProgress } from './action';

/**
 * Abstract source that provides an observable of an {@link ActionContextStore}.
 *
 * This is the primary injection token used by action directives to access the action state.
 * Implementations are typically provided via Angular's DI, either by {@link DbxActionDirective}
 * or through secondary source providers.
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link DbxActionDirective} for the directive that provides this source.
 * @see {@link SecondaryActionContextStoreSource} for nested action source forwarding.
 */
export abstract class ActionContextStoreSource<T = unknown, O = unknown> {
  /**
   * Observable referencing the {@link ActionContextStore}.
   *
   * This observable is pre-filtered to never emit null values.
   */
  abstract readonly store$: Observable<ActionContextStore<T, O>>;
}

/**
 * Secondary action context store source used for nested or forwarded action contexts.
 *
 * When a {@link DbxActionDirective} is created, it checks for the presence of this secondary
 * source via host injection. If found, the directive reuses the existing store rather than
 * creating its own, enabling action context sharing across component boundaries.
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link DbxActionSourceDirective} for the directive that provides this.
 */
export abstract class SecondaryActionContextStoreSource<T = unknown, O = unknown> extends ActionContextStoreSource<T, O> {}

/**
 * Filters null/undefined values from an observable of {@link ActionContextStore} instances.
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 * @param obs - The observable that may emit null/undefined store values.
 * @returns An observable that only emits non-null store instances.
 */
export function actionContextStoreSourcePipe<T, O>(obs: Observable<Maybe<ActionContextStore<T, O>>>): Observable<ActionContextStore<T, O>> {
  return obs.pipe(filterMaybe());
}

/**
 * Function that receives an {@link ActionContextStore} and returns an observable derived from it.
 *
 * @typeParam R - The return type of the derived observable.
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 */
export type PipeActionStoreFunction<R, T, O> = (store: ActionContextStore<T, O>) => Observable<R>;

/**
 * Pipes a function through the action store from the given source.
 *
 * Subscribes to the source's store observable and applies the provided function
 * via switchMap, automatically switching to the latest store.
 *
 * @typeParam R - The return type of the derived observable.
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 * @param source - The action context store source to read from.
 * @param pipeFn - The function to apply to each emitted store.
 * @returns An observable of the derived value.
 */
export function pipeActionStore<R = unknown, T = unknown, O = unknown>(source: ActionContextStoreSource<T, O>, pipeFn: PipeActionStoreFunction<R, T, O>): Observable<R> {
  return source.store$.pipe(switchMap(pipeFn));
}

/**
 * Function that receives an {@link ActionContextStore} for imperative use (e.g., triggering state changes).
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 */
export type UseActionStoreFunction<T, O> = (store: ActionContextStore<T, O>) => void;

/**
 * Subscribes to the source once and invokes the provided function with the store.
 *
 * This is a convenience for performing one-shot imperative operations on the store,
 * such as triggering an action or setting a value, without maintaining a long-lived subscription.
 *
 * @typeParam T - The input value type.
 * @typeParam O - The output result type.
 * @param source - The action context store source to read from.
 * @param useFn - The function to invoke with the store.
 * @returns The subscription (completes after first emission).
 */
export function useActionStore<T = unknown, O = unknown>(source: ActionContextStoreSource<T, O>, useFn: UseActionStoreFunction<T, O>): Subscription {
  return source.store$.pipe(first()).subscribe(useFn);
}

/**
 * Convenience wrapper around an {@link ActionContextStoreSource} that provides direct
 * access to all the store's reactive selectors and imperative state-change methods.
 *
 * This class is the primary interface injected by action directives to interact with
 * the action lifecycle. It delegates all operations through the underlying source's
 * store observable, while also maintaining a {@link LockSet} for cleanup coordination.
 *
 * All reactive properties (e.g., `isWorking$`, `success$`, `error$`) are piped through
 * the source's `store$` via switchMap, so they automatically follow store changes.
 *
 * @typeParam T - The input value type for the action.
 * @typeParam O - The output result type for the action.
 *
 * @see {@link ActionContextStore} for the underlying store.
 * @see {@link ActionContextStoreSource} for the source abstraction.
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

  get isWorkingOrWorkProgress$(): Observable<DbxActionWorkOrWorkProgress> {
    return this.pipeStore((x) => x.isWorkingOrWorkProgress$);
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

  public setWorkProgress(workProgress: MaybeObservableOrValue<DbxActionWorkProgress>): void {
    this.useStore((x) => x.setWorkProgress(workProgress));
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
