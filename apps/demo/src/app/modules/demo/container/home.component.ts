import { Component, inject } from '@angular/core';
import { DemoSystemStateAccessor } from '@dereekb/demo-components';

@Component({
  templateUrl: './home.component.html'
})
export class DemoHomeComponent {
  readonly _demoSystemStateAccessor: DemoSystemStateAccessor = inject(DemoSystemStateAccessor);

  exampleSystemState$ = this._demoSystemStateAccessor.exampleSystemState$;
}
