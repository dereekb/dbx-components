import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxDownloadTextViewComponent } from './download.text.component';
import { DbxButtonModule } from '../../../button/button.module';
import { DbxLoadingModule } from '../../../loading/loading.module';
import { DbxActionModule } from '../../../action/action.module';
import { MatSnackBarModule } from '@angular/material/snack-bar';

const declarations = [DbxDownloadTextViewComponent];

@NgModule({
  imports: [
    //
    CommonModule,
    DbxLoadingModule,
    DbxButtonModule,
    DbxActionModule,
    MatSnackBarModule
  ],
  declarations,
  exports: declarations
})
export class DbxDownloadTextModule {}
