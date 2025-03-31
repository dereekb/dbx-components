import { NgModule } from '@angular/core';
import { DbxDialogContentDirective } from './dialog.content.directive';
import { DbxActionDialogDirective } from './dialog.action.directive';
import { DbxDialogContentFooterComponent } from './dialog.content.footer.component';
import { DbxDialogContentCloseComponent } from './dialog.content.close.component';

const importsAndExports = [DbxDialogContentDirective, DbxActionDialogDirective, DbxDialogContentFooterComponent, DbxDialogContentCloseComponent];

/**
 * @deprecated import components independently instead.
 *
 * @see DbxDialogContentDirective
 * @see DbxActionDialogDirective
 * @see DbxDialogContentFooterComponent
 * @see DbxDialogContentCloseComponent
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxDialogInteractionModule {}
