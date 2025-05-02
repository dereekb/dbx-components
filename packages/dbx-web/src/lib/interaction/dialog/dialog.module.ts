import { NgModule } from '@angular/core';
import { DbxDialogContentDirective } from './dialog.content.directive';
import { DbxActionDialogDirective } from './dialog.action.directive';
import { DbxDialogContentFooterComponent } from './dialog.content.footer.component';
import { DbxDialogContentCloseComponent } from './dialog.content.close.component';

const importsAndExports = [DbxDialogContentDirective, DbxActionDialogDirective, DbxDialogContentFooterComponent, DbxDialogContentCloseComponent];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxDialogModule {}

// MARK: Compat
/**
 * @deprecated use DbxDialogModule instead.
 */
@NgModule({
  imports: [DbxDialogModule],
  exports: [DbxDialogModule]
})
export class DbxDialogInteractionModule {}
