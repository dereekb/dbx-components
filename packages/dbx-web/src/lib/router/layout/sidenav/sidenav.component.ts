import { NgZone, OnDestroy, OnInit, Component, Input, ViewChild } from '@angular/core';
import { MatDrawerMode, MatSidenav } from '@angular/material/sidenav';
import { DbxScreenMediaService } from '../../../screen';
import { AbstractTransitionWatcherDirective, DbxRouterTransitionService, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { SubscriptionObject } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { distinctUntilChanged, map, shareReplay, Observable, first } from 'rxjs';

export enum SideNavDisplayMode {
  NONE = 'none',
  MOBILE = 'mobile',
  ICON = 'icon',
  FULL = 'full'
}

export interface DbxSidenavSidebarState {
  mode: SideNavDisplayMode;
  drawer: MatDrawerMode;
  open?: boolean;
}

/**
 * Navigation component that sits at the side of an app.
 */
@Component({
  selector: 'dbx-sidenav',
  exportAs: 'sidenav',
  templateUrl: './sidenav.component.html'
})
export class DbxSidenavComponent extends AbstractTransitionWatcherDirective implements OnInit, OnDestroy {

  @Input()
  anchors?: Maybe<ClickableAnchorLinkTree[]>;

  @ViewChild(MatSidenav, { static: true })
  readonly sidenav!: MatSidenav;

  readonly mode$: Observable<SideNavDisplayMode> = this._screenMediaService.widthType$.pipe(
    distinctUntilChanged(),
    map((width) => {
      let mode!: SideNavDisplayMode;

      switch (width) {
        case 'micro':
        case 'small':
          mode = SideNavDisplayMode.MOBILE;
          break;
        case 'tablet':
          mode = SideNavDisplayMode.ICON;
          break;
        case 'large':
        case 'full':
          mode = SideNavDisplayMode.FULL;
          break;
      }

      return mode;
    }),
    shareReplay(1)
  );

  readonly disableBackdrop$: Observable<boolean> = this.mode$.pipe(
    map(x => x !== SideNavDisplayMode.MOBILE),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly sizeClass$: Observable<string> = this.mode$.pipe(
    map((mode) => `dbx-sidenav-${mode}`),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly state$: Observable<DbxSidenavSidebarState> = this.mode$.pipe(
    map((mode) => {
      let drawer!: MatDrawerMode;
      let open!: boolean;

      switch (mode) {
        case SideNavDisplayMode.MOBILE:
          drawer = 'over';
          open = false;
          break;
        case SideNavDisplayMode.ICON:
        case SideNavDisplayMode.FULL:
          drawer = 'side';
          open = true;
          break;
      }

      return {
        mode,
        drawer,
        open
      };
    }),
    shareReplay(1)
  );

  readonly drawer$: Observable<MatDrawerMode> = this.state$.pipe(map(x => x.drawer), distinctUntilChanged(), shareReplay(1));

  private _watcherSub = new SubscriptionObject();
  private _stateSub = new SubscriptionObject();

  constructor(
    dbxRouterTransitionService: DbxRouterTransitionService,
    ngZone: NgZone,
    private _screenMediaService: DbxScreenMediaService) {
    super(dbxRouterTransitionService, ngZone);
  }

  override ngOnInit(): void {
    super.ngOnInit();

    this._stateSub.subscription = this.state$.subscribe((state) => {
      if (state.open != null) {
        this._toggleNav(state.open, true);
      }
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._watcherSub.destroy();
    this._stateSub.destroy();
  }

  protected updateForSuccessfulTransition(): void {
    this.closeNav();
  }

  closeNav(): void {
    this.toggleNav(false);
  }

  toggleNav(open?: boolean): void {
    this._toggleNav(open);
  }

  private _toggleNav(toggleOpen = !this.sidenav.opened, forced = false): void {
    this.state$.pipe(first()).subscribe(({ mode }) => {
      this.ngZone.run(() => {
        let open: Maybe<boolean>;

        if (!forced) {
          switch (mode) {
            case SideNavDisplayMode.MOBILE:
              open = toggleOpen;
              break;
            case SideNavDisplayMode.ICON:
            case SideNavDisplayMode.FULL:
              // Do nothing. Should be always open.
              break;
          }
        } else {
          open = toggleOpen;
        }

        if (open != null) {
          if (open) {
            this.sidenav.open();
          } else {
            this.sidenav.close();
          }
        }
      });
    });
  }

}
