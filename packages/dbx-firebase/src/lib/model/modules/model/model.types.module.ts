import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxListLayoutModule } from '@dereekb/dbx-web';
import { DbxFirebaseModelTypeInstanceListComponent, DbxFirebaseModelTypeInstanceListViewComponent, DbxFirebaseModelTypeInstanceListViewItemComponent } from './model.types.list.component';
import { DbxfirebaseModelViewedEventDirective } from './model.types.view.directive';

const declarations = [DbxfirebaseModelViewedEventDirective, DbxFirebaseModelTypeInstanceListComponent, DbxFirebaseModelTypeInstanceListViewComponent, DbxFirebaseModelTypeInstanceListViewItemComponent];

@NgModule({
  imports: [CommonModule, DbxListLayoutModule],
  declarations,
  exports: declarations
})
export class DbxFirebaseModelTypesModule {}
