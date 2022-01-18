import { DbNgxButtonModule } from './../../button/button.module';
import { DbNgxPromptComponent } from './prompt.component';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxPromptBoxComponent } from './prompt.box.component';
import { DbNgxPromptPageComponent } from './prompt.page.component';
import { DbNgxTextModule } from '../text/text.module';
import { DbNgxContentModule } from '../container/container.module';
import { DbNgxPromptConfirmComponent as DbNgxPromptConfirmComponent } from './prompt.confirm.component';
import { DbNgxPromptConfirmDialogComponent as DbNgxPromptConfirmDialogComponent } from './prompt.confirm.dialog.component';
import { DbNgxPromptConfirmDirective } from './prompt.confirm.directive';
import { DbNgxPromptConfirmButtonDirective } from './prompt.button.confirm.directive';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    DbNgxTextModule,
    DbNgxButtonModule,
    DbNgxContentModule,
  ],
  declarations: [
    DbNgxPromptComponent,
    DbNgxPromptBoxComponent,
    DbNgxPromptPageComponent,
    DbNgxPromptConfirmComponent,
    DbNgxPromptConfirmButtonDirective,
    DbNgxPromptConfirmDialogComponent,
    DbNgxPromptConfirmDirective,
  ],
  exports: [
    DbNgxPromptComponent,
    DbNgxPromptBoxComponent,
    DbNgxPromptPageComponent,
    DbNgxPromptConfirmComponent,
    DbNgxPromptConfirmButtonDirective,
    DbNgxPromptConfirmDirective,
  ],
})
export class DbNgxPromptModule { }
