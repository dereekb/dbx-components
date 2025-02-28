import { Component, Input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxPagebarComponent } from '../../../layout/bar/pagebar.component';

/**
 * Pre-configured pagebar used with DbxSidenavComponent.
 */
@Component({
  selector: 'dbx-sidenav-pagebar',
  template: `
    <dbx-pagebar class="dbx-sidenav-pagebar" [color]="color">
      <span left>
        <dbx-sidenav-button [sidenavMenuIcon]="sidenavMenuIcon"></dbx-sidenav-button>
        <dbx-button-spacer></dbx-button-spacer>
        <ng-content left></ng-content>
      </span>
      <ng-content right></ng-content>
    </dbx-pagebar>
  `
})
export class DbxSidenavPagebarComponent extends DbxPagebarComponent {
  @Input()
  sidenavMenuIcon: Maybe<string>;
}
