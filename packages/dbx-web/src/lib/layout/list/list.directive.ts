import { ListLoadingState } from '@dereekb/rxjs';
import { switchMapMaybeObs, filterMaybe, ObservableGetter, getter } from '@dereekb/rxjs';
import { Observable, BehaviorSubject, map, shareReplay, isObservable, of, switchMap } from 'rxjs';
import { Output, EventEmitter, OnInit, OnDestroy, Directive, Type, Input } from "@angular/core";
import { DbxListConfig } from "./list.component";
import { DbxListView, ListSelectionState } from "./list.view";
import { Maybe } from '@dereekb/util';

export const DEFAULT_STATIC_LIST_DIRECTIVE_TEMPLATE = `
<dbx-list [config]="config">
  <ng-content top select="[top]"></ng-content>
  <ng-content bottom select="[bottom]"></ng-content>
  <ng-content empty select="[empty]"></ng-content>
</dbx-list>
`;

// MARK: Wrapper
export const DEFAULT_LIST_WRAPPER_DIRECTIVE_TEMPLATE = `
<dbx-list [state$]="state$" [config]="config$ | async">
  <ng-content top select="[top]"></ng-content>
  <ng-content bottom select="[bottom]"></ng-content>
  <ng-content empty select="[empty]"></ng-content>
</dbx-list>
`;

export interface DbxListWrapperConfig<T, V extends DbxListView<T> = DbxListView<T>> extends Omit<DbxListConfig<T, V>, 'onClick' | 'loadMore'> { }

@Directive()
export abstract class AbstractDbxListWrapperDirective<T, V extends DbxListView<T> = DbxListView<T>, C extends DbxListWrapperConfig<T, V> = DbxListWrapperConfig<T, V>, S extends ListLoadingState<T> = ListLoadingState<T>> implements OnInit, OnDestroy {

  private readonly _init = new BehaviorSubject<Maybe<ObservableGetter<C>>>(undefined);
  readonly config$ = this._init.pipe(
    filterMaybe(),
    getter(),
    map((x: C) => this._buildListConfig(x)),
    shareReplay(1));

  @Input()
  state$?: Maybe<Observable<S>>;

  @Output()
  clickItem = new EventEmitter<T>();

  @Output()
  loadMore = new EventEmitter<void>();

  constructor(readonly initConfig: ObservableGetter<C>) { }

  ngOnInit(): void {
    this._init.next(this.initConfig);
  }

  ngOnDestroy(): void {
    this._init.complete();
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
export interface DbxSelectionListWrapperConfig<T, V extends DbxListView<T> = DbxListView<T>> extends Omit<DbxListWrapperConfig<T, V>, 'onSelectionChange'> { }

@Directive()
export abstract class AbstractDbxSelectionListWrapperDirective<T, V extends DbxListView<T> = DbxListView<T>, C extends DbxSelectionListWrapperConfig<T, V> = DbxSelectionListWrapperConfig<T, V>, S extends ListLoadingState<T> = ListLoadingState<T>> extends AbstractDbxListWrapperDirective<T, V, C, S> {

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
