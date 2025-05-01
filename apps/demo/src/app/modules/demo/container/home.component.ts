import { Component, inject } from '@angular/core';
import { DemoSystemStateAccessor } from 'demo-components';
import { DbxAppEnviromentService } from '@dereekb/dbx-core';
import { DbxContentPageDirective } from '../../../../../../../packages/dbx-web/src/lib/layout/content/content.page.directive';
import { DbxAppContextStateDirective } from '../../../../../../../packages/dbx-core/src/lib/context/context.directive';
import { DbxContentContainerDirective } from '../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DbxContentBoxDirective } from '../../../../../../../packages/dbx-web/src/lib/layout/content/content.box.directive';
import { DbxLinkComponent } from '../../../../../../../packages/dbx-web/src/lib/router/layout/anchor/anchor.link.component';
import { DbxAnchorComponent } from '../../../../../../../packages/dbx-web/src/lib/router/layout/anchor/anchor.component';
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
