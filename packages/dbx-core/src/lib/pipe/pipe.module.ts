import { NgModule } from '@angular/core';
import { DbxDatePipeModule } from './date/date.pipe.module';
import { DbxMiscPipeModule } from './misc/misc.pipe.module';
import { DbxAsyncPipeModule } from './async/async.pipe.module';
import { DbxValuePipeModule } from './value/value.pipe.module';

const importsAndExports = [DbxAsyncPipeModule, DbxMiscPipeModule, DbxDatePipeModule, DbxValuePipeModule];

/**
 * Exports all @dereekb/dbx-core pipes
 *
 * @deprecated import the pipes directly as needed.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxPipesModule {}
