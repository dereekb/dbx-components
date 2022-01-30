import { DbxButtonModule } from './../../button/button.module';
import { DbxPromptComponent } from './prompt.component';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxPromptBoxComponent } from './prompt.box.component';
import { DbxPromptPageComponent } from './prompt.page.component';
import { DbxTextModule } from '../../text';
import { DbxContentLayoutModule, DbxSectionLayoutModule } from '../../layout';
import { DbxPromptConfirmComponent as DbxPromptConfirmComponent } from './prompt.confirm.component';
import { DbxPromptConfirmDialogComponent as DbxPromptConfirmDialogComponent } from './prompt.confirm.dialog.component';
import { DbxPromptConfirmDirective } from './prompt.confirm.directive';
import { DbxPromptConfirmButtonDirective } from './prompt.button.confirm.directive';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    DbxTextModule,
    DbxButtonModule,
    DbxSectionLayoutModule,
    DbxContentLayoutModule
  ],
  declarations: [
    DbxPromptComponent,
    DbxPromptBoxComponent,
    DbxPromptPageComponent,
    DbxPromptConfirmComponent,
    DbxPromptConfirmButtonDirective,
    DbxPromptConfirmDialogComponent,
    DbxPromptConfirmDirective,
  ],
  exports: [
    DbxPromptComponent,
    DbxPromptBoxComponent,
    DbxPromptPageComponent,
    DbxPromptConfirmComponent,
    DbxPromptConfirmButtonDirective,
    DbxPromptConfirmDirective,
  ],
})
export class DbxPromptModule { }
