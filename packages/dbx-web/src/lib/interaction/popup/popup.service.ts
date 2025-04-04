import { DbxPopupComponent, DbxPopupComponentConfig, APP_POPUP_NORMAL_HEIGHT, APP_POPUP_NORMAL_WIDTH } from './popup.component';
import { Injectable, Injector, inject } from '@angular/core';
import { NgOverlayContainerService, NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';

export interface DbxPopupConfig<O, I, T> extends DbxPopupComponentConfig<O, I, T> {
  readonly injector?: Injector;
}

/**
 * Used for displaying a popup.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxPopupService {

  private readonly _overlay = inject(Overlay);
  private readonly _injector = inject(Injector);
  private readonly _overlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);

  open<O, I, T>(config: DbxPopupConfig<O, I, T>): NgPopoverRef<DbxPopupComponentConfig<O, I, T>, O> {
    const service = config.injector ? new NgOverlayContainerService(this._overlay, config.injector) : this._overlayContainerService;
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
        width: config.width ?? APP_POPUP_NORMAL_WIDTH,
        height: config.height ?? APP_POPUP_NORMAL_HEIGHT,
        useGlobalPositionStrategy: true,
        hasBackdrop: false,
        isResizable: false,
        isDraggable
      }
    });
  }

}
