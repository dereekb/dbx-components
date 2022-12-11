import { DbxPopoverComponent, DbxPopoverComponentConfig, FullDbxPopoverComponentConfig } from './popover.component';
import { Injectable, Injector } from '@angular/core';
import { NgOverlayContainerConfiguration, NgOverlayContainerService, NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';

export interface DbxPopoverConfig<O, I, T> extends DbxPopoverComponentConfig<O, I, T> {
  injector?: Injector;
  height?: string;
  width?: string;
  isResizable?: boolean;
}

/**
 * Used for displaying a popover.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxPopoverService {
  private _overlayContainerService: NgOverlayContainerService;

  constructor(private _overlay: Overlay, private _injector: Injector) {
    this._overlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);
  }

  open<O, I, T>(config: DbxPopoverConfig<O, I, T>): NgPopoverRef<DbxPopoverComponentConfig<O, I, T>, O> {
    const service = config.injector ? new NgOverlayContainerService(this._overlay, config.injector) : this._overlayContainerService;

    const configuration: NgOverlayContainerConfiguration = {
      panelClass: 'dbx-popover-container',
      originX: 'start',
      originY: 'top',
      // TODO: Resize height/width.
      height: config.height ?? '500px',
      width: config.height ?? '400px',
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
