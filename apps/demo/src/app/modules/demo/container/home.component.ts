import { Component, inject } from '@angular/core';
import { DemoSystemStateAccessor } from 'demo-components';
import { DbxAppEnviromentService, DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { DbxContentPageDirective, DbxContentContainerDirective, DbxContentBoxDirective, DbxLinkComponent, DbxAnchorComponent } from '@dereekb/dbx-web';
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
