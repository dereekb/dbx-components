import { DbxPopupComponent, DbxPopupComponentConfig, APP_POPUP_NORMAL_HEIGHT, APP_POPUP_NORMAL_WIDTH } from './popup.component';
import { Injectable, Injector } from '@angular/core';
import { NgOverlayContainerService, NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';

export interface DbxPopupConfig<O, I, T> extends DbxPopupComponentConfig<O, I, T> {
  injector?: Injector;
}

/**
 * Used for displaying a popup.
 */
@Injectable()
export class DbxPopupService {

  private _overlayContainerService: NgOverlayContainerService;

  constructor(private _overlay: Overlay, private _injector: Injector) {
    this._overlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);
  }

  open<O, I, T>(config: DbxPopupConfig<O, I, T>): NgPopoverRef<DbxPopupComponentConfig<O, I, T>, O> {
    const service = (config.injector) ? new NgOverlayContainerService(this._overlay, config.injector) : this._overlayContainerService;
    const isDraggable = config.isDraggable ?? false;
    const position = config.position ?? 'bottom_right';

    return service.open<DbxPopupComponentConfig<O, I, T>, O>({
      content: DbxPopupComponent,
      data: {
        ...config,
        isDraggable,
        position
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
