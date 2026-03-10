import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxPagebarComponent } from '../../../layout/bar/pagebar.component';
import { DbxSidenavButtonComponent } from './sidenav.button.component';
import { DbxButtonSpacerDirective } from '../../../button/button.spacer.directive';

/**
 * Pagebar component pre-configured with a sidenav toggle button for use inside a {@link DbxSidenavPageComponent}.
 *
 * Extends {@link DbxPagebarComponent} and adds the sidenav menu button on the left side.
 *
 * @example
 * ```html
 * <dbx-sidenav-pagebar sidenavMenuIcon="menu" color="primary">
 *   <span left>Left Content</span>
 *   <span>Right Content</span>
 * </dbx-sidenav-pagebar>
 * ```
 */
@Component({
  selector: 'dbx-sidenav-pagebar',
  template: `
    <dbx-pagebar class="dbx-sidenav-pagebar" [color]="color()">
      <span left>
        <dbx-sidenav-button [sidenavMenuIcon]="sidenavMenuIcon()"></dbx-sidenav-button>
        <dbx-button-spacer></dbx-button-spacer>
        <ng-content left></ng-content>
      </span>
      <ng-content right></ng-content>
    </dbx-pagebar>
  `,
  imports: [DbxPagebarComponent, DbxSidenavButtonComponent, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxSidenavPagebarComponent extends DbxPagebarComponent {
  readonly sidenavMenuIcon = input<Maybe<string>>();
}
