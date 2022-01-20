import { MatToolbarModule } from '@angular/material/toolbar';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxFlagComponent } from './flag.component';
import { DbNgxFlagPromptComponent } from './flag.prompt.component';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule,
    MatToolbarModule
  ],
  declarations: [
    DbNgxFlagComponent,
    DbNgxFlagPromptComponent
  ],
  exports: [
    DbNgxFlagComponent,
    DbNgxFlagPromptComponent
  ]
})
export class DbNgxFlagLayoutModule { }
