import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxReadableErrorComponent } from './error.component';
import { DbxLoadingErrorDirective } from './error.loading.directive';
import { DbxActionErrorDirective } from './error.action.directive';

@NgModule({
  imports: [CommonModule],
  declarations: [DbxReadableErrorComponent, DbxLoadingErrorDirective, DbxActionErrorDirective],
  exports: [DbxReadableErrorComponent, DbxLoadingErrorDirective, DbxActionErrorDirective]
})
export class DbxReadableErrorModule {}
