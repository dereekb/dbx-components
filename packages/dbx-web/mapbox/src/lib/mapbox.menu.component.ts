import { SubscriptionObject } from '@dereekb/rxjs';
import { filter, switchMap, of } from 'rxjs';
import { DbxMapboxMapStore } from './mapbox.store';
import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, inject, signal, input, effect } from '@angular/core';
import { Maybe, DestroyFunctionObject, isNotFalse } from '@dereekb/util';
import { MatMenuTrigger } from '@angular/material/menu';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { disableRightClickInCdkBackdrop } from '@dereekb/dbx-web';
import { toObservable } from '@angular/core/rxjs-interop';

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
    '[style.top]': 'posSignal().y',
    '[style.left]': 'posSignal().x'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxMapboxMenuComponent extends AbstractSubscriptionDirective implements OnInit, OnDestroy {
  readonly dbxMapboxMapStore = inject(DbxMapboxMapStore);
  readonly matMenuTrigger = inject(MatMenuTrigger, { host: true });

  readonly active = input<boolean, Maybe<boolean>>(true, { transform: isNotFalse });

  readonly openCloseSignal = signal<Maybe<boolean>>(undefined);
  readonly posSignal = signal<{ x: string; y: string }>({ x: `0`, y: `0` });

  protected readonly _openCloseEffect = effect(() => {
    const openOrClose = this.openCloseSignal();

    switch (openOrClose) {
      case true:
        this.matMenuTrigger.openMenu();
        break;
      case false:
        this.matMenuTrigger.closeMenu();
        break;
    }
  });

  private readonly _menuCloseSub = new SubscriptionObject();
  private readonly _preventRightClick = new DestroyFunctionObject();

  ngOnInit(): void {
    this.sub = toObservable(this.active)
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
          this.posSignal.set({
            x: `${buttonEvent.x}px`,
            y: `${buttonEvent.y}px`
          });

          // open menu
          this.matMenuTrigger.openMenu();

          // prevent right clicks in the cdkOverlay while the menu is open
          this._preventRightClick.destroy = disableRightClickInCdkBackdrop(undefined, () => {
            this.matMenuTrigger.closeMenu();
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
    this._menuCloseSub.destroy();
    this._preventRightClick.destroy();

    if (this.matMenuTrigger) {
      this.matMenuTrigger.closeMenu();
    }
  }
}
