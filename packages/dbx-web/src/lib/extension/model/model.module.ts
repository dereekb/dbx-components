import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxListLayoutModule } from '../../layout/list/list.layout.module';

const declarations = [];

/**
 * Contains components related to displaying content related to models identified only by their model key.
 */
@NgModule({
  imports: [
    //
    CommonModule,
    DbxListLayoutModule,
    DbxInjectionComponentModule
  ],
  declarations: [],
  exports: []
})
export class DbxModelInfoModule {}
