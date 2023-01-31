import { InfiniteScrollModule } from 'ngx-infinite-scroll';
import { DbxLoadingModule } from '@dereekb/dbx-web';
import { MatTableModule } from '@angular/material/table';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxTableItemHeaderComponent } from './table.item.header.component';
import { DbxTableViewComponent } from './table.component';
import { DbxTableInputCellComponent } from './table.cell.input.component';
import { DbxTableSummaryEndCellComponent } from './table.cell.summaryend.component';
import { DbxTableSummaryStartCellComponent } from './table.cell.summarystart.component';
import { DbxTableItemActionComponent } from './table.item.action.component';
import { DbxTableActionCellComponent } from './table.cell.action.component';
import { DbxTableItemCellComponent } from './table.item.cell.component';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxTableColumnHeaderComponent } from './table.column.header.component';
import { DbxTableDirective } from './table.directive';
import { DbxTableColumnFooterComponent } from './table.column.footer.component';

const exports = [DbxTableDirective, DbxTableViewComponent];
const internalDeclarations = [
  //
  DbxTableColumnHeaderComponent,
  DbxTableColumnFooterComponent,
  DbxTableInputCellComponent,
  DbxTableActionCellComponent,
  DbxTableItemCellComponent,
  DbxTableItemHeaderComponent,
  DbxTableItemActionComponent,
  DbxTableSummaryStartCellComponent,
  DbxTableSummaryEndCellComponent
];

@NgModule({
  imports: [
    //
    CommonModule,
    DbxLoadingModule,
    DbxInjectionComponentModule,
    MatTableModule,
    InfiniteScrollModule
  ],
  declarations: [...exports, ...internalDeclarations],
  exports
})
export class DbxTableModule {}
