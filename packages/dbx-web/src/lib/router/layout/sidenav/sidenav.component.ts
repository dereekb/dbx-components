import { Component, input, viewChild, inject, ChangeDetectionStrategy, computed, effect } from '@angular/core';
import { MatDrawerMode, MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { DbxScreenMediaService } from '../../../screen/screen.service';
import { AbstractTransitionWatcherDirective, ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { SideNavDisplayMode } from './sidenav';
import { NgClass } from '@angular/common';
import { DbxRouterAnchorModule } from '../anchor/anchor.module';
import { DbxAnchorListComponent } from '../anchorlist/anchorlist.component';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map, Observable, shareReplay } from 'rxjs';

export interface DbxSidenavSidebarState {
  readonly mode: SideNavDisplayMode;
  readonly drawer: MatDrawerMode;
  readonly open?: boolean;
}

/**
 * Navigation component that sits at the side of an app.
 */
@Component({
  selector: 'dbx-sidenav',
  exportAs: 'sidenav',
  template: `
    <mat-sidenav-container class="dbx-sidenav" [ngClass]="sizeCssClassSignal()">
      <mat-sidenav class="dbx-sidenav-nav" [disableClose]="disableBackdropSignal()" [mode]="drawerSignal()">
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
  imports: [NgClass, MatSidenavModule, DbxRouterAnchorModule, DbxAnchorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxSidenavComponent extends AbstractTransitionWatcherDirective {
  private readonly _screenMediaService = inject(DbxScreenMediaService);

  readonly sidenav = viewChild.required<MatSidenav>(MatSidenav);

  readonly anchors = input<Maybe<ClickableAnchorLinkTree[]>>();

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
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly modeSignal = toSignal(this.mode$);
  readonly disableBackdropSignal = computed(() => this.modeSignal() !== SideNavDisplayMode.MOBILE);
  readonly sizeCssClassSignal = computed(() => `dbx-sidenav-${this.modeSignal()}`);

  readonly stateSignal = computed(() => {
    const mode = this.modeSignal();

    let drawer: MatDrawerMode = 'over';
    let open: boolean = false;

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
  });

  readonly drawerSignal = computed(() => this.stateSignal().drawer);

  protected readonly _stateSignalToggleEffect = effect(() => {
    const state = this.stateSignal();

    if (state.open != null) {
      this._toggleNav(state.open, true);
    }
  });

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

    const mode = this.stateSignal().mode;

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
        this.sidenav().open();
      } else {
        this.sidenav().close();
      }
    }
  }
}
