import { catchError } from 'rxjs/operators';
import { exhaustMap } from 'rxjs';
import { Component, ComponentFactoryResolver, Input, Type, ViewChild, ViewContainerRef, EventEmitter, Output, OnDestroy, OnInit, ElementRef, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DbxInjectedComponentConfig, tapDetectChanges } from '@dereekb/dbx-core';
import { SubscriptionObject, ListLoadingStateContext } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { map, Subject, BehaviorSubject, switchMap, shareReplay, distinctUntilChanged, of } from 'rxjs';
import { Observable } from 'rxjs';
import { ListSelectionState } from './list.selection';

/**
 * Interface for list components that render a list of models.
 */
export interface DbxListContentComponent<T> {
  /**
   * Models observable.
   */
  readonly models$: Observable<T[]>;
  /**
   * Optional clicked event emitter.
   */
  clicked?: EventEmitter<T>;
  /**
   * Optional selection changed event emitter.
   */
  selectionChange?: EventEmitter<ListSelectionState<T>>;
  /**
   * Sets the models input source.
   */
  setModels$(models$: Observable<T[]>): void;
}

/**
 * Used to trigger the loading of additional items.
 * 
 * If an observable is returned it is used to throttle the loading of more items until it returns.
 */
export type DbxListLoadMoreHandler = () => Observable<void> | void;

/**
 * DbxListComponent configuration.
 */
export interface DbxListConfig<T, L extends DbxListContentComponent<T> = DbxListContentComponent<T>> extends DbxInjectedComponentConfig<L> {
  /**
   * (Optional) onClick handler
   */
  onClick?: (model: T) => void;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'dbx-list',
    '[class.dbx-list-padded]': 'padded'
  }
})
export class DbxListComponent<T = any, L extends DbxListContentComponent<T> = DbxListContentComponent<T>> implements OnDestroy {

  /**
   * Whether or not this list should scroll upward from the bottom.
   */
  @Input()
  invertedList = false;

  /**
   * Distance to scroll.
   */
  @Input()
  scrollDistance = 1.5;

  /**
   * Number of ms to throttle scrolling events.
   */
  @Input()
  throttle = 50;

  /**
   * Whether or not to hide the list content when it is an empty list.
   */
  @Input()
  hideOnEmpty: boolean = true;

  /**
   * Whether or not to add bottom padding to the list content.
   */
  @Input()
  padded: boolean = true;

  @Output()
  loadMore = new EventEmitter<void>();

  @Output()
  scrollAny = new EventEmitter<number>();

  private _content!: DbxListInternalViewComponent;
  private _config = new Subject<Maybe<DbxListConfig<T, L>>>();
  private _hideOnEmpty = new BehaviorSubject<boolean>(false);

  readonly context = new ListLoadingStateContext({ showLoadingOnNoModel: false });
  readonly models$: Observable<T[]> = this.context.models$;
  readonly isEmpty$ = this.context.isEmpty$;

  private _loadMoreSub = new SubscriptionObject();
  private _onClickSub = new SubscriptionObject();
  private _onSelectionChangeSub = new SubscriptionObject();

  readonly injectedComponentConfig$: Observable<Maybe<DbxInjectedComponentConfig<L>>> = this._config.pipe(
    distinctUntilChanged(),
    map((config) => {
      let injectedComponentConfig: Maybe<DbxInjectedComponentConfig<L>>;

      if (config) {
        const { componentClass, init, onClick, onSelectionChange, loadMore } = config;

        injectedComponentConfig = {
          componentClass: config.componentClass,
          injector: config.injector,
          init: (instance: L) => {

            if (init) {
              init(instance);
            }

            if (loadMore) {
              this._loadMoreSub.subscription = this.loadMore.pipe(
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
              if (instance.clicked) {
                this._onClickSub.subscription = instance.clicked.subscribe(onClick);
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
    shareReplay(1)
  );

  readonly hideContent$ = this._hideOnEmpty.pipe(
    switchMap((hide) => (hide) ? this.isEmpty$ : of(false)),
    distinctUntilChanged(),
    tapDetectChanges(this.cdRef),
    shareReplay(1)
  );

  constructor(readonly cdRef: ChangeDetectorRef) { }

  @Input()
  set config(config: DbxListConfig<T, L>) {
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

  ngOnDestroy(): void {
    delete (this as any)._content;  // remove parent-child relation.
    this._onClickSub.destroy();
    this._loadMoreSub.destroy();
    this._onSelectionChangeSub.destroy();
  }

  onScrollDown(): void {
    // console.log('On scrolled down.');
    if (!this.invertedList) {
      this.loadMore.emit();
    }
  }

  onScrollUp(): void {
    // console.log('On scrolled up.');
    if (this.invertedList) {
      this.loadMore.emit();
    }
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
    'class': 'dbx-list-view'
  }
})
export class DbxListInternalViewComponent {

  constructor(private readonly parent: DbxListComponent, readonly elementRef: ElementRef) {
    this.parent.__content = this;
  }

  @HostListener('scroll', ['$event'])
  onScrollEvent($event: any): void {
    const position = $event.target.scrollTop;
    this.parent.scrollAny.emit(position);
  }

}
