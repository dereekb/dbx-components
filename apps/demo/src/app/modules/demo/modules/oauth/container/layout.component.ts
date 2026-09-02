import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentPageDirective, DbxContentContainerDirective } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  imports: [DbxContentPageDirective, DbxContentContainerDirective, UIView]
})
export class DemoAppOAuthLayoutComponent {}
