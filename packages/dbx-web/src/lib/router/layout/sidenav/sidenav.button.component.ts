import { Component, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { DbxSidenavComponent, SideNavDisplayMode } from './sidenav.component';

export const DEFAULT_DBX_SIDENAV_MENU_ICON = 'view_sidebar';

/**
 * Button used to interface with a parent sidenav.
 */
@Component({
  selector: 'dbx-sidenav-button',
  template: `
    <button class="dbx-sidenav-button" mat-icon-button *ngIf="showMenuButton$ | async" (click)="toggleNav()" aria-label="open sidenav button">
      <mat-icon>{{ sidenavMenuIcon }}</mat-icon>
    </button>
  `
})
export class DbxSidenavButtonComponent {
  readonly mode$ = this.parent.mode$;
  readonly showMenuButton$ = this.mode$.pipe(map((x) => x === SideNavDisplayMode.MOBILE));

  private _sidenavMenuIcon: string = DEFAULT_DBX_SIDENAV_MENU_ICON;

  constructor(readonly parent: DbxSidenavComponent) {}

  toggleNav() {
    this.parent.toggleNav();
  }

  get sidenavMenuIcon() {
    return this._sidenavMenuIcon;
  }

  set sidenavMenuIcon(sidenavMenuIcon: Maybe<string>) {
    this._sidenavMenuIcon = sidenavMenuIcon || DEFAULT_DBX_SIDENAV_MENU_ICON;
  }
}
