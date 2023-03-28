import { NgModule } from '@angular/core';
import { DbxFirebaseModelHistoryModule } from './modules/model/model.history.module';
import { DbxFirebaseModelTypesModule } from './modules/model/model.types.module';
import { DbxFirebaseModelStoreModule } from './modules/store/model.store.module';

@NgModule({
  exports: [DbxFirebaseModelStoreModule, DbxFirebaseModelHistoryModule, DbxFirebaseModelTypesModule]
})
export class DbxFirebaseModelModule {}
