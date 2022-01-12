import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { UIRouterModule } from '@uirouter/angular';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { DbNgxButtonComponent } from './button.component';
import { AppButtonSegueDirective } from './button.segue.directive';
import { DbNgxLoadingButtonDirective } from './button.loading.directive';
import { DbNgxButtonSpacerComponent } from './button.spacer.component';

@NgModule({
  imports: [
    CommonModule,
    UIRouterModule,
    MatIconModule,
    MatButtonModule,
    MatProgressButtonsModule
  ],
  declarations: [
    DbNgxButtonComponent,
    AppButtonSegueDirective,
    DbNgxLoadingButtonDirective,
    DbNgxButtonSpacerComponent
  ],
  exports: [
    DbNgxButtonComponent,
    AppButtonSegueDirective,
    DbNgxLoadingButtonDirective,
    DbNgxButtonSpacerComponent
  ],
})
export class DbNgxButtonModule {}
