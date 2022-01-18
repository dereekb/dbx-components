import { DbNgxPopupComponent, DbNgxPopupComponentConfig, APP_POPUP_NORMAL_HEIGHT, APP_POPUP_NORMAL_WIDTH } from './popup.component';
import { Inject, Injectable, Injector } from '@angular/core';
import { NgOverlayContainerService, NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';

export interface DbNgxPopupConfig<I, O, T> extends DbNgxPopupComponentConfig<I, O, T> {
  injector?: Injector;
}

/**
 * Used for displaying a popup.
 */
@Injectable()
export class DbNgxPopupService {

  private _overlayContainerService: NgOverlayContainerService;

  constructor(private _overlay: Overlay, private _injector: Injector) {
    this._overlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);
  }

  open<I, O, T>(config: DbNgxPopupConfig<I, O, T>): NgPopoverRef<DbNgxPopupComponentConfig<I, O, T>, O> {
    const service = (config.injector) ? new NgOverlayContainerService(this._overlay, config.injector) : this._overlayContainerService;
    const isDraggable = config.isDraggable ?? false;

    return service.open<DbNgxPopupComponentConfig<I, O, T>, O>({
      content: DbNgxPopupComponent,
      data: {
        ...config,
        isDraggable,
      },
      configuration: {
        panelClass: 'dbx-popup-container',
        width: APP_POPUP_NORMAL_WIDTH,
        height: APP_POPUP_NORMAL_HEIGHT,
        useGlobalPositionStrategy: true,
        hasBackdrop: false,
        isResizable: false,
        isDraggable
      }
    });
  }

}
