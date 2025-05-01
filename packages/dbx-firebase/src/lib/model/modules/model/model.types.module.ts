import { NgModule } from '@angular/core';
import { DbxFirebaseModelTypeInstanceListComponent, DbxFirebaseModelTypeInstanceListViewComponent, DbxFirebaseModelTypeInstanceListViewItemComponent } from './model.types.list.component';
import { DbxFirebaseModelViewedEventDirective } from './model.types.view.directive';

const importsAndExports = [DbxFirebaseModelViewedEventDirective, DbxFirebaseModelTypeInstanceListComponent, DbxFirebaseModelTypeInstanceListViewComponent, DbxFirebaseModelTypeInstanceListViewItemComponent];

/**
 * @deprecated import independent components instead
 *
 * @see DbxFirebaseModelViewedEventDirective
 * @see DbxFirebaseModelTypeInstanceListComponent
 * @see DbxFirebaseModelTypeInstanceListViewComponent
 * @see DbxFirebaseModelTypeInstanceListViewItemComponent
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebaseModelTypesModule {}
