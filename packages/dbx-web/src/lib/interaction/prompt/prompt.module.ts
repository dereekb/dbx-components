import { DbxPromptComponent } from './prompt.component';
import { NgModule } from '@angular/core';
import { DbxPromptBoxComponent } from './prompt.box.component';
import { DbxPromptPageComponent } from './prompt.page.component';
import { DbxPromptConfirmComponent as DbxPromptConfirmComponent } from './prompt.confirm.component';
import { DbxPromptConfirmDialogComponent as DbxPromptConfirmDialogComponent } from './prompt.confirm.dialog.component';
import { DbxPromptConfirmDirective } from './prompt.confirm.directive';
import { DbxPromptConfirmButtonDirective } from './prompt.button.confirm.directive';

export const importsAndExports = [DbxPromptComponent, DbxPromptBoxComponent, DbxPromptPageComponent, DbxPromptConfirmComponent, DbxPromptConfirmButtonDirective, DbxPromptConfirmDialogComponent, DbxPromptConfirmDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxPromptModule {}
