import { Component, ComponentFactoryResolver, Inject, Input, NgZone, Type, ViewChild, ViewContainerRef, OnInit, OnDestroy, ComponentRef } from '@angular/core';
import { HookMatchCriteria, TransitionService } from '@uirouter/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractTransitionWatcherDirective } from '../../utility/transition.watcher.directive';
import { CompactContextStore } from '../container/compact.store';
import { CompactMode } from '../container/compact';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { PopupGlobalPositionStrategy, PopupPosition, PopupPositionOffset } from './popup.position.strategy';
import { filter, first, map, shareReplay, startWith } from 'rxjs/operators';

export const APP_POPUP_NORMAL_WIDTH = '700px';
export const APP_POPUP_MINIMIZED_WIDTH = '300px';
export const APP_POPUP_NORMAL_HEIGHT = 'auto';

export type DbNgxPopupKey = string;

export enum DbNgxPopupWindowState {
  NORMAL = 'normal',
  MINIMIZED = 'minimized',
  FULLSCREEN = 'fullscreen'
}

export abstract class DbNgxPopupController<I = any, O = any> {
  readonly key: DbNgxPopupKey;
  readonly data?: I;
  readonly windowState$: Observable<DbNgxPopupWindowState>;
  readonly closing$: Observable<boolean>;
  /**
   * Signals for the popup to close.
   */
  abstract close(): void;
  /**
   * Closes the popup and returns the input value.
   */
  abstract return(value?: O): void;
  abstract minimize(): void;
  abstract normalscreen(): void;
  abstract fullscreen(): void;
}

export abstract class DbNgxPopupComponentController<I, O> extends DbNgxPopupController<I, O> {
  getClosingValueFn?: (value?: I) => Promise<O>;
}

export interface DbNgxPopupComponentConfig<I, O, T> {
  /**
   * Key used for uniquely identifying a limited instance.
   *
   * Only one popup should exist at a time given a certain key.
   */
  key: DbNgxPopupKey;
  position?: PopupPosition;
  offset?: PopupPositionOffset;
  closeOnTransition?: boolean;
  componentClass: Type<T>;
  data?: I;
  isDraggable?: boolean;
  init?: (component: T, controller: DbNgxPopupController<I, O>) => void;
}

/**
 * Popup component.
 */
@Component({
  template: `
  <dbx-popup-coordinator>
    <div class="dbx-popup-component">
      <ng-template #content></ng-template>
    </div>
  </dbx-popup-coordinator>
  `,
  styleUrls: ['./popup.scss'],
  providers: [{
    provide: DbNgxPopupController,
    useExisting: DbNgxPopupComponent
  }, {
    provide: CompactContextStore
  }]
})
export class DbNgxPopupComponent<I = any, O = any, T = any> extends AbstractTransitionWatcherDirective implements DbNgxPopupController<I, O>, OnInit, OnDestroy {

  private _position: PopupGlobalPositionStrategy;

  @ViewChild('content', { static: true, read: ViewContainerRef })
  private _content: ViewContainerRef;
  private _componentRef: ComponentRef<T>;

  private readonly closing = new Subject<void>();
  readonly isClosing$ = this.closing.pipe(first(), map(x => true), startWith(false), shareReplay(1));
  readonly closing$ = this.isClosing$.pipe(filter(x => x));

  private readonly _windowState = new BehaviorSubject<DbNgxPopupWindowState>(DbNgxPopupWindowState.NORMAL);
  readonly windowState$ = this._windowState.asObservable();

  getClosingValueFn?: (value?: I) => Promise<O>;

  constructor(
    private popoverRef: NgPopoverRef<DbNgxPopupComponentConfig<I, O, T>, O>,
    private compactContextState: CompactContextStore,
    private resolver: ComponentFactoryResolver,
    transitionService: TransitionService,
    ngZone: NgZone) {
    super(transitionService, ngZone);

    this.compactContextState.setMode(CompactMode.COMPACT);
    this._position = new PopupGlobalPositionStrategy(this.config.position, this.config.offset);
    this.popoverRef.overlay.updatePositionStrategy(this._position);
  }

  get config(): DbNgxPopupComponentConfig<I, O, T> {
    return this.popoverRef.data;
  }

  get key(): DbNgxPopupKey {
    return this.config.key;
  }

  get data(): I {
    return this.config.data;
  }

  ngOnInit(): void {
    this._content.clear();
    const componentClass = this.config.componentClass;
    const factory = this.resolver.resolveComponentFactory(componentClass);
    this._componentRef = this._content.createComponent(factory);

    if (this.config.init) {
      this.config.init(this._componentRef.instance, this);
    }
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
    this.closing.complete();
    this._windowState.complete();
  }

  protected getHookMatchCriteria(): HookMatchCriteria | false {
    return (this.config.closeOnTransition === false) ? false : super.getHookMatchCriteria();
  }

  protected updateForSuccessfulTransition(): void {
    this.close();
  }

  // Popup Controls
  public close(): void {
    this.closing.next();

    if (this.getClosingValueFn) {
      this.getClosingValueFn().then((x) => {
        this.return(x);
      }, () => {
        this.return();
      });
    } else {
      this.return();
    }
  }

  public return(value?: O): void {
    this.closing.next();
    this.popoverRef.close(value);
  }

  public minimize(): void {
    this.popoverRef.isDraggable = false;
    this.popoverRef.resize(APP_POPUP_MINIMIZED_WIDTH, APP_POPUP_NORMAL_HEIGHT);
    this.popoverRef.overlay.updatePosition();
    this._windowState.next(DbNgxPopupWindowState.MINIMIZED);
  }

  public normalscreen(): void {
    this.popoverRef.isDraggable = this.config.isDraggable;
    this.popoverRef.resize(APP_POPUP_NORMAL_WIDTH, APP_POPUP_NORMAL_HEIGHT);
    this.popoverRef.overlay.updatePosition();
    this._windowState.next(DbNgxPopupWindowState.NORMAL);
  }

  public fullscreen(): void {
    this.popoverRef.isDraggable = false;
    this.popoverRef.resize('100%', '100%');
    this.popoverRef.overlay.updatePosition();
    this._windowState.next(DbNgxPopupWindowState.FULLSCREEN);
  }

}
