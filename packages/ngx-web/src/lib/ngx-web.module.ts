import { BrowserModule } from '@angular/platform-browser';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { NgModule } from '@angular/core';
import { DbNgxButtonModule } from './button';
import { DbNgxActionModule } from './action';

@NgModule({
  exports: [
    DbNgxButtonModule,
    DbNgxActionModule,
  ],
})
export class NgxWebModule { }

@NgModule({
  imports: [
    BrowserModule,
    NgxWebModule,
    MatProgressButtonsModule.forRoot()
  ],
  exports: [
    NgxWebModule
  ]
})
export class DbNgxSharedWebModule { }
