import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { StoreModule } from '@ngrx/store';
import { DbxListLayoutModule } from '../../layout/list/list.layout.module';
import { fromDbxModel } from './state';

/**
 * Contains components related to displaying content related to models identified only by their model key.
 */
@NgModule({
  imports: [
    //
    CommonModule,
    DbxListLayoutModule,
    DbxInjectionComponentModule,
    StoreModule.forFeature(fromDbxModel.featureKey, fromDbxModel.reducers)
  ],
  declarations: [],
  exports: []
})
export class DbxModelInfoModule {}
