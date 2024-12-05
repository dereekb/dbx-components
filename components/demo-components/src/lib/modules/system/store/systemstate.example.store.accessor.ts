import { inject, Injectable } from '@angular/core';
import { AbstractSystemStateDocumentStoreAccessor } from '@dereekb/dbx-firebase';
import { EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE, ExampleSystemData, SystemStateFunctions } from '@dereekb/demo-firebase';

@Injectable()
export class DemoExampleSystemDataDocumentStoreAccessor extends AbstractSystemStateDocumentStoreAccessor<ExampleSystemData> {
  readonly systemStateFunctions = inject(SystemStateFunctions);

  constructor() {
    super(EXAMPLE_SYSTEM_DATA_SYSTEM_STATE_TYPE);
  }
}
