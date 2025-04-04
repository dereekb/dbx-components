import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxListLayoutModule } from '@dereekb/dbx-web';
import { DbxFirebaseModelTypeInstanceComponent, DbxFirebaseModelTypeInstanceViewComponent, DbxFirebaseModelTypeInstanceViewItemComponent } from './model.types.list.component';
import { DbxfirebaseModelViewedEventDirective } from './model.types.view.directive';

const declarations = [DbxfirebaseModelViewedEventDirective, DbxFirebaseModelTypeInstanceComponent, DbxFirebaseModelTypeInstanceViewComponent, DbxFirebaseModelTypeInstanceViewItemComponent];

@NgModule({
  imports: [CommonModule, DbxListLayoutModule],
  declarations,
  exports: declarations
})
export class DbxFirebaseModelTypesModule {}
