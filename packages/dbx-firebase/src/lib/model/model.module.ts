import { NgModule } from '@angular/core';
import { DbxFirebaseModelTypesModule } from './modules/model/model.types.module';
import { DbxFirebaseModelStoreModule } from './modules/store/model.store.module';

@NgModule({
  exports: [DbxFirebaseModelStoreModule, DbxFirebaseModelTypesModule]
})
export class DbxFirebaseModelModule {}
