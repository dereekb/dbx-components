import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbNgxReadableErrorComponent } from './error.component';
import { DbNgxLoadingErrorDirective } from './error.loading.directive';
import { DbNgxActionErrorDirective } from './error.action.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxReadableErrorComponent,
    DbNgxLoadingErrorDirective,
    DbNgxActionErrorDirective
  ],
  exports: [
    DbNgxReadableErrorComponent,
    DbNgxLoadingErrorDirective,
    DbNgxActionErrorDirective
  ]
})
export class DbNgxReadableErrorModule { }
