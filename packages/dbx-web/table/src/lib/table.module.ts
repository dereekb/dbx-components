import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxTableItemHeaderComponent } from './table.item.header.component';
import { DbxTableComponent } from './table.component';
import { DbxTableInputCellComponent } from './table.cell.input.component';
import { DbxTableSummaryEndCellComponent } from './table.cell.summaryend.component';
import { DbxTableSummaryStartCellComponent } from './table.cell.summarystart.component';
import { DbxTableItemActionComponent } from './table.item.action.component';
import { DbxTableActionCellComponent } from './table.cell.action.component';
import { DbxTableItemCellComponent } from './table.item.cell.component';

const exports = [DbxTableComponent];
const internalDeclarations = [
  //
  DbxTableInputCellComponent,
  DbxTableActionCellComponent,
  DbxTableItemCellComponent,
  DbxTableItemHeaderComponent,
  DbxTableItemActionComponent,
  DbxTableSummaryStartCellComponent,
  DbxTableSummaryEndCellComponent
];

@NgModule({
  imports: [CommonModule],
  declarations: [...exports, ...internalDeclarations],
  exports
})
export class DbxTableModule {}
