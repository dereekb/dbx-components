import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxInjectedComponent } from './injected.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbNgxInjectedComponent
  ],
  exports: [
    DbNgxInjectedComponent
  ],
})
export class DbNgxInjectedComponentModule { }
