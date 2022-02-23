import { MatToolbarModule } from '@angular/material/toolbar';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxFlagComponent } from './flag.component';
import { DbxFlagPromptComponent } from './flag.prompt.component';

/**
 * Module for block components.
 */
@NgModule({
  imports: [
    CommonModule,
    MatToolbarModule
  ],
  declarations: [
    DbxFlagComponent,
    DbxFlagPromptComponent
  ],
  exports: [
    DbxFlagComponent,
    DbxFlagPromptComponent
  ]
})
export class DbxFlagLayoutModule { }
