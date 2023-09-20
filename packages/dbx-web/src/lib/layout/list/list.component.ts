import { catchError, filter, exhaustMap, merge, map, Subject, switchMap, shareReplay, distinctUntilChanged, of, Observable, BehaviorSubject, first, combineLatest } from 'rxjs';
import { Component, Input, EventEmitter, Output, OnDestroy, ElementRef, HostListener, ChangeDetectorRef, Directive } from '@angular/core';
import { DbxInjectionComponentConfig, tapDetectChanges } from '@dereekb/dbx-core';
import { SubscriptionObject, ListLoadingStateContextInstance, ListLoadingState, filterMaybe, loadingStateHasFinishedLoading, startWithBeginLoading, loadingStateHasValue } from '@dereekb/rxjs';
import { Maybe, Milliseconds } from '@dereekb/util';
import { DbxListSelectionMode, DbxListView, ListSelectionState } from './list.view';

/**
 * Direction the scroll was triggered moving.
 */
export type DbxListScrollDirectionTrigger = 'up' | 'down';

/**
 * Used to trigger the loading of additional items.
 *
 * If an observable is returned it is used to throttle the loading of more items until it returns.
 */
export type DbxListLoadMoreHandler = () => Observable<void> | void;

/**
 * DbxListComponent configuration.
 */
export interface DbxListConfig<T = unknown, V extends DbxListView<T> = DbxListView<T>> extends DbxInjectionComponentConfig<V> {
  /**
   * Whether or not to hide the list content when it is an empty list.
   */
  hideOnEmpty?: boolean;

  /**
   * Whether or not this list should scroll upward from the bottom, like a message list.
   */
  invertedList?: boolean;

  /**
   * Distance to scroll.
   */
  scrollDistance?: number;

  /**
   * Number of ms to throttle scrolling events.
   */
  throttle?: Milliseconds;

  /**
   * (Optional) onClick handler
   */
  onClick?: (value: T) => void;

  /**
   * (Optional) onSelection handler
   */
  onSelectionChange?: (selection: ListSelectionState<T>) => void;

  /**
   * (Optional) handler function to load more items.
   */
  loadMore?: DbxListLoadMoreHandler;

  /**
   * Default selection list value. If not defined, will default to 'view'.
   */
  defaultSelectionMode?: Maybe<DbxListSelectionMode>;
}

/**
 * Used to display a potentially infinitely scrollable list of content.
 *
 * This component is generally wrapped by another component that provides this one configuration.
 */
@Component({
  selector: 'dbx-list',
  templateUrl: './list.component.html',
  host: {
    class: 'd-block dbx-list',
    '[class.dbx-list-padded]': 'padded'
  }
})
export class DbxListComponent<T = unknown, V extends DbxListView<T> = DbxListView<T>, S extends ListLoadingState<T> = ListLoadingState<T>> implements OnDestroy {
  readonly DEFAULT_SCROLL_DISTANCE = 1.5;
  readonly DEFAULT_THROTTLE_SCROLL = 50;

  /**
   * Whether or not to add bottom padding to the list content.
   */
  @Input()
  padded = true;

  @Output()
  contentScrolled = new EventEmitter<number>();

  private _content: Maybe<DbxListInternalContentDirective>;
  private _disabled = new BehaviorSubject<boolean>(false);
  private _selectionMode = new BehaviorSubject<Maybe<DbxListSelectionMode>>(undefined);

  private _loadMoreTrigger = new Subject<void>();
  private _scrollTrigger = new Subject<DbxListScrollDirectionTrigger>();
  private _config = new BehaviorSubject<Maybe<DbxListConfig<T, V>>>(undefined);

  private _loadMoreSub = new SubscriptionObject();
  private _onClickSub = new SubscriptionObject();
  private _disabledSub = new SubscriptionObject();
  private _selectionModeSub = new SubscriptionObject();
  private _onSelectionChangeSub = new SubscriptionObject();

  readonly context = new ListLoadingStateContextInstance<T, S>({ showLoadingOnNoValue: false });
  readonly isEmpty$ = this.context.isEmpty$;
  readonly isEmptyLoading$ = this.context.isEmptyLoading$;
  readonly isEmptyAndNotLoading$ = this.context.isEmptyAndNotLoading$;
  readonly disabled$ = this._disabled.asObservable();
  readonly selectionMode$ = this._selectionMode.asObservable();

