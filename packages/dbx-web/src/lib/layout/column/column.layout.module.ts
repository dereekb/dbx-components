import { NgModule } from '@angular/core';
import { DbxTwoColumnLayoutModule } from './two';
import { DbxOneColumnComponent } from './one';

const importsAndExports = [DbxOneColumnComponent, DbxTwoColumnLayoutModule];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxColumnLayoutModule {}
