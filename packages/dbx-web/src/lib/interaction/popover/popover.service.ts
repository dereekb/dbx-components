import { DbxPopoverComponent, DbxPopoverComponentConfig, FullDbxPopoverComponentConfig } from './popover.component';
import { Injectable, Injector, inject } from '@angular/core';
import { NgOverlayContainerConfiguration, NgOverlayContainerService, NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';

export type DbxPopoverConfigSizing = Pick<NgOverlayContainerConfiguration, 'originX' | 'originY' | 'height' | 'width' | 'minHeight' | 'minWidth' | 'isResizable'>;

export interface DbxPopoverConfig<O, I, T> extends DbxPopoverComponentConfig<O, I, T>, DbxPopoverConfigSizing {
  injector?: Injector;
}

/**
 * Used for displaying a popover.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxPopoverService {
  private _overlay = inject(Overlay);
  private _injector = inject(Injector);
  private _overlayContainerService: NgOverlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);

  open<O, I, T>(config: DbxPopoverConfig<O, I, T>): NgPopoverRef<DbxPopoverComponentConfig<O, I, T>, O> {
    const service = config.injector ? new NgOverlayContainerService(this._overlay, config.injector) : this._overlayContainerService;

    const configuration: NgOverlayContainerConfiguration = {
      panelClass: 'dbx-popover-container',
      originX: config.originX ?? 'start',
      originY: config.originY ?? 'top',
      // TODO: Resize height/width.
      minHeight: config.minHeight,
      minWidth: config.minWidth,
      height: config.height ?? '500px',
      width: config.width ?? '400px',
      hasBackdrop: true,
      isDraggable: false,
      isResizable: config.isResizable ?? false,
      disableBackdropClose: false
    };

    return service.open<FullDbxPopoverComponentConfig<O, I, T>, O>({
      content: DbxPopoverComponent,
      data: {
        ...config,
        configuration
      },
      configuration
    });
  }
}
