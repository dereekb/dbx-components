import { NgModule } from '@angular/core';
import { DbxFlagComponent } from './flag.component';
import { DbxFlagPromptComponent } from './flag.prompt.component';

const importsAndExports = [DbxFlagComponent, DbxFlagPromptComponent];

/**
 * Angular module that bundles {@link DbxFlagComponent} and {@link DbxFlagPromptComponent}.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFlagLayoutModule {}
