import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponent } from './injection.component';
import { DbxInjectionContextDirective } from './injection.context.component';

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
