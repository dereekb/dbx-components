import { InfiniteScrollDirective } from 'ngx-infinite-scroll';
import { catchError, filter, exhaustMap, merge, map, Subject, switchMap, shareReplay, of, Observable, first, distinctUntilChanged } from 'rxjs';
import { Component, OnDestroy, ElementRef, HostListener, Directive, inject, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { SubscriptionObject, ListLoadingState, filterMaybe, isLoadingStateFinishedLoading, startWithBeginLoading, listLoadingStateContext } from '@dereekb/rxjs';
import { Maybe, Milliseconds } from '@dereekb/util';
import { DbxListSelectionMode, DbxListView, ListSelectionState } from './list.view';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxLoadingComponent } from '../../loading/loading.component';

// MARK: DbxListInternalContentDirective
/**
 * Used internally by DbxListComponent
 */
@Directive({
  selector: '[dbxListInternalContent]',
  host: {
    class: 'd-block dbx-list-content',
    '[class.dbx-list-content-hidden]': 'hide()'
  },
  standalone: true
})
export class DbxListInternalContentDirective {
  private readonly parent = inject(DbxListComponent);

  readonly elementRef = inject(ElementRef);

  readonly hide = input<Maybe<boolean>>(false);

  constructor() {
    this.parent.setInternalContent(this);
  }

  @HostListener('scroll', ['$event'])
  onScrollEvent($event: Event): void {
    const position = ($event.target as Element).scrollTop;
    this.parent.contentScrolled.emit(position);
  }
}

// MARK: DbxList
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
  readonly hideOnEmpty?: boolean;

  /**
   * Whether or not this list should scroll upward from the bottom, like a message list.
   */
  readonly invertedList?: boolean;

  /**
   * Distance to scroll.
   */
  readonly scrollDistance?: number;

  /**
   * Number of ms to throttle scrolling events.
   */
  readonly throttle?: Milliseconds;

  /**
   * (Optional) onClick handler
   */
  readonly onClick?: (value: T) => void;

  /**
   * (Optional) onSelection handler
   */
  readonly onSelectionChange?: (selection: ListSelectionState<T>) => void;

  /**
   * (Optional) handler function to load more items.
   */
  readonly loadMore?: DbxListLoadMoreHandler;

  /**
   * Default selection list value. If not defined, will default to 'view'.
   */
  readonly defaultSelectionMode?: Maybe<DbxListSelectionMode>;
}

export type DbxListComponentScrolledEventPosition = number;

