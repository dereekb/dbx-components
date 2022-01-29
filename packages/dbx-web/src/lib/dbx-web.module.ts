import { DbNgxLoadingModule } from './loading/loading.module';
import { BrowserModule } from '@angular/platform-browser';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { NgModule } from '@angular/core';
import { DbNgxButtonModule } from './button';
import { DbNgxActionModule } from './action';

@NgModule({
  exports: [
    DbNgxButtonModule,
    DbNgxActionModule,
    DbNgxLoadingModule
  ],
})
export class DbNgxWebModule { }

@NgModule({
  imports: [
    BrowserModule,
    DbNgxWebModule,
    MatProgressButtonsModule.forRoot()
  ],
  exports: [
    DbNgxWebModule
  ]
})
export class DbNgxSharedWebModule { }
