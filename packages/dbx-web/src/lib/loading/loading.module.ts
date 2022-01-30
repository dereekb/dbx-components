import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxBasicLoadingComponent } from './basic-loading.component';
import { DbNgxLoadingProgressComponent } from './loading-progress.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DbNgxLoadingComponent } from './loading.component';
import { DbNgxReadableErrorModule } from '../error';

@NgModule({
  imports: [
    CommonModule,
    DbNgxReadableErrorModule,
    MatProgressSpinnerModule,
    MatProgressBarModule
  ],
  declarations: [
    DbNgxLoadingComponent,
    DbNgxBasicLoadingComponent,
    DbNgxLoadingProgressComponent
  ],
  exports: [
    DbNgxLoadingComponent,
    DbNgxBasicLoadingComponent,
    DbNgxLoadingProgressComponent,
    MatProgressSpinnerModule,
    MatProgressBarModule
  ]
})
export class DbNgxLoadingModule { }
