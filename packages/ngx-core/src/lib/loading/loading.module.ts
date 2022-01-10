import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbNgxBasicLoadingComponent } from './basic-loading.component';
import { AppLoadingProgressComponent } from './loading-progress.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppLoadingComponent } from './loading.component';
import { AppErrorModule } from '../error/error.module';

@NgModule({
  imports: [
    CommonModule,
    AppErrorModule,
    MatProgressSpinnerModule,
    MatProgressBarModule
  ],
  declarations: [
    AppLoadingComponent,
    DbNgxBasicLoadingComponent,
    AppLoadingProgressComponent
  ],
  exports: [
    AppLoadingComponent,
    DbNgxBasicLoadingComponent,
    AppLoadingProgressComponent,
    MatProgressSpinnerModule,
    MatProgressBarModule
  ]
})
export class AppLoadingModule { }
