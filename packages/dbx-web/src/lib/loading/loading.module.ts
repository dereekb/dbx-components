import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxBasicLoadingComponent } from './basic-loading.component';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DbxLoadingComponent } from './loading.component';
import { DbxReadableErrorModule } from '../error';
import { DbxActionLoadingContextDirective } from './loading.action.directive';

const declarations = [DbxLoadingComponent, DbxBasicLoadingComponent, DbxLoadingProgressComponent, DbxActionLoadingContextDirective];

@NgModule({
  imports: [CommonModule, DbxReadableErrorModule, MatProgressSpinnerModule, MatProgressBarModule],
  declarations,
  exports: [...declarations, MatProgressSpinnerModule, MatProgressBarModule]
})
export class DbxLoadingModule {}
