import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxFirebaseModelHistoryComponent } from './model.history.component';
import { DbxFirebaseModelHistoryPopoverButtonComponent } from './model.history.popover.button.component';
import { DbxFirebaseModelHistoryPopoverComponent } from './model.history.popover.component';
import { DbxFirebaseModelTypesModule } from '../model.types.module';

const importsAndExports = [DbxFirebaseModelHistoryComponent, DbxFirebaseModelHistoryPopoverButtonComponent, DbxFirebaseModelHistoryPopoverComponent];

/**
 * @deprecated import standalone components individually instead.
 *
 * @see DbxFirebaseModelHistoryComponent
 * @see DbxFirebaseModelHistoryPopoverButtonComponent
 * @see DbxFirebaseModelHistoryPopoverComponent
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebaseModelHistoryModule {}
