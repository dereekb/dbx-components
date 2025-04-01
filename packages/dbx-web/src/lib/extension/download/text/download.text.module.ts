import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxDownloadTextViewComponent } from './download.text.component';

const importsAndExports = [DbxDownloadTextViewComponent];

/**
 * @deprecated import DbxDownloadtextVie
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxDownloadTextModule {}
