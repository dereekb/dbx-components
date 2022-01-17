import { NgModule } from '@angular/core';
import { AppAnchorComponent } from './anchor.component';
import { UIRouterModule } from '@uirouter/angular';
import { CommonModule } from '@angular/common';
import { AppAnchorIconComponent } from './anchor.icon.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@NgModule({
  imports: [
    CommonModule,
    UIRouterModule,
    MatIconModule,
    MatButtonModule,
  ],
  declarations: [
    AppAnchorComponent,
    AppAnchorIconComponent
  ],
  exports: [
    AppAnchorComponent,
    AppAnchorIconComponent
  ]
})
export class DbNgxAnchorModule { }
