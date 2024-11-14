import { ListLoadingState, filterMaybe, ObservableOrValue, valueFromObservableOrValue } from '@dereekb/rxjs';
import { Observable, BehaviorSubject, map, shareReplay } from 'rxjs';
import { Output, EventEmitter, OnDestroy, Directive, Input } from '@angular/core';
import { DbxListConfig } from './list.component';
import { DbxListSelectionMode, DbxListView, ListSelectionState } from './list.view';
import { Maybe } from '@dereekb/util';
import { DbxListViewWrapper } from './list.wrapper';

export const DEFAULT_STATIC_LIST_DIRECTIVE_TEMPLATE = `
<dbx-list [config]="config">
  <ng-content top select="[top]"></ng-content>
  <ng-content bottom select="[bottom]"></ng-content>
  <ng-content empty select="[empty]"></ng-content>
  <ng-content emptyLoading select="[emptyLoading]"></ng-content>
</dbx-list>
`;

// MARK: Wrapper
export const DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE = `
<dbx-list [state$]="state$" [config]="config$ | async" [disabled]="disabled" [selectionMode]="selectionMode">
  <ng-content top select="[top]"></ng-content>
  <ng-content bottom select="[bottom]"></ng-content>
  <ng-content empty select="[empty]"></ng-content>
  <ng-content emptyLoading select="[emptyLoading]"></ng-content>
</dbx-list>
`;

export type DbxListWrapperConfig<T, V extends DbxListView<T> = DbxListView<T>> = Omit<DbxListConfig<T, V>, 'onClick' | 'loadMore'>;

@Directive()
export abstract class AbstractDbxListWrapperDirective<T, V extends DbxListView<T> = DbxListView<T>, C extends DbxListWrapperConfig<T, V> = DbxListWrapperConfig<T, V>, S extends ListLoadingState<T> = ListLoadingState<T>> implements OnDestroy, DbxListViewWrapper<T, S> {
  private readonly _initialConfig = new BehaviorSubject<Maybe<ObservableOrValue<C>>>(undefined);

  readonly config$ = this._initialConfig.pipe(
    filterMaybe(),
    valueFromObservableOrValue(),
    map((x: C) => this._buildListConfig(x)),
    shareReplay(1)
  );

  @Input()
  disabled?: Maybe<boolean>;

  @Input()
  selectionMode?: Maybe<DbxListSelectionMode>;

  @Input()
  state$?: Maybe<Observable<S>>;

  @Output()
  readonly clickItem = new EventEmitter<T>();

  @Output()
  readonly loadMore = new EventEmitter<void>();

  constructor(initConfig: ObservableOrValue<C>) {
    this._initialConfig.next(initConfig);
  }

  ngOnDestroy(): void {
    this._initialConfig.complete();
    this.clickItem.complete();
    this.loadMore.complete();
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
    const result = super._buildListConfig(config);
    result.onSelectionChange = (x) => this.selectionChange.next(x);
    return result;
  }
}
