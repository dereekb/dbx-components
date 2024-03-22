import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxButtonModule } from '../../button';
import { DbxPromptModule } from '../../interaction';
import { DbxActionSnackbarDirective } from './action.snackbar.directive';
import { DbxActionSnackbarComponent } from './action.snackbar.component';
import { DbxStyleLayoutModule } from '../../layout/style/style.layout.module';

const declarations = [DbxActionSnackbarComponent, DbxActionSnackbarDirective];

@NgModule({
  imports: [CommonModule, DbxStyleLayoutModule, DbxCoreActionModule, DbxPromptModule, DbxButtonModule],
  declarations,
  exports: declarations
})
export class DbxActionSnackbarModule {}
