import { NgModule } from '@angular/core';
import { AsObservablePipe } from './asobservable.pipe';

const declarations = [AsObservablePipe];

@NgModule({
  exports: declarations,
  declarations
})
export class DbxAsyncPipeModule {}
