import { filter, switchMap, of } from 'rxjs';
import { DbxMapboxMapStore } from './mapbox.store';
import { Component, inject, signal, input } from '@angular/core';
import { type Maybe, DestroyFunctionObject, isNotFalse } from '@dereekb/util';
import { MatMenuTrigger } from '@angular/material/menu';
import { clean, cleanSubscription } from '@dereekb/dbx-core';
import { disableRightClickInCdkBackdrop } from '@dereekb/dbx-web';
import { toObservable } from '@angular/core/rxjs-interop';
import { dbxMapboxRightClickEventClientPosition } from './mapbox.util';
import { isTouchSourcedMouseEvent } from './mapbox.longpress';

/**
 * Directive that connects a host MatMenuTrigger to a DbxMapboxMapStore and opens the menu on a right-click, or a long press, on the map.
 *
 * The map dissapears if the mouse scrolls anywhere else on the map.
 */
@Component({
  selector: 'dbx-mapbox-menu',
  template: '',
  host: {
    style: 'visibility: hidden; position: fixed',
    '[style.top]': 'posSignal().y',
    '[style.left]': 'posSignal().x'
  }
})
export class DbxMapboxMenuComponent {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);
  readonly matMenuTrigger = inject(MatMenuTrigger, { host: true });

  readonly active = input<boolean, Maybe<boolean>>(true, { transform: isNotFalse });

  readonly posSignal = signal<{ x: string; y: string }>({ x: `0`, y: `0` });

  readonly active$ = toObservable(this.active);

  private readonly _preventRightClick = new DestroyFunctionObject();

  constructor() {
    cleanSubscription(
      this.active$
        .pipe(
          switchMap((active) => {
            return active ? this.dbxMapboxMapStore.rightClickEvent$ : of();
          }),
          filter(Boolean)
        )
        .subscribe((event) => {
          const menu = this.matMenuTrigger.menu;

          if (menu) {
            // update position of this component for menu to open at
            const { x, y } = dbxMapboxRightClickEventClientPosition(event);

            this.posSignal.set({
              x: `${x}px`,
              y: `${y}px`
            });

            // open menu
            this.matMenuTrigger.openMenu();

            // prevent right clicks in the cdkOverlay while the menu is open. A touch's contextmenu (sent while or after a finger is held) must not close the menu it just opened.
            this._preventRightClick.destroy = disableRightClickInCdkBackdrop(undefined, (contextMenuEvent) => {
              if (!isTouchSourcedMouseEvent(contextMenuEvent)) {
                this.matMenuTrigger.closeMenu();
              }
            });
          }
        })
    );

    cleanSubscription(
      this.matMenuTrigger.menuClosed.subscribe(() => {
        // destroy prevention when the menu is closed.
        this._preventRightClick.destroy();
      })
    );

    clean(() => {
      if (this.matMenuTrigger) {
        this.matMenuTrigger.closeMenu();
      }
    });
  }
}
