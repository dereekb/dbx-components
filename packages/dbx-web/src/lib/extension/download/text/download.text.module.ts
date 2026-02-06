import { NgModule } from '@angular/core';
import { DbxDownloadTextViewComponent } from './download.text.component';

const importsAndExports = [DbxDownloadTextViewComponent];

/**
 * @deprecated import DbxDownloadTextViewComponent directly instead.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxDownloadTextModule {}
