import { Component } from '@angular/core';
import { map } from 'rxjs';
import { DbxSidenavComponent, SideNavDisplayMode } from './sidenav.component';

/**
 * Button used to interface with a parent sidenav.
 */
@Component({
  selector: 'dbx-sidenav-button',
  template: `
  <button class="dbx-sidenav-button" mat-icon-button *ngIf="showMenuButton$ | async" (click)="toggleNav()" aria-label="open sidenav button">
    <mat-icon>view_sidebar</mat-icon>
  </button>
  `
})
export class DbxSidenavButtonComponent {

  readonly mode$ = this.parent.mode$;
  readonly showMenuButton$ = this.mode$.pipe(map(x => x === SideNavDisplayMode.MOBILE));

  constructor(readonly parent: DbxSidenavComponent) { }

  toggleNav() {
    this.parent.toggleNav();
  }

}
