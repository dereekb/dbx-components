import { NgModule } from '@angular/core';
import { GetValueOncePipe, GetValuePipe } from './getvalue.pipe';

const declarations = [GetValuePipe, GetValueOncePipe];

@NgModule({
  exports: declarations,
  declarations
})
export class DbxValuePipeModule {}
