import { NgModule } from '@angular/core';
import { DollarAmountPipe } from './dollar.pipe';
import { GetValueOncePipe, GetValuePipe } from './getvalue.pipe';

const declarations = [DollarAmountPipe, GetValuePipe, GetValueOncePipe];

@NgModule({
  exports: declarations,
  declarations
})
export class DbxValuePipeModule {}
