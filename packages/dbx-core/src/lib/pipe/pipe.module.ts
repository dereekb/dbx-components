import { NgModule } from '@angular/core';
import { DbxDatePipeModule } from './date/date.pipe.module';
import { DbxMiscPipeModule } from './misc/misc.pipe.module';
import { DbxAsyncPipeModule } from './async/async.pipe.module';
import { DbxValuePipeModule } from './value/value.pipe.module';

@NgModule({
  exports: [DbxAsyncPipeModule, DbxMiscPipeModule, DbxDatePipeModule, DbxValuePipeModule]
})
export class DbxPipesModule {}