export const DBX_LIST_DEFAULT_SCROLL_DISTANCE = 1.5;
export const DBX_LIST_DEFAULT_THROTTLE_SCROLL = 50;

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
    '[class.dbx-list-padded]': 'padded()'
  },
  standalone: true,
  imports: [DbxLoadingComponent, DbxInjectionComponent, InfiniteScrollDirective, DbxListInternalContentDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxListComponent<T = unknown, V extends DbxListView<T> = DbxListView<T>, S extends ListLoadingState<T> = ListLoadingState<T>> implements OnDestroy {
  /**
   * Emitted when content is scrolled.
   */
  readonly contentScrolled = output<DbxListComponentScrolledEventPosition>();

  /**
   * Whether or not to add bottom padding to the list content.
   */
  readonly padded = input<boolean>(true);

  readonly config = input<Maybe<DbxListConfig<T, V>>>(undefined);

  readonly disabled = input<Maybe<boolean>>(false);
  readonly selectionMode = input<Maybe<DbxListSelectionMode>>(undefined);

  private readonly _internalContentSignal = signal<Maybe<DbxListInternalContentDirective>>(undefined);
  readonly nativeElementSignal = computed(() => (this._internalContentSignal()?.elementRef as Maybe<ElementRef<HTMLElement>>)?.nativeElement);

  private readonly _loadMoreTrigger = new Subject<void>();
  private readonly _scrollTrigger = new Subject<DbxListScrollDirectionTrigger>();

  private readonly _loadMoreSub = new SubscriptionObject();
  private readonly _onClickSub = new SubscriptionObject();
  private readonly _disabledSub = new SubscriptionObject();
  private readonly _selectionModeSub = new SubscriptionObject();
  private readonly _onSelectionChangeSub = new SubscriptionObject();

  readonly context = listLoadingStateContext<T, S>({ showLoadingOnNoValue: false });

  readonly isEmpty$ = this.context.isEmpty$;
  readonly isEmptyLoading$ = this.context.isEmptyLoading$;
  readonly isEmptyAndNotLoading$ = this.context.isEmptyAndNotLoading$;

  readonly config$ = toObservable(this.config);
  readonly disabled$ = toObservable(this.disabled).pipe(
    map((x) => Boolean(x)),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly selectionMode$ = toObservable(this.selectionMode).pipe(distinctUntilChanged(), shareReplay(1));

  readonly hideOnEmpty$: Observable<boolean> = this.config$.pipe(
    filterMaybe(),
    map((x) => Boolean(x.hideOnEmpty)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly invertedList$: Observable<boolean> = this.config$.pipe(
    filterMaybe(),
    map((x) => Boolean(x?.throttle)),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly throttleScroll$: Observable<number> = this.config$.pipe(
    map((x) => x?.throttle ?? DBX_LIST_DEFAULT_THROTTLE_SCROLL),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly scrollDistance$: Observable<number> = this.config$.pipe(
    map((x) => x?.scrollDistance ?? DBX_LIST_DEFAULT_SCROLL_DISTANCE),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly scrollLoadMoreTrigger$ = this.config$.pipe(
    switchMap((config) => {
      const loadNextDirection = config?.invertedList ? 'up' : 'down';
      return this._scrollTrigger.pipe(filter((x) => x === loadNextDirection));
    })
  );

  readonly loadMore$ = merge(this.scrollLoadMoreTrigger$, this._loadMoreTrigger);

  readonly injectedComponentConfig$: Observable<Maybe<DbxInjectionComponentConfig<V>>> = this.config$.pipe(
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

  readonly hideContent$: Observable<boolean> = this.context.currentStateStream$.pipe(
    switchMap(() =>
      this.context.state$.pipe(
        filter((x) => isLoadingStateFinishedLoading(x)),
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
          shareReplay(1)
        );
      }
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly infiniteScrollDistanceSignal = toSignal(this.scrollDistance$, { initialValue: DBX_LIST_DEFAULT_SCROLL_DISTANCE });
  readonly infiniteScrollThrottleSignal = toSignal(this.throttleScroll$, { initialValue: DBX_LIST_DEFAULT_THROTTLE_SCROLL });
  readonly hideContentSignal = toSignal(this.hideContent$);
  readonly injectedComponentConfigSignal = toSignal(this.injectedComponentConfig$);
  readonly isEmptyAndNotLoadingSignal = toSignal(this.isEmptyAndNotLoading$);
  readonly isEmptyLoadingSignal = toSignal(this.isEmptyLoading$);

  ngOnDestroy(): void {
    this._scrollTrigger.complete();
    this._loadMoreTrigger.complete();

    this._onClickSub.destroy();
    this._loadMoreSub.destroy();
    this._onSelectionChangeSub.destroy();
    this._disabledSub.destroy();

    this.context.destroy();
  }

  getScrollPositionRelativeToBottom(): number {
    const element = this.nativeElementSignal();

    if (element) {
      try {
        // At max scroll, scrollHeight = scrollTop + clientHeight;
        const { scrollTop, scrollHeight, clientHeight } = element;
        return scrollHeight - (scrollTop + clientHeight);
      } catch (e) {}
    }

    return 0;
  }

  jumpToBottom(): void {
    const element = this.nativeElementSignal();

    if (element) {
      try {
        element.scrollTop = element.scrollHeight;
      } catch (err) {
        // do nothing.
      }
    }
  }

  jumpToPositionRelativeToBottom(pos: number): void {
    const element = this.nativeElementSignal();

    if (element) {
      try {
        const { scrollHeight, clientHeight } = element;
        element.scrollTop = scrollHeight - (clientHeight + pos);
      } catch (err) {
        // do nothing.
      }
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
  setInternalContent(content: DbxListInternalContentDirective) {
    if (this._internalContentSignal() == null) {
      this._internalContentSignal.set(content);
    } else {
      throw new Error('Attempted to set internal content in DbxListComponent when it was already set.');
    }
  }
}
