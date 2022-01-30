import { DbxPopoverComponent, DbxPopoverComponentConfig, FullDbxPopoverComponentConfig } from './popover.component';
import { Injectable, Injector } from '@angular/core';
import { NgOverlayContainerConfiguration, NgOverlayContainerService, NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';

export interface DbxPopoverConfig<I, O, T> extends DbxPopoverComponentConfig<I, O, T> {
  injector?: Injector;
  height?: string;
  width?: string;
}

/**
 * Used for displaying a popover.
 */
@Injectable()
export class DbxPopoverService {

  private _overlayContainerService: NgOverlayContainerService;

  constructor(private _overlay: Overlay, private _injector: Injector) {
    this._overlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);
  }

  open<I, O, T>(config: DbxPopoverConfig<I, O, T>): NgPopoverRef<DbxPopoverComponentConfig<I, O, T>, O> {
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

    return service.open<FullDbxPopoverComponentConfig<I, O, T>, O>({
      content: DbxPopoverComponent,
      data: {
        ...config,
        configuration
      },
      configuration
    });
  }

}
