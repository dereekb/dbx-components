import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxDialogContentDirective } from './dialog.content.component';
import { DbxStyleLayoutModule } from '../../layout/style/style.layout.module';
import { DbxActionDialogDirective } from './dialog.action.directive';
import { DbxDialogContentFooterComponent } from './dialog.content.footer.component';
import { MatButtonModule } from '@angular/material/button';
import { DbxDialogContentCloseComponent } from './dialog.content.close.component';
import { MatIconModule } from '@angular/material/icon';

/**
 * Module for block components.
 */
@NgModule({
  imports: [CommonModule, DbxStyleLayoutModule, MatButtonModule, MatIconModule],
  declarations: [DbxDialogContentDirective, DbxActionDialogDirective, DbxDialogContentFooterComponent, DbxDialogContentCloseComponent],
  exports: [DbxDialogContentDirective, DbxActionDialogDirective, DbxDialogContentFooterComponent, DbxDialogContentCloseComponent]
})
export class DbxDialogInteractionModule {}
