import { SubscriptionObject } from '@dereekb/rxjs';
import { filter, switchMap, BehaviorSubject, of } from 'rxjs';
import { DbxMapboxMapStore } from './mapbox.store';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Host, Input, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Maybe, DestroyFunctionObject } from '@dereekb/util';
import { MatMenuTrigger } from '@angular/material/legacy-menu';
import { AbstractSubscriptionDirective, safeMarkForCheck } from '@dereekb/dbx-core';
import { disableRightClickInCdkBackdrop } from '@dereekb/dbx-web';

/**
 * Directive that connects a host MatMenuTrigger to a DbxMapboxMapStore and listens for right-clicks on the map.
 *
 * The map dissapears if the mouse scrolls anywhere else on the map.
 */
@Component({
  selector: 'dbx-mapbox-menu',
  template: '',
  host: {
    style: 'visibility: hidden; position: fixed',
    '[style.top]': 'pos.y',
    '[style.left]': 'pos.x'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxMapboxMenuComponent extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  private _pos = { x: `0`, y: `0` };
  private _active = new BehaviorSubject<boolean>(true);

  private _menuCloseSub = new SubscriptionObject();
  private _preventRightClick = new DestroyFunctionObject();

  get pos() {
    return this._pos;
  }

  constructor(readonly dbxMapboxMapStore: DbxMapboxMapStore, @Host() readonly matMenuTrigger: MatMenuTrigger, readonly ngZone: NgZone, readonly cdRef: ChangeDetectorRef) {
    super();
  }

  @Input()
  set active(active: Maybe<boolean>) {
    this._active.next(active ?? true);
  }

  ngOnInit(): void {
    this.sub = this._active
      .pipe(
        switchMap((active) => {
          if (active) {
            return this.dbxMapboxMapStore.rightClickEvent$;
          } else {
            return of();
          }
        }),
        filter(Boolean)
      )
      .subscribe((event) => {
        const menu = this.matMenuTrigger.menu;
        const buttonEvent = event.originalEvent;

        if (menu && buttonEvent) {
          buttonEvent.preventDefault();

          // update position of this component for menu to open at
          this._pos = {
            x: `${buttonEvent.x}px`,
            y: `${buttonEvent.y}px`
          };

          safeMarkForCheck(this.cdRef);

          // open menu
          this.ngZone.run(() => this.matMenuTrigger.openMenu());

          // prevent right clicks in the cdkOverlay while the menu is open
          this._preventRightClick.destroy = disableRightClickInCdkBackdrop(undefined, () => {
            this.ngZone.run(() => this.matMenuTrigger.closeMenu());
          });
        }
      });

    this._menuCloseSub.subscription = this.matMenuTrigger.menuClosed.subscribe(() => {
      // destroy prevention when the menu is closed.
      this._preventRightClick.destroy();
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._active.complete();
    this._preventRightClick.destroy();
    this._menuCloseSub.destroy();

    if (this.matMenuTrigger) {
      this.matMenuTrigger.closeMenu();
    }
  }
}
