import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxListLayoutModule } from '@dereekb/dbx-web';
import { DbxFirebaseModelTypeInstanceListComponent, DbxFirebaseModelTypeInstanceListViewComponent, DbxFirebaseModelTypeInstanceListViewItemComponent } from './model.types.list.component';
import { DbxfirebaseModelViewedEventDirective } from './model.types.view.directive';

const importsAndExports = [DbxfirebaseModelViewedEventDirective, DbxFirebaseModelTypeInstanceListComponent, DbxFirebaseModelTypeInstanceListViewComponent, DbxFirebaseModelTypeInstanceListViewItemComponent];

/**
 * @deprecated import independent components instead
 *
 * @see DbxfirebaseModelViewedEventDirective
 * @see DbxFirebaseModelTypeInstanceListComponent
 * @see DbxFirebaseModelTypeInstanceListViewComponent
 * @see DbxFirebaseModelTypeInstanceListViewItemComponent
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebaseModelTypesModule {}
