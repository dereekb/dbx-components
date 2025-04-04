import { ListLoadingState, ObservableOrValue, maybeValueFromObservableOrValue, MaybeObservableOrValue } from '@dereekb/rxjs';
import { Observable, BehaviorSubject, map, shareReplay, combineLatest } from 'rxjs';
import { OnDestroy, Directive, Component, ChangeDetectionStrategy, input, output, computed, Signal } from '@angular/core';
import { DbxListComponent, DbxListConfig } from './list.component';
import { DbxListSelectionMode, DbxListView, ListSelectionState } from './list.view';
import { Configurable, type Maybe } from '@dereekb/util';
import { DbxListViewWrapper } from './list.wrapper';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

export const DEFAULT_STATIC_LIST_COMPONENT_CONFIGURATION: Pick<Component, 'template' | 'imports' | 'changeDetection'> = {
  template: `
  <dbx-list [config]="config">
    <ng-content top select="[top]"></ng-content>
    <ng-content bottom select="[bottom]"></ng-content>
    <ng-content empty select="[empty]"></ng-content>
    <ng-content emptyLoading select="[emptyLoading]"></ng-content>
  </dbx-list>
  `,
  imports: [DbxListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
};

// MARK: Wrapper
export const DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION: Pick<Component, 'template' | 'imports' | 'changeDetection'> = {
  template: `
  <dbx-list [config]="configSignal()" [disabled]="disabled()" [selectionMode]="selectionModeSignal()">
    <ng-content top select="[top]"></ng-content>
    <ng-content bottom select="[bottom]"></ng-content>
    <ng-content empty select="[empty]"></ng-content>
    <ng-content emptyLoading select="[emptyLoading]"></ng-content>
  </dbx-list>
  `,
  imports: [DbxListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
};

export type DbxListWrapperConfig<T, V extends DbxListView<T> = DbxListView<T>> = Omit<DbxListConfig<T, V>, 'onClick' | 'loadMore'>;

@Directive()
export abstract class AbstractDbxListWrapperDirective<T, V extends DbxListView<T> = DbxListView<T>, C extends DbxListWrapperConfig<T, V> = DbxListWrapperConfig<T, V>, S extends ListLoadingState<T> = ListLoadingState<T>> implements OnDestroy, DbxListViewWrapper<T, S> {
  private readonly _config = new BehaviorSubject<MaybeObservableOrValue<C>>(undefined);
  private readonly _stateOverride = new BehaviorSubject<MaybeObservableOrValue<S>>(undefined);
  private readonly _selectionModeOverride = new BehaviorSubject<MaybeObservableOrValue<DbxListSelectionMode>>(undefined);
  private readonly _selectionModeOverrideSignal = toSignal(this._selectionModeOverride.pipe(maybeValueFromObservableOrValue()));

  readonly clickItem = output<T>();
  readonly loadMore = output<void>();

  readonly disabled = input<Maybe<boolean>>();
  readonly selectionMode = input<Maybe<DbxListSelectionMode>>();
  readonly state = input<Maybe<ObservableOrValue<S>>>();

  /**
   * @deprecated use state as the input instead.
   */
  readonly deprecatedInputState$ = input<Maybe<Observable<S>>>(undefined, { alias: 'state$' });

  readonly selectionModeSignal: Signal<Maybe<DbxListSelectionMode>> = computed(() => {
    return this._selectionModeOverrideSignal() ?? this.selectionMode();
  });

  readonly currentState$ = combineLatest([this._stateOverride, toObservable(this.state), toObservable(this.deprecatedInputState$)]).pipe(
    map(([stateOverride, state, state$]) => stateOverride ?? state ?? state$),
    maybeValueFromObservableOrValue(),
    shareReplay(1)
  );

  readonly config$ = this._config.pipe(
    maybeValueFromObservableOrValue(),
    map((x: Maybe<C>) => (x ? this._buildListConfig(x) : undefined)),
    shareReplay(1)
  );

  readonly configSignal = toSignal(this.config$);

  constructor(initConfig: ObservableOrValue<C>) {
    this._config.next(initConfig);
  }

  ngOnDestroy(): void {
    this._config.complete();
    this._stateOverride.complete();
    this._selectionModeOverride.complete();
  }

  setState(stateObs: MaybeObservableOrValue<S>): void {
    this._stateOverride.next(stateObs);
  }

  setSelectionMode(selectionMode: MaybeObservableOrValue<DbxListSelectionMode>): void {
    this._selectionModeOverride.next(selectionMode);
  }

  protected _buildListConfig(config: C): DbxListConfig<T, V> {
    return {
      ...config,
      onClick: (x) => this.clickItem.emit(x),
      loadMore: () => this.loadMore.emit()
    };
  }
}

// MARK: Selection Wrapper
export type DbxSelectionListWrapperConfig<T, V extends DbxListView<T> = DbxListView<T>> = Omit<DbxListWrapperConfig<T, V>, 'onSelectionChange'>;

@Directive()
export abstract class AbstractDbxSelectionListWrapperDirective<T, V extends DbxListView<T> = DbxListView<T>, C extends DbxSelectionListWrapperConfig<T, V> = DbxSelectionListWrapperConfig<T, V>, S extends ListLoadingState<T> = ListLoadingState<T>> extends AbstractDbxListWrapperDirective<T, V, C, S> {
  readonly selectionChange = output<ListSelectionState<T>>();

  protected override _buildListConfig(config: C): DbxListConfig<T, V> {
    const result = super._buildListConfig(config) as Configurable<DbxListConfig<T, V>>;
    result.onSelectionChange = (x) => this.selectionChange.emit(x);
    return result;
  }
}

// MARK: COMPAT
/**
 * @deprecated update components to use DEFAULT_STATIC_LIST_COMPONENT_CONFIGURATION instead of just referencing only the template.
 */
export const DEFAULT_STATIC_LIST_DIRECTIVE_TEMPLATE = DEFAULT_STATIC_LIST_COMPONENT_CONFIGURATION.template;

/**
 * @deprecated update components to use DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION instead of just referencing only the template.
 */
export const DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE = DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION.template;
