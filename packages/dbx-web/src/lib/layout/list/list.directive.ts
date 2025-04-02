import { ListLoadingState, filterMaybe, ObservableOrValue, valueFromObservableOrValue, ObservableOrValueGetter, valueFromObservableOrValueGetter, maybeValueFromObservableOrValueGetter, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { Observable, BehaviorSubject, map, shareReplay, combineLatest } from 'rxjs';
import { Output, EventEmitter, OnDestroy, Directive, Input, Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { DbxListComponent, DbxListConfig } from './list.component';
import { DbxListSelectionMode, DbxListView, ListSelectionState } from './list.view';
import { Configurable, type Maybe } from '@dereekb/util';
import { DbxListViewWrapper } from './list.wrapper';
import { toObservable } from '@angular/core/rxjs-interop';

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
  <dbx-list [state$]="state$" [config]="config$ | async" [disabled]="disabled" [selectionMode]="selectionMode">
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
  private readonly _initialConfig = new BehaviorSubject<Maybe<ObservableOrValue<C>>>(undefined);
  private readonly _stateOverride = new BehaviorSubject<Maybe<ObservableOrValue<S>>>(undefined);

  readonly clickItem = output<T>();
  readonly loadMore = output<void>();

  readonly disabled = input<Maybe<boolean>>();
  readonly selectionMode = input<Maybe<DbxListSelectionMode>>();
  readonly state = input<Maybe<ObservableOrValue<S>>>();

  /**
   * @deprecated use state as the input instead.
   */
  readonly state$ = input<Maybe<Observable<S>>>();

  readonly currentState$ = combineLatest([this._stateOverride, toObservable(this.state), toObservable(this.state$)]).pipe(
    map(([stateOverride, state, state$]) => stateOverride ?? state ?? state$),
    maybeValueFromObservableOrValue(),
    shareReplay(1)
  );

  readonly config$ = this._initialConfig.pipe(
    filterMaybe(),
    valueFromObservableOrValue(),
    map((x: C) => this._buildListConfig(x)),
    shareReplay(1)
  );

  constructor(initConfig: ObservableOrValue<C>) {
    this._initialConfig.next(initConfig);
  }

  ngOnDestroy(): void {
    this._initialConfig.complete();
  }

  setStateObs(stateObs: Maybe<Observable<S>>): void {
    this._stateOverride.next(stateObs);
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
export abstract class AbstractDbxSelectionListWrapperDirective<T, V extends DbxListView<T> = DbxListView<T>, C extends DbxSelectionListWrapperConfig<T, V> = DbxSelectionListWrapperConfig<T, V>, S extends ListLoadingState<T> = ListLoadingState<T>> extends AbstractDbxListWrapperDirective<T, V, C, S> implements OnDestroy {
  @Output()
  selectionChange = new EventEmitter<ListSelectionState<T>>();

  override ngOnDestroy(): void {
    this.selectionChange.complete();
  }

  protected override _buildListConfig(config: C): DbxListConfig<T, V> {
    const result = super._buildListConfig(config) as Configurable<DbxListConfig<T, V>>;
    result.onSelectionChange = (x) => this.selectionChange.next(x);
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
