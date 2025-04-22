import { NgModule } from '@angular/core';
import { DbxTableDateHeaderComponent } from './date.table.column.header.component';
import { DbxTableDateRangeDayDistanceInputCellInputComponent } from './daterange.table.cell.input.component';

const importsAndExports = [DbxTableDateHeaderComponent, DbxTableDateRangeDayDistanceInputCellInputComponent];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxTableDateModule {}
