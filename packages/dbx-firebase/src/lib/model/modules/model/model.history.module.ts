import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxButtonModule, DbxListLayoutModule, DbxModelInfoModule, DbxPopoverInteractionModule, DbxRouterListModule } from '@dereekb/dbx-web';
import { DbxFirebaseModelHistoryComponent } from './model.history.component';
import { DbxFirebaseModelHistoryPopoverButtonComponent } from './model.history.popover.button.component';
import { DbxFirebaseModelHistoryPopoverComponent } from './model.history.popover.component';
import { DbxFirebaseModelTypesModule } from './model.types.module';

const declarations = [DbxFirebaseModelHistoryComponent, DbxFirebaseModelHistoryPopoverButtonComponent, DbxFirebaseModelHistoryPopoverComponent];

@NgModule({
  imports: [CommonModule, DbxButtonModule, DbxRouterListModule, DbxPopoverInteractionModule, DbxModelInfoModule, DbxListLayoutModule, DbxFirebaseModelTypesModule],
  declarations,
  exports: declarations
})
export class DbxFirebaseModelHistoryModule {}
