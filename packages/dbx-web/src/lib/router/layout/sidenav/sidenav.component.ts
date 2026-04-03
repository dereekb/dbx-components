import { Component, input, viewChild, inject, ChangeDetectionStrategy, computed, type OnInit } from '@angular/core';
import { type MatDrawerMode, MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { DbxScreenMediaService } from '../../../screen/screen.service';
import { AbstractTransitionWatcherDirective, cleanSubscription, type ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type DbxSidenavPosition, resolveSideNavDisplayMode, SideNavDisplayMode, type SideNavDisplayModeString } from './sidenav';
import { NgClass } from '@angular/common';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { DbxAnchorListComponent } from '../anchorlist/anchorlist.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, distinctUntilChanged, map, type Observable, shareReplay } from 'rxjs';
import { DbxColorDirective } from '../../../layout/style/style.color.directive';
import { type DbxThemeColor } from '../../../layout/style/style';
import { type ThemePalette } from '@angular/material/core';

/**
 * Describes the current state of the sidenav sidebar, including display mode, Material drawer mode, and open/closed state.
 */
export interface DbxSidenavSidebarState {
  readonly mode: SideNavDisplayMode;
  readonly drawer: MatDrawerMode;
  readonly open?: boolean;
}

/**
 * Responsive side navigation component that adapts its display mode based on screen width.
 *
 * Renders a Material sidenav with an anchor list and automatically transitions between mobile overlay, icon rail, and full sidebar modes.
 * Closes automatically on route transitions in mobile mode.
 *
 * @example
 * ```html
 * <dbx-sidenav [anchors]="sidenavLinks" color="primary">
 *   <div top>Header Content</div>
 *   <div bottom>Footer Content</div>
 *   <router-outlet></router-outlet>
 * </dbx-sidenav>
 * ```
 */
@Component({
  selector: 'dbx-sidenav',
  exportAs: 'sidenav',
  template: `
    <mat-sidenav-container class="dbx-sidenav" [ngClass]="cssClassesSignal()">
      <mat-sidenav [dbxColor]="color()" [position]="position()" [disableClose]="disableBackdropSignal()" [mode]="drawerSignal()">
        <ng-content select="[top]"></ng-content>
        <dbx-anchor-list class="dbx-sidenav-anchor-list" [anchors]="anchors()"></dbx-anchor-list>
        <span class="spacer"></span>
        <ng-content select="[bottom]"></ng-content>
        <div class="dbx-sidenav-nav-end"></div>
      </mat-sidenav>
      <mat-sidenav-content>
        <ng-content></ng-content>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  imports: [NgClass, DbxColorDirective, MatSidenavModule, DbxRouterAnchorModule, DbxAnchorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxSidenavComponent extends AbstractTransitionWatcherDirective implements OnInit {
  private readonly _sidenavSub = cleanSubscription();
  private readonly _screenMediaService = inject(DbxScreenMediaService);

  readonly color = input<ThemePalette | DbxThemeColor>(undefined);
  readonly position = input<DbxSidenavPosition>('start');

  /**
   * Overrides the responsive display mode. When set, the sidenav ignores screen-width breakpoints and uses this mode instead.
   *
   * Set to `'mobile'` to keep the sidenav always hidden as an overlay that only opens when toggled.
   */
  readonly displayMode = input<Maybe<SideNavDisplayModeString>>(undefined);

  readonly sidenav = viewChild.required<MatSidenav>(MatSidenav);

  /**
   * Restricts which {@link SideNavDisplayMode} values are permitted.
   *
   * When set, any responsive or overridden mode not in this set is rounded down to the nearest
   * allowed mode in the {@link SIDE_NAV_DISPLAY_MODE_ORDER} hierarchy.
   *
   * @example
   * ```html
   * <dbx-sidenav [allowedModes]="['mobile', 'full']">
   * ```
   */
  readonly allowedModes = input<Maybe<SideNavDisplayModeString[]>>(undefined);

  readonly anchors = input<Maybe<ClickableAnchorLinkTree[]>>();

  private readonly _allowedModes$ = toObservable(this.allowedModes);

  readonly responsiveMode$: Observable<SideNavDisplayMode> = this._screenMediaService.widthType$.pipe(
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
        default:
          break;
      }

      return mode;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  private readonly _displayMode$ = toObservable(this.displayMode);

  readonly mode$: Observable<SideNavDisplayMode> = combineLatest([this.responsiveMode$, this._displayMode$, this._allowedModes$]).pipe(
    map(([responsive, override, allowedModes]) => {
      const raw = (override as SideNavDisplayMode) ?? responsive;
      const allowedSet = allowedModes ? new Set<SideNavDisplayMode>(allowedModes as SideNavDisplayMode[]) : undefined;
      return resolveSideNavDisplayMode(raw, allowedSet);
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly modeSignal = toSignal(this.mode$);
  readonly disableBackdropSignal = computed(() => this.modeSignal() !== SideNavDisplayMode.MOBILE);
  readonly sizeCssClassSignal = computed(() => `dbx-sidenav-${this.modeSignal()}`);
  readonly positionCssClassSignal = computed(() => (this.position() === 'end' ? 'dbx-sidenav-end' : 'dbx-sidenav-start'));
  readonly cssClassesSignal = computed(() => `${this.sizeCssClassSignal()} ${this.positionCssClassSignal()}`);

  readonly state$ = this.mode$.pipe(
    map((mode) => {
      let drawer: MatDrawerMode = 'over';
      let open: boolean = true;

      switch (mode) {
        case SideNavDisplayMode.MOBILE:
          drawer = 'over';
          open = false;
          break;
        case SideNavDisplayMode.ICON:
        case SideNavDisplayMode.FULL:
          drawer = 'side';
          open = true; // always show
          break;
        default:
          break;
      }

      return {
        mode,
        drawer,
        open
      };
    }),
    distinctUntilChanged((a, b) => a.mode === b.mode && a.drawer === b.drawer && a.open === b.open),
    shareReplay(1)
  );

  readonly stateSignal = toSignal(this.state$);
  readonly drawerSignal = computed(() => this.stateSignal()?.drawer ?? 'over');

  ngOnInit() {
    // wait until the child sidenav has initialized
    this._sidenavSub.setSub(
      this.state$.subscribe((state) => {
        if (state?.open != null) {
          this._toggleNav(state.open, true);
        }
      })
    );
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

  private _toggleNav(toggleOpen?: Maybe<boolean>, forced = false): void {
    toggleOpen = toggleOpen ?? !this.sidenav().opened;

    const mode = this.stateSignal()?.mode;

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
        default:
          break;
      }
    } else {
      open = toggleOpen;
    }

    if (open != null) {
      if (open) {
        void this.sidenav().open();
      } else {
        void this.sidenav().close();
      }
    }
  }
}
