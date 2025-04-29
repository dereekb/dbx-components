import { Component, inject } from '@angular/core';
import { DemoSystemStateAccessor } from 'demo-components';
import { DbxAppEnviromentService } from '@dereekb/dbx-core';

@Component({
  templateUrl: './home.component.html'
})
export class DemoHomeComponent {
  readonly _demoSystemStateAccessor: DemoSystemStateAccessor = inject(DemoSystemStateAccessor);
  readonly env = inject(DbxAppEnviromentService);

  exampleSystemState$ = this._demoSystemStateAccessor.exampleSystemState$;
}
