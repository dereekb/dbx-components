import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectedComponent } from './injected.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxInjectedComponent
  ],
  exports: [
    DbxInjectedComponent
  ],
})
export class DbxInjectedComponentModule { }
