import { NgModule } from '@angular/core';
import { DbxTableViewComponent } from './table.component';
import { DbxTableDirective } from './table.directive';

const importsAndExports = [DbxTableDirective, DbxTableViewComponent];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxTableModule {}
