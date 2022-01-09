import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppErrorComponent } from './error.component';
import { AppLoadingErrorDirective } from './error.loading.directive';
import { DbNgxActionErrorDirective } from './error.action.directive';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    AppErrorComponent,
    AppLoadingErrorDirective,
    DbNgxActionErrorDirective
  ],
  exports: [
    AppErrorComponent,
    AppLoadingErrorDirective,
    DbNgxActionErrorDirective
  ]
})
export class AppErrorModule { }
