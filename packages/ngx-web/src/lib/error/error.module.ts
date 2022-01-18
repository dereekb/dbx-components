import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbNgxReadableErrorComponent } from './error.component';
import { AppLoadingErrorDirective } from './error.loading.directive';
import { DbNgxActionErrorDirective } from './error.action.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxReadableErrorComponent,
    AppLoadingErrorDirective,
    DbNgxActionErrorDirective
  ],
  exports: [
    DbNgxReadableErrorComponent,
    AppLoadingErrorDirective,
    DbNgxActionErrorDirective
  ]
})
export class DbNgxReadableErrorModule { }
