import { catchError, filter, exhaustMap, merge, map, Subject, switchMap, shareReplay, distinctUntilChanged, of, Observable, BehaviorSubject } from 'rxjs';
import { Component, Input, EventEmitter, Output, OnDestroy, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { DbxInjectedComponentConfig, tapDetectChanges } from '@dereekb/dbx-core';
import { SubscriptionObject, ListLoadingStateContextInstance, ListLoadingState, filterMaybe, tapLog } from '@dereekb/rxjs';
import { Maybe, Milliseconds } from '@dereekb/util';
import { DbxListView, ListSelectionState } from './list.view';

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
export interface DbxListConfig<T = any, V extends DbxListView<T> = DbxListView<T>> extends DbxInjectedComponentConfig<V> {

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
    'class': 'd-block dbx-list',
    '[class.dbx-list-padded]': 'padded'
  }
})
export class DbxListComponent<T = any, V extends DbxListView<T> = DbxListView<T>, S extends ListLoadingState<T> = ListLoadingState<T>> implements OnDestroy {

  readonly DEFAULT_SCROLL_DISTANCE = 1.5;
  readonly DEFAULT_THROTTLE_SCROLL = 50;

  /**
   * Whether or not to add bottom padding to the list content.
   */
  @Input()
  padded: boolean = true;

  @Output()
  contentScrolled = new EventEmitter<number>();

  private _content!: DbxListInternalViewComponent;

  private _loadMoreTrigger = new Subject<void>();
  private _scrollTrigger = new Subject<DbxListScrollDirectionTrigger>();
  private _config = new BehaviorSubject<Maybe<DbxListConfig<T, V>>>(undefined);

  private _loadMoreSub = new SubscriptionObject();
  private _onClickSub = new SubscriptionObject();
  private _onSelectionChangeSub = new SubscriptionObject();

  readonly context = new ListLoadingStateContextInstance<T, S>({ showLoadingOnNoValue: false });
  readonly isEmpty$ = this.context.isEmpty$;

  readonly hideOnEmpty$: Observable<boolean> = this._config.pipe(filterMaybe(), map(x => Boolean(x.hideOnEmpty)), distinctUntilChanged(), shareReplay(1));
  readonly invertedList$: Observable<boolean> = this._config.pipe(filterMaybe(), map(x => Boolean(x?.throttle)), distinctUntilChanged(), shareReplay(1));
  readonly throttleScroll$: Observable<number> = this._config.pipe(map(x => (x?.throttle) ?? this.DEFAULT_THROTTLE_SCROLL), distinctUntilChanged(), shareReplay(1));
  readonly scrollDistance$: Observable<number> = this._config.pipe(map(x => (x?.scrollDistance) ?? this.DEFAULT_SCROLL_DISTANCE), distinctUntilChanged(), shareReplay(1));

  readonly scrollLoadMoreTrigger$ = this._config.pipe(
    switchMap((config) => {
      const loadNextDirection = config?.invertedList ? 'up' : 'down';
      return this._scrollTrigger.pipe(filter(x => x === loadNextDirection));
    })
  );

  readonly loadMore$ = merge(this.scrollLoadMoreTrigger$, this._loadMoreTrigger);

  readonly injectedComponentConfig$: Observable<Maybe<DbxInjectedComponentConfig<V>>> = this._config.pipe(
    distinctUntilChanged(),
    map((config) => {
      let injectedComponentConfig: Maybe<DbxInjectedComponentConfig<V>>;

      if (config) {
        const { componentClass, init, onClick, onSelectionChange, loadMore } = config;

        injectedComponentConfig = {
          componentClass: config.componentClass,
          injector: config.injector,
          init: (instance: V) => {

            if (init) {
              init(instance);
            }

            instance.setListContext(this.context);

            if (loadMore) {
              this._loadMoreSub.subscription = this.loadMore$.pipe(
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
              ).subscribe();
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

  readonly hideContent$ = this.hideOnEmpty$.pipe(
    switchMap((hide) => (hide) ? this.isEmpty$ : of(false)),
    distinctUntilChanged(),
    tapDetectChanges(this.cdRef),
    shareReplay(1)
  );

  constructor(readonly cdRef: ChangeDetectorRef) { }

  ngOnDestroy(): void {
    delete (this as any)._content;  // remove parent-child relation.
    this._scrollTrigger.complete();
    this._loadMoreTrigger.complete();
    this._config.complete();

    this._onClickSub.destroy();
    this._loadMoreSub.destroy();
    this._onSelectionChangeSub.destroy();

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
    } catch (err) { }
  }

  jumpToPositionRelativeToBottom(pos: number): void {
    try {
      const element = this.nativeElement;
      const { scrollHeight, clientHeight } = element;
      element.scrollTop = scrollHeight - (clientHeight + pos);
    } catch (err) { }
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
    return this._content.elementRef.nativeElement;
  }

  get __content(): DbxListInternalViewComponent {
    return this._content;
  }

  set __content(content: DbxListInternalViewComponent) {
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
@Component({
  selector: 'dbx-list-view',
  template: '<ng-content></ng-content>',
  host: {
    'class': 'd-block dbx-list-view'
  }
})
export class DbxListInternalViewComponent {

  constructor(private readonly parent: DbxListComponent, readonly elementRef: ElementRef) {
    this.parent.__content = this;
  }

  @HostListener('scroll', ['$event'])
  onScrollEvent($event: any): void {
    const position = $event.target.scrollTop;
    this.parent.contentScrolled.emit(position);
  }

}
