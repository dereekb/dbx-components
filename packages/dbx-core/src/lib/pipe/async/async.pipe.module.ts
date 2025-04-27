import { NgModule } from '@angular/core';
import { AsObservablePipe } from './asobservable.pipe';

const importsAndExports = [AsObservablePipe];

/**
 * @deprecated use AsObservablePipe directly.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxAsyncPipeModule {}
