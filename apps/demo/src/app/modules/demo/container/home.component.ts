import { Component, inject } from '@angular/core';
import { DemoSystemStateAccessor } from 'demo-components';
import { DbxAppEnviromentService } from '@dereekb/dbx-core';
import { DbxContentPageDirective } from '@dereekb/dbx-web';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { DbxLinkComponent } from '@dereekb/dbx-web';
import { DbxAnchorComponent } from '@dereekb/dbx-web';
import { MatButton } from '@angular/material/button';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DbxContentPageDirective, DbxAppContextStateDirective, DbxContentContainerDirective, DbxContentBoxDirective, DbxLinkComponent, DbxAnchorComponent, MatButton]
})
export class DemoHomeComponent {
  readonly _demoSystemStateAccessor: DemoSystemStateAccessor = inject(DemoSystemStateAccessor);
  readonly env = inject(DbxAppEnviromentService);

  exampleSystemState$ = this._demoSystemStateAccessor.exampleSystemState$;
}
