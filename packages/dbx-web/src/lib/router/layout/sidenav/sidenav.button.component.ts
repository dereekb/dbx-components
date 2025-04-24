import { Component, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { DbxSidenavComponent } from './sidenav.component';
import { SideNavDisplayMode } from './sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';

export const DEFAULT_DBX_SIDENAV_MENU_ICON = 'view_sidebar';

/**
 * Button used to interface with a parent sidenav.
 */
@Component({
  selector: 'dbx-sidenav-button',
  template: `
    @if (showMenuButtonSignal()) {
      <button class="dbx-sidenav-button" mat-icon-button (click)="toggleNav()" aria-label="open sidenav button">
        <mat-icon>{{ sidenavMenuIcon() }}</mat-icon>
      </button>
    }
  `,
  imports: [MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxSidenavButtonComponent {
  readonly parent = inject(DbxSidenavComponent);
  readonly mode$ = this.parent.mode$;
  readonly showMenuButton$ = this.mode$.pipe(map((x) => x === SideNavDisplayMode.MOBILE));
  readonly showMenuButtonSignal = toSignal(this.showMenuButton$, { initialValue: false });

  readonly sidenavMenuIcon = input<string, Maybe<string>>(DEFAULT_DBX_SIDENAV_MENU_ICON, {
    transform: (value: Maybe<string>) => value || DEFAULT_DBX_SIDENAV_MENU_ICON
  });

  toggleNav() {
    this.parent.toggleNav();
  }
}
