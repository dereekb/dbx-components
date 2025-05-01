import { Component } from '@angular/core';
import { DbxContentPageDirective, DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [DbxContentPageDirective, DbxAppContextStateDirective, DbxContentContainerDirective, UIView]
})
export class DemoAuthLayoutComponent {}
