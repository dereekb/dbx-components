import { Component } from '@angular/core';
import { DbxContentPageDirective } from '@dereekb/dbx-web';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  standalone: true,
  imports: [DbxContentPageDirective, DbxAppContextStateDirective, DbxContentContainerDirective, UIView]
})
export class DemoAuthLayoutComponent {}
