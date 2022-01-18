import { NgModule } from '@angular/core';
import { DbNgxBasicLoadingComponent } from './basic-loading.component';
import { AppLoadingProgressComponent } from './loading-progress.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppLoadingComponent } from './loading.component';
import { BrowserModule } from '@angular/platform-browser';
import { DbNgxReadableErrorModule } from '../error';

@NgModule({
  imports: [
    BrowserModule,
    DbNgxReadableErrorModule,
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
export class DbNgxLoadingModule { }
