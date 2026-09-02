import { Component } from '@angular/core';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { DbxContentLayoutModule, DbxSectionPageComponent } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

/**
 * Layout for the signed-in user's test FormSpace at `/demo/app/formspace`.
 */
@Component({
  templateUrl: './layout.component.html',
  imports: [UIView, DbxAppContextStateDirective, DbxContentLayoutModule, DbxSectionPageComponent]
})
export class DemoFormSpaceLayoutComponent {}
