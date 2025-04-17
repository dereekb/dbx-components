import { NgModule } from '@angular/core';
import { DbxFlagComponent } from './flag.component';
import { DbxFlagPromptComponent } from './flag.prompt.component';

const importsAndExports = [DbxFlagComponent, DbxFlagPromptComponent];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFlagLayoutModule {}
