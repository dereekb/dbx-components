import { Component, Type, OnDestroy, inject } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { Maybe, PixelsString } from '@dereekb/util';
import { CompactMode, CompactContextStore } from '../../layout';
import { BehaviorSubject, Subject, filter, first, map, shareReplay, startWith } from 'rxjs';
import { PopupGlobalPositionStrategy, PopupPosition, PopupPositionOffset } from './popup.position.strategy';
import { AbstractTransitionWatcherDirective, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxPopupController, DbxPopupKey, DbxPopupWindowState } from './popup';

export const APP_POPUP_NORMAL_WIDTH = '700px';
export const APP_POPUP_MINIMIZED_WIDTH = '300px';
export const APP_POPUP_NORMAL_HEIGHT = 'auto';

export abstract class DbxPopupComponentController<O, I> extends DbxPopupController<O, I> {
  getClosingValueFn?: (value?: I) => Promise<O>;
}

export interface DbxPopupComponentConfig<O, I, T> {
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
  init?: (component: T, controller: DbxPopupController<O, I>) => void;
  width?: PixelsString;
  height?: PixelsString;
}

/**
 * Popup component.
 */
@Component({
  template: `
    <dbx-popup-coordinator>
      <div class="dbx-popup-component" dbx-injection [config]="contentConfig"></div>
    </dbx-popup-coordinator>
  `,
  providers: [
    {
      provide: DbxPopupController,
      useExisting: DbxPopupComponent
    },
    {
      provide: CompactContextStore
    }
  ]
})
export class DbxPopupComponent<O = unknown, I = unknown, T = unknown> extends AbstractTransitionWatcherDirective implements DbxPopupController<O, I>, OnDestroy {
  private popoverRef = inject(NgPopoverRef<DbxPopupComponentConfig<O, I, T>, O>);
  private compactContextState = inject(CompactContextStore);

  private _position: PopupGlobalPositionStrategy;

  readonly contentConfig: DbxInjectionComponentConfig = {
    componentClass: this.config.componentClass,
    init: this.config.init ? (instance) => (this.config as Required<DbxPopupComponentConfig<O, I, T>>).init(instance as T, this) : undefined
  };

  private readonly closing = new Subject<void>();
  readonly isClosing$ = this.closing.pipe(
    first(),
    map(() => true),
    startWith(false),
    shareReplay(1)
  );
  readonly closing$ = this.isClosing$.pipe(filter((x) => x));

  private readonly _windowState = new BehaviorSubject<DbxPopupWindowState>(DbxPopupWindowState.NORMAL);
  readonly windowState$ = this._windowState.asObservable();

  getClosingValueFn?: (value?: I) => Promise<O>;

  constructor() {
    super();
    this.compactContextState.setMode(CompactMode.COMPACT);
    this._position = new PopupGlobalPositionStrategy(this.config.position, this.config.offset);
    this.popoverRef.overlay.updatePositionStrategy(this._position);
  }

  get config(): DbxPopupComponentConfig<O, I, T> {
    return this.popoverRef.data;
  }

  get key(): DbxPopupKey {
    return this.config.key;
  }

  get data(): Maybe<I> {
    return this.config.data;
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
      this.getClosingValueFn().then(
        (x) => {
          this.return(x);
        },
        () => {
          this.return();
        }
      );
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
