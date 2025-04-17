import { NgModule } from '@angular/core';
import { DbxStepComponent } from './step.component';

const importsAndExports = [DbxStepComponent];

/**
 * @deprecated import DbxStepComponent directly instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxStepLayoutModule {}
