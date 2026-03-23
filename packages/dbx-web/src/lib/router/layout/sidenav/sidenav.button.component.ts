import { Component, input, inject, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { map } from 'rxjs';
import { DbxSidenavComponent } from './sidenav.component';
import { SideNavDisplayMode } from './sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Default icon displayed on the sidenav toggle button.
 */
export const DEFAULT_DBX_SIDENAV_MENU_ICON = 'view_sidebar';

/**
 * Icon button that toggles the parent {@link DbxSidenavComponent} open or closed. Only visible when the sidenav is in mobile display mode.
 *
 * @example
 * ```html
 * <dbx-sidenav-button sidenavMenuIcon="menu"></dbx-sidenav-button>
 * ```
 */
@Component({
  selector: 'dbx-sidenav-button',
  template: `
    @if (showMenuButtonSignal()) {
      <button class="dbx-sidenav-button" mat-icon-button (click)="toggleNav()" aria-label="Toggle sidebar navigation">
        <mat-icon aria-hidden="true">{{ sidenavMenuIcon() }}</mat-icon>
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