  readonly hideOnEmpty$: Observable<boolean> = this._config.pipe(
    filterMaybe(),
    map((x) => Boolean(x.hideOnEmpty)),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly invertedList$: Observable<boolean> = this._config.pipe(
    filterMaybe(),
    map((x) => Boolean(x?.throttle)),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly throttleScroll$: Observable<number> = this._config.pipe(
    map((x) => x?.throttle ?? this.DEFAULT_THROTTLE_SCROLL),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly scrollDistance$: Observable<number> = this._config.pipe(
    map((x) => x?.scrollDistance ?? this.DEFAULT_SCROLL_DISTANCE),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly scrollLoadMoreTrigger$ = this._config.pipe(
    switchMap((config) => {
      const loadNextDirection = config?.invertedList ? 'up' : 'down';
      return this._scrollTrigger.pipe(filter((x) => x === loadNextDirection));
    })
  );

  readonly loadMore$ = merge(this.scrollLoadMoreTrigger$, this._loadMoreTrigger);

  readonly injectedComponentConfig$: Observable<Maybe<DbxInjectionComponentConfig<V>>> = this._config.pipe(
    distinctUntilChanged(),
    map((config) => {
      let injectedComponentConfig: Maybe<DbxInjectionComponentConfig<V>>;

      if (config) {
        const { componentClass, init, onClick, onSelectionChange, loadMore, defaultSelectionMode = 'view' } = config;

        injectedComponentConfig = {
          componentClass: config.componentClass,
          injector: config.injector,
          init: (instance: V) => {
            // Synchronize disabled
            this._disabledSub.subscription = this.disabled$.subscribe((disabled) => instance.setDisabled(disabled));
            this._selectionModeSub.subscription = this.selectionMode$.subscribe((selectionMode) => instance.setSelectionMode(selectionMode ?? defaultSelectionMode));

            if (init) {
              init(instance);
            }

            instance.setListContext(this.context);

            if (loadMore) {
              this._loadMoreSub.subscription = this.loadMore$
                .pipe(
                  // Throttle additional loading calls using exhaustMap until observable returns, if one is returned.
                  exhaustMap(() => {
                    const result = loadMore();
                    let obs: Observable<void>;

                    if (result) {
                      obs = result.pipe(catchError(() => of()));
                    } else {
                      obs = of();
                    }

                    return obs;
                  })
                )
                .subscribe();
            }

            if (onClick) {
              if (instance.clickValue) {
                this._onClickSub.subscription = instance.clickValue.subscribe(onClick);
              } else {
                console.error(`onClick() was passed to listConfig, but target class ${componentClass} has no clicked event emitter.`);
              }
            }

            if (onSelectionChange) {
              if (instance.selectionChange) {
                this._onSelectionChangeSub.subscription = instance.selectionChange.subscribe(onSelectionChange);
              } else {
                console.error(`onSelectionChange() was passed to listConfig, but target class ${componentClass} has no selectionChange event emitter.`);
              }
            }
          }
        };
      }

      return injectedComponentConfig;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly hideContent$: Observable<boolean> = this.context.stateChange$.pipe(
    switchMap(() =>
      this.context.state$.pipe(
        filter((x) => loadingStateHasFinishedLoading(x)),
        first(),
        startWithBeginLoading()
      )
    ),
    switchMap((state) => {
      if (state?.loading) {
        return of(true);
      } else {
        return this.hideOnEmpty$.pipe(
          switchMap((hide) => (hide === false ? of(false) : this.isEmpty$)),
          distinctUntilChanged(),
          tapDetectChanges(this.cdRef),
          shareReplay(1)
        );
      }
    })
  );

  constructor(readonly cdRef: ChangeDetectorRef) {}

  ngOnDestroy(): void {
    delete this._content; // remove parent-child relation.
    this._scrollTrigger.complete();
    this._loadMoreTrigger.complete();
    this._config.complete();
    this._disabled.complete();
    this._selectionMode.complete();

    this._onClickSub.destroy();
    this._loadMoreSub.destroy();
    this._onSelectionChangeSub.destroy();
    this._disabledSub.destroy();

    this.context.destroy();
  }

  @Input()
  get state$(): Observable<S> {
    return this.context.state$;
  }

  set state$(state$: Maybe<Observable<S>>) {
    this.context.setStateObs(state$);
  }

  @Input()
  set config(config: Maybe<DbxListConfig<T, V>>) {
    this._config.next(config);
  }

  @Input()
  get disabled(): boolean {
    return this._disabled.value;
  }

  set disabled(disabled: Maybe<boolean>) {
    this._disabled.next(disabled ?? false);
  }

  @Input()
  get selectionMode(): Maybe<DbxListSelectionMode> {
    return this._selectionMode.value;
  }

  set selectionMode(selectionMode: Maybe<DbxListSelectionMode>) {
    this._selectionMode.next(selectionMode);
  }

  getScrollPositionRelativeToBottom(): number {
    try {
      const element = this.nativeElement;

      // At max scroll, scrollHeight = scrollTop + clientHeight;
      const { scrollTop, scrollHeight, clientHeight } = element;
      return scrollHeight - (scrollTop + clientHeight);
    } catch (e) {
      return 0;
    }
  }

  jumpToBottom(): void {
    try {
      this.nativeElement.scrollTop = this.nativeElement.scrollHeight;
    } catch (err) {
      // do nothing.
    }
  }

  jumpToPositionRelativeToBottom(pos: number): void {
    try {
      const element = this.nativeElement;
      const { scrollHeight, clientHeight } = element;
      element.scrollTop = scrollHeight - (clientHeight + pos);
    } catch (err) {
      // do nothing.
    }
  }

  onScrollDown(): void {
    this._scrollTrigger.next('down');
  }

  onScrollUp(): void {
    this._scrollTrigger.next('up');
  }

  loadMore(): void {
    this._loadMoreTrigger.next();
  }

  // MARK: Internal
  get nativeElement() {
    return this.__content.elementRef.nativeElement;
  }

  get __content(): DbxListInternalContentDirective {
    return this._content as DbxListInternalContentDirective;
  }

  set __content(content: DbxListInternalContentDirective) {
    if (this._content == null) {
      this._content = content;
    } else {
      throw new Error('Attempted to set __content in list outside of initialization.');
    }
  }
}

/**
 * Used internally by DbxListComponent
 */
@Directive({
  selector: '[dbxListInternalContent]',
  host: {
    class: 'd-block dbx-list-content',
    '[class.dbx-list-content-hidden]': 'hide'
  }
})
export class DbxListInternalContentDirective {
  @Input()
  hide: Maybe<boolean> = false;

  constructor(private readonly parent: DbxListComponent, readonly elementRef: ElementRef) {
    this.parent.__content = this;
  }

  @HostListener('scroll', ['$event'])
  onScrollEvent($event: Event): void {
    const position = ($event.target as Element).scrollTop;
    this.parent.contentScrolled.emit(position);
  }
}
