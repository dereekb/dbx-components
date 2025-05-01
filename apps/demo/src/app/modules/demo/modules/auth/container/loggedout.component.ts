import { Component } from '@angular/core';
import { MatAnchor } from '@angular/material/button';
import { AnchorUISref, UISref } from '@uirouter/angular';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';

@Component({
    template: `
    <div class="dbx-hint">You have been logged out.</div>
    <div>
      <a mat-stroked-button uiSref="demo.auth.login">Log In</a>
      <dbx-button-spacer></dbx-button-spacer>
      <a mat-stroked-button uiSref="demo.home">Home</a>
    </div>
  `,
    standalone: true,
    imports: [MatAnchor, AnchorUISref, UISref, DbxButtonSpacerDirective]
})
export class DemoAuthLoggedOutComponent {}
