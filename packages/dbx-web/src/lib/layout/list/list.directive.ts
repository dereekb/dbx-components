import { type ListLoadingState, type ObservableOrValue, maybeValueFromObservableOrValue, type MaybeObservableOrValue } from '@dereekb/rxjs';
import { BehaviorSubject, map, shareReplay, combineLatest } from 'rxjs';
import { type OnDestroy, Directive, input, output, computed, type Signal, NgModule } from '@angular/core';
import { DbxListComponent, type DbxListConfig } from './list.component';
import { type DbxListSelectionMode, type DbxListView, type ListSelectionState } from './list.view';
import { type Configurable, type Maybe } from '@dereekb/util';
import { type DbxListViewWrapper } from './list.wrapper';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

// MARK: Wrapper
/**
 * Default HTML template for list wrapper components. Passes through state, config, and content projection slots to a child `dbx-list`.
 */
export const DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE = `
  <dbx-list [state]="currentState$" [config]="configSignal()" [hasMore]="hasMore()" [disabled]="disabled()" [selectionMode]="selectionModeSignal()">
    <ng-content top select="[top]"></ng-content>
    <ng-content bottom select="[bottom]"></ng-content>
    <ng-content empty select="[empty]"></ng-content>
    <ng-content emptyLoading select="[emptyLoading]"></ng-content>
    <ng-content end select="[end]"></ng-content>
  </dbx-list>`;

const dbxListWrapperComponentImportsAndExports = [DbxListComponent];

/**
 * Convenience module that imports and exports {@link DbxListComponent} for use in list wrapper component templates.
 */
@NgModule({
  exports: dbxListWrapperComponentImportsAndExports,
  imports: dbxListWrapperComponentImportsAndExports
})
export class DbxListWrapperComponentImportsModule {}

/**
 * Configuration type for list wrapper directives. Omits `onClick` and `loadMore` since the wrapper converts those to output events.
 */
export type DbxListWrapperConfig<T, V extends DbxListView<T> = DbxListView<T>> = Omit<DbxListConfig<T, V>, 'onClick' | 'loadMore'>;

/**
 * Abstract base directive for components that wrap a {@link DbxListComponent}. Manages state, config, selection mode,
 * and emits `clickItem` and `loadMore` output events. Extend this to build custom list wrapper components.
 */
@Directive()
export abstract class AbstractDbxListWrapperDirective<T, V extends DbxListView<T> = DbxListView<T>, C extends DbxListWrapperConfig<T, V> = DbxListWrapperConfig<T, V>, S extends ListLoadingState<T> = ListLoadingState<T>> implements OnDestroy, DbxListViewWrapper<T, S> {
  private readonly _config = new BehaviorSubject<MaybeObservableOrValue<C>>(undefined);
  private readonly _stateOverride = new BehaviorSubject<MaybeObservableOrValue<S>>(undefined);
  private readonly _selectionModeOverride = new BehaviorSubject<MaybeObservableOrValue<DbxListSelectionMode>>(undefined);

  private readonly _selectionModeOverrideSignal = toSignal(this._selectionModeOverride.pipe(maybeValueFromObservableOrValue()));

  readonly hasMore = input<Maybe<boolean>>(undefined);

  readonly clickItem = output<T>();
  readonly loadMore = output<void>();

  readonly disabled = input<Maybe<boolean>>();
  readonly selectionMode = input<Maybe<DbxListSelectionMode>>();
  readonly state = input<Maybe<ObservableOrValue<S>>>();

  readonly selectionModeSignal: Signal<Maybe<DbxListSelectionMode>> = computed(() => {
    return this._selectionModeOverrideSignal() ?? this.selectionMode();
  });

  readonly currentState$ = combineLatest([this._stateOverride, toObservable(this.state)]).pipe(
    map(([stateOverride, state]) => stateOverride ?? state),
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
/**
 * Configuration type for selection list wrappers. Further omits `onSelectionChange` since the wrapper emits it as an output event.
 */
export type DbxSelectionListWrapperConfig<T, V extends DbxListView<T> = DbxListView<T>> = Omit<DbxListWrapperConfig<T, V>, 'onSelectionChange'>;

/**
 * Abstract base directive for list wrappers that also support selection change events. Extends {@link AbstractDbxListWrapperDirective}
 * with a `selectionChange` output that emits whenever the user changes item selection.
 */
@Directive()
export abstract class AbstractDbxSelectionListWrapperDirective<T, V extends DbxListView<T> = DbxListView<T>, C extends DbxSelectionListWrapperConfig<T, V> = DbxSelectionListWrapperConfig<T, V>, S extends ListLoadingState<T> = ListLoadingState<T>> extends AbstractDbxListWrapperDirective<T, V, C, S> {
  readonly selectionChange = output<ListSelectionState<T>>();

  protected override _buildListConfig(config: C): DbxListConfig<T, V> {
    const result = super._buildListConfig(config) as Configurable<DbxListConfig<T, V>>;
    result.onSelectionChange = (x) => this.selectionChange.emit(x);
    return result;
  }
}
