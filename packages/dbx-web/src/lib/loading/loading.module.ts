import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxBasicLoadingComponent } from './basic-loading.component';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DbxLoadingComponent } from './loading.component';
import { DbxReadableErrorModule } from '../error';
import { DbxActionLoadingContextDirective } from './loading.action.directive';

@NgModule({
  imports: [
    CommonModule,
    DbxReadableErrorModule,
    MatProgressSpinnerModule,
    MatProgressBarModule
  ],
  declarations: [
    DbxLoadingComponent,
    DbxBasicLoadingComponent,
    DbxLoadingProgressComponent,
    DbxActionLoadingContextDirective
  ],
  exports: [
    DbxLoadingComponent,
    DbxBasicLoadingComponent,
    DbxLoadingProgressComponent,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    DbxActionLoadingContextDirective
  ]
})
export class DbxLoadingModule { }
