import { DbxPopoverComponent, type DbxPopoverComponentConfig, type FullDbxPopoverComponentConfig } from './popover.component';
import { Injectable, Injector, inject } from '@angular/core';
import { type NgOverlayContainerConfiguration, NgOverlayContainerService, type NgPopoverRef } from 'ng-overlay-container';
import { Overlay } from '@angular/cdk/overlay';

/**
 * Sizing-related configuration options for a popover overlay.
 */
export type DbxPopoverConfigSizing = Pick<NgOverlayContainerConfiguration, 'originX' | 'originY' | 'height' | 'width' | 'minHeight' | 'minWidth' | 'isResizable'>;

/**
 * Full configuration for opening a popover via {@link DbxPopoverService}, combining component config with sizing and an optional injector.
 */
export interface DbxPopoverConfig<O, I, T> extends DbxPopoverComponentConfig<O, I, T>, DbxPopoverConfigSizing {
  readonly injector?: Injector;
}

/**
 * Root-level service for programmatically opening popover overlays with dynamic component content.
 *
 * @example
 * ```ts
 * const ref = popoverService.open({
 *   key: 'my-popover',
 *   origin: elementRef,
 *   componentClass: MyPopoverContentComponent,
 *   width: '400px',
 *   height: '300px'
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class DbxPopoverService {
  private readonly _overlay = inject(Overlay);
  private readonly _injector = inject(Injector);
  private readonly _overlayContainerService: NgOverlayContainerService = new NgOverlayContainerService(this._overlay, this._injector);

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
