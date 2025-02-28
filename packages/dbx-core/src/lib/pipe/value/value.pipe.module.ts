import { NgModule } from '@angular/core';
import { DollarAmountPipe } from './dollar.pipe';
import { GetValueOncePipe, GetValuePipe } from './getvalue.pipe';
import { CutTextPipe } from './cuttext.pipe';

const declarations = [CutTextPipe, DollarAmountPipe, GetValuePipe, GetValueOncePipe];

@NgModule({
  exports: declarations,
  declarations
})
export class DbxValuePipeModule {}
