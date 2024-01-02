import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DbxLoadingModule } from '@dereekb/dbx-web';
import { MatTableModule } from '@angular/material/legacy-table';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxTableDateHeaderComponent } from './date.table.column.header.component';
import { DbxTableDateRangeDayDistanceInputCellInputComponent } from './daterange.table.cell.input.component';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

const declarations = [
  //
  DbxTableDateHeaderComponent,
  DbxTableDateRangeDayDistanceInputCellInputComponent
];

@NgModule({
  imports: [
    //
    CommonModule,
    DbxLoadingModule,
    DbxInjectionComponentModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatDatepickerModule,
    MatButtonModule,
    MatTableModule
  ],
  declarations,
  exports: declarations
})
export class DbxTableDateModule {}
