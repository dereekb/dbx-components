import { NgModule } from '@angular/core';
import { DbxDatePipeModule } from './date/date.pipe.module';
import { DbxMiscPipeModule } from './misc/misc.pipe.module';

@NgModule({
  exports: [DbxMiscPipeModule, DbxDatePipeModule]
})
export class DbxPipesModule {}
