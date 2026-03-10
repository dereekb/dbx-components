import { NgModule } from '@angular/core';
import { DbxStepComponent } from './step.component';

const importsAndExports = [DbxStepComponent];

/**
 * Module that exports {@link DbxStepComponent}.
 *
 * @deprecated Import `DbxStepComponent` directly instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxStepLayoutModule {}
