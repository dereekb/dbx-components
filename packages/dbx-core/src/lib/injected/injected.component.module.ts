import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponent } from './injected.component';
import { DbxInjectionContextDirective } from './injected.context.component';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
    DbxInjectionComponent,
    DbxInjectionContextDirective
  ],
  exports: [
    DbxInjectionComponent,
    DbxInjectionContextDirective
  ],
})
export class DbxInjectionComponentModule { }
