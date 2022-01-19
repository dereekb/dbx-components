import { first, switchMap } from 'rxjs/operators';
import { Observable, Subscription } from 'rxjs';
import { ActionContextState, ActionContextStore } from './action.store';
import { Directive, forwardRef, Provider, Type } from '@angular/core';
import { LockSet, filterMaybe } from '@dereekb/util-rxjs';
import { OnDestroy } from '@angular/core';
import { Maybe, ReadableError } from '@dereekb/util';
import { ActionDisabledKey, ActionState } from './action';

/**
 * Source that provides a ActionContextStore observable.
 */
export abstract class ActionContextStoreSource<T = any, O = any> {
  /**
   * Observable referencing the ActionContextStore.
   *
   * This observable by design is pre-filtered to not return null values.
   */
  abstract readonly store$: Observable<ActionContextStore<T, O>>;
}

/**
 * Secondary source. Used by DbNgxActionContextComponent to find secondary sources.
 */
export abstract class SecondaryActionContextStoreSource<T = any, O = any> extends ActionContextStoreSource<T, O> { }

export function actionContextStoreSourcePipe<T, O>(obs: Observable<Maybe<ActionContextStore<T, O>>>): Observable<ActionContextStore<T, O>> {
  return obs.pipe(filterMaybe());
}

export type PipeActionStoreFunction<R, T, O> = (store: ActionContextStore<T, O>) => Observable<R>;

export function pipeActionStore<R = any, T = any, O = any>(source: ActionContextStoreSource<T, O>, pipeFn: PipeActionStoreFunction<R, T, O>): Observable<R> {
  return source.store$.pipe(
    switchMap(pipeFn)
  );
}

export type UseActionStoreFunction<T, O> = (store: ActionContextStore<T, O>) => void;

/**
 * Convenience function for subscribing to the input source once and using the provided store.
 */
export function useActionStore<T = any, O = any>(source: ActionContextStoreSource<T, O>, useFn: UseActionStoreFunction<T, O>): Subscription {
  return source.store$.pipe(first()).subscribe(useFn);
}

@Directive()
// tslint:disable-next-line: directive-class-suffix
export class ActionContextStoreSourceInstance<T = any, O = any> implements OnDestroy {

  readonly lockSet = new LockSet();

  constructor(readonly source: ActionContextStoreSource<T, O>) {
    if (!source) {
      throw new Error('Source is required.');
    }
  }

  public ngOnDestroy(): void {
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
    return this.pipeStore(x => x.state$);
  }

  get triggered$(): Observable<boolean> {
    return this.pipeStore(x => x.triggered$);
  }

  get valueReady$(): Observable<T> {
    return this.pipeStore(x => x.valueReady$);
  }

  get success$(): Observable<O> {
    return this.pipeStore(x => x.success$);
  }

  get error$(): Observable<Maybe<ReadableError>> {
    return this.pipeStore(x => x.error$);
  }

  get rejected$(): Observable<Maybe<ReadableError>> {
    return this.pipeStore(x => x.rejected$);
  }

  get isModified$(): Observable<boolean> {
    return this.pipeStore(x => x.isModified$);
  }

  get isModifiedAndCanTriggerUpdates$(): Observable<boolean> {
    return this.pipeStore(x => x.isModifiedAndCanTriggerUpdates$);
  }

  get isModifiedAndCanTrigger$(): Observable<boolean> {
    return this.pipeStore(x => x.isModifiedAndCanTrigger$);
  }

  get actionState$(): Observable<ActionState> {
    return this.pipeStore(x => x.actionState$);
  }

  get isWorking$(): Observable<boolean> {
    return this.pipeStore(x => x.isWorking$);
  }

  get isSuccess$(): Observable<boolean> {
    return this.pipeStore(x => x.isSuccess$);
  }

  get isDisabled$(): Observable<boolean> {
    return this.pipeStore(x => x.isDisabled$);
  }

  get errorCountSinceLastSuccess$(): Observable<number> {
    return this.pipeStore(x => x.errorCountSinceLastSuccess$);
  }

  public enable(key?: ActionDisabledKey, enable = true): void {
    this.disable(key, !enable);
  }

  public disable(key?: ActionDisabledKey, disable = true): void {
    this.useStore((x) => (disable) ? x.disable(key) : x.enable(key));
  }

  public setIsModified(isModified?: boolean | Observable<boolean> | Observable<void>): void {
    this.useStore((x) => x.setIsModified(isModified));
  }

  public trigger(): void {
    this.useStore((x) => x.trigger());
  }

  public readyValue(value: Maybe<T | Observable<T>>): void {
    this.useStore((x) => x.readyValue(value));
  }

  public startWorking(): void {
    this.useStore((x) => x.startWorking());
  }

  public reject(error: Maybe<ReadableError | Observable<ReadableError>>): void {
    this.useStore((x) => x.reject(error));
  }

  public success(value: O | Observable<O>): void {
    this.useStore((x) => x.success(value));
  }

  public reset(): void {
    this.useStore((x) => x.reset());
  }

}

export const actionContextStoreSourceInstanceFactory = (source: ActionContextStoreSource) => {
  return new ActionContextStoreSourceInstance(source);
};

/**
 * Provides an ActionContextStoreSource, as well as an ActionContextStoreSourceInstance.
 */
export function ProvideActionStoreSource<S>(sourceType: Type<S>): Provider[] {
  return [{
    provide: ActionContextStoreSource,
    useExisting: forwardRef(() => sourceType)
  },
  {
    provide: ActionContextStoreSourceInstance,
    useFactory: actionContextStoreSourceInstanceFactory,
    deps: [ActionContextStoreSource]
  }];
}

export function ProvideSecondaryActionStoreSource<S>(sourceType: Type<S>): Provider[] {
  return [{
    provide: SecondaryActionContextStoreSource,
    useExisting: forwardRef(() => sourceType)
  },
  ...ProvideActionStoreSource(sourceType)
  ];
}
