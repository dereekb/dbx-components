import { MatDialogModule } from '@angular/material/dialog';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxActionFormDirective } from './form.action.directive';

@NgModule({
  imports: [
    CommonModule,
    MatDialogModule
  ],
  declarations: [
    DbxActionFormDirective
  ],
  exports: [
    DbxActionFormDirective
  ]
})
export class DbxFormlyActionModule { }
