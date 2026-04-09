import { Component, ChangeDetectionStrategy, inject, type AfterViewInit, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxDetachController } from './detach';
import { CompactContextStore, CompactMode } from '../../layout/compact';

/**
 * Data passed to the overlay component via {@link NgPopoverRef}.
 */
export interface DbxDetachOverlayData {
  readonly controller: DbxDetachController;
  readonly hostElement: HTMLElement;
}

/**
 * Component rendered inside the ng-overlay-container overlay.
 *
 * Receives the detached component's host element and appends it to the overlay DOM.
 * The component's lifecycle and change detection are managed by {@link DbxDetachService},
 * not the overlay.
 */
@Component({
  template: `
    <div class="dbx-detach-overlay"></div>
  `,
  providers: [
    {
      provide: DbxDetachController,
      useFactory: () => {
        const popoverRef = inject(NgPopoverRef<DbxDetachOverlayData>);
        return popoverRef.data.controller;
      }
    },
    {
      provide: CompactContextStore
    }
  ],
  host: {
    class: 'dbx-detach-overlay-host'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxDetachOverlayComponent implements AfterViewInit {
  private readonly _elementRef = inject(ElementRef);
  private readonly _popoverRef = inject(NgPopoverRef<DbxDetachOverlayData>);
  private readonly _compactContextStore = inject(CompactContextStore);

  constructor() {
    this._compactContextStore.setMode(CompactMode.COMPACT);
  }

  ngAfterViewInit(): void {
    const overlayEl = this._elementRef.nativeElement.querySelector('.dbx-detach-overlay');
    if (overlayEl) {
      overlayEl.appendChild(this._popoverRef.data.hostElement);
    }
  }
}
