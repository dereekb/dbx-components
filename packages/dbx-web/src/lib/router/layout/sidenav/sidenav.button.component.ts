import { Component, Input, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { DbxSidenavComponent } from './sidenav.component';
import { SideNavDisplayMode } from './sidenav';

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
  readonly parent = inject(DbxSidenavComponent);
  readonly mode$ = this.parent.mode$;
  readonly showMenuButton$ = this.mode$.pipe(map((x) => x === SideNavDisplayMode.MOBILE));

  private _sidenavMenuIcon: string = DEFAULT_DBX_SIDENAV_MENU_ICON;

  toggleNav() {
    this.parent.toggleNav();
  }

  @Input()
  get sidenavMenuIcon() {
    return this._sidenavMenuIcon;
  }

  set sidenavMenuIcon(sidenavMenuIcon: Maybe<string>) {
    this._sidenavMenuIcon = sidenavMenuIcon || DEFAULT_DBX_SIDENAV_MENU_ICON;
  }
}
