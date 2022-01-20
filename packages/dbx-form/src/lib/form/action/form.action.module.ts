import { MatDialogModule } from '@angular/material/dialog';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbNgxActionFormDirective } from './form.action.directive';

@NgModule({
  imports: [
    CommonModule,
    MatDialogModule
  ],
  declarations: [
    DbNgxActionFormDirective
  ],
  exports: [
    DbNgxActionFormDirective
  ]
})
export class DbNgxFormlyActionModule { }
