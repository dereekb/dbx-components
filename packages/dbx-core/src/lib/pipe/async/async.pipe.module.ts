import { NgModule } from '@angular/core';
import { AsObservablePipe } from './asobservable.pipe';

const declarations = [AsObservablePipe];

/**
 * @deprecated use AsObservablePipe directly.
 */
@NgModule({
  imports: declarations,
  exports: declarations
})
export class DbxAsyncPipeModule {}
