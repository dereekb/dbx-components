import { NgModule } from '@angular/core';
import { DollarAmountPipe } from './dollar.pipe';
import { GetValueOncePipe, GetValuePipe } from './getvalue.pipe';
import { CutTextPipe } from './cuttext.pipe';

const importsAndExports = [CutTextPipe, DollarAmountPipe, GetValuePipe, GetValueOncePipe];

/**
 * @deprecated import the pipes directly as needed.
 *
 * @see CutTextPipe
 * @see DollarAmountPipe
 * @see GetValuePipe
 * @see GetValueOncePipe
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxValuePipeModule {}
