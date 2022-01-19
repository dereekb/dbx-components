import { DbNgxPopoverComponent, DbNgxPopoverComponentConfig, FullDbNgxPopoverComponentConfig } from './popover.component';
import { Injectable, Injector } from '@angular/core';
import { NgOverlayContainerConfiguration, NgOverlayContainerService, NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';

export interface DbNgxPopoverConfig<I, O, T> extends DbNgxPopoverComponentConfig<I, O, T> {
  injector?: Injector;
  height?: string;
  width?: string;
}

/**
 * Used for displaying a popover.
 */
@Injectable()
export class DbNgxPopoverService {

  private _overlayContainerService: NgOverlayContainerService;

  constructor(private _overlay: Overlay, private _injector: Injector) {
    this._overlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);
  }

  open<I, O, T>(config: DbNgxPopoverConfig<I, O, T>): NgPopoverRef<DbNgxPopoverComponentConfig<I, O, T>, O> {
    const service = (config.injector) ? new NgOverlayContainerService(this._overlay, config.injector) : this._overlayContainerService;

    const configuration: NgOverlayContainerConfiguration = {
      panelClass: 'dbx-popover-container',
      originX: 'start',
      originY: 'top',
      // TODO: Resize height/width.
      height: config.height ?? '500px',
      width: config.height ?? '400px',
      hasBackdrop: true,
      isDraggable: false,
      isResizable: false,
      disableBackdropClose: false
    };

    return service.open<FullDbNgxPopoverComponentConfig<I, O, T>, O>({
      content: DbNgxPopoverComponent,
      data: {
        ...config,
        configuration
      },
      configuration
    });
  }

}
