import { Component, ComponentFactoryResolver, NgZone, Type, ViewChild, ViewContainerRef, OnInit, OnDestroy, ComponentRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { Maybe } from '@dereekb/util';
import { CompactMode, CompactContextStore } from '../../layout';
import { BehaviorSubject, Subject } from 'rxjs';
import { PopupGlobalPositionStrategy, PopupPosition, PopupPositionOffset } from './popup.position.strategy';
import { filter, first, map, shareReplay, startWith } from 'rxjs/operators';
import { AbstractTransitionWatcherDirective, DbxRouterTransitionService } from '@dereekb/dbx-core';
import { DbxPopupController, DbxPopupKey, DbxPopupWindowState } from './popup';

export const APP_POPUP_NORMAL_WIDTH = '700px';
export const APP_POPUP_MINIMIZED_WIDTH = '300px';
export const APP_POPUP_NORMAL_HEIGHT = 'auto';

export abstract class DbxPopupComponentController<I, O> extends DbxPopupController<I, O> {
  getClosingValueFn?: (value?: I) => Promise<O>;
}

export interface DbxPopupComponentConfig<I, O, T> {
  /**
   * Key used for uniquely identifying a limited instance.
   *
   * Only one popup should exist at a time given a certain key.
   */
  key: DbxPopupKey;
  position?: PopupPosition;
  offset?: PopupPositionOffset;
  closeOnTransition?: boolean;
  componentClass: Type<T>;
  data?: I;
  isDraggable?: boolean;
  init?: (component: T, controller: DbxPopupController<I, O>) => void;
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
  // TODO: styleUrls: ['./popup.scss'],
  providers: [{
    provide: DbxPopupController,
    useExisting: DbxPopupComponent
  }, {
    provide: CompactContextStore
  }]
})
export class DbxPopupComponent<I = any, O = any, T = any> extends AbstractTransitionWatcherDirective implements DbxPopupController<I, O>, OnInit, OnDestroy {

  private _position: PopupGlobalPositionStrategy;

  @ViewChild('content', { static: true, read: ViewContainerRef })
  private _content!: ViewContainerRef;
  private _componentRef?: ComponentRef<T>;

  private readonly closing = new Subject<void>();
  readonly isClosing$ = this.closing.pipe(first(), map(x => true), startWith(false), shareReplay(1));
  readonly closing$ = this.isClosing$.pipe(filter(x => x));

  private readonly _windowState = new BehaviorSubject<DbxPopupWindowState>(DbxPopupWindowState.NORMAL);
  readonly windowState$ = this._windowState.asObservable();

  getClosingValueFn?: (value?: I) => Promise<O>;

  constructor(
    private popoverRef: NgPopoverRef<DbxPopupComponentConfig<I, O, T>, O>,
    private compactContextState: CompactContextStore,
    private resolver: ComponentFactoryResolver,
    dbNgxRouterTransitionService: DbxRouterTransitionService,
    ngZone: NgZone) {
    super(dbNgxRouterTransitionService, ngZone);

    this.compactContextState.setMode(CompactMode.COMPACT);
    this._position = new PopupGlobalPositionStrategy(this.config.position, this.config.offset);
    this.popoverRef.overlay.updatePositionStrategy(this._position);
  }

  get config(): DbxPopupComponentConfig<I, O, T> {
    return this.popoverRef.data;
  }

  get key(): DbxPopupKey {
    return this.config.key;
  }

  get data(): Maybe<I> {
    return this.config.data;
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this._content.clear();
    const componentClass = this.config.componentClass;
    const factory = this.resolver.resolveComponentFactory(componentClass);
    this._componentRef = this._content.createComponent(factory);

    if (this.config.init) {
      this.config.init(this._componentRef.instance, this);
    }
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.closing.complete();
    this._windowState.complete();
  }

  protected updateForSuccessfulTransition(): void {
    if (this.config.closeOnTransition !== false) {
      this.close();
    }
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
    this._windowState.next(DbxPopupWindowState.MINIMIZED);
  }

  public normalscreen(): void {
    this.popoverRef.isDraggable = this.config.isDraggable;
    this.popoverRef.resize(APP_POPUP_NORMAL_WIDTH, APP_POPUP_NORMAL_HEIGHT);
    this.popoverRef.overlay.updatePosition();
    this._windowState.next(DbxPopupWindowState.NORMAL);
  }

  public fullscreen(): void {
    this.popoverRef.isDraggable = false;
    this.popoverRef.resize('100%', '100%');
    this.popoverRef.overlay.updatePosition();
    this._windowState.next(DbxPopupWindowState.FULLSCREEN);
  }

}
