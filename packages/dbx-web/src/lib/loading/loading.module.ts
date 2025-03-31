import { NgModule } from '@angular/core';
import { DbxBasicLoadingComponent } from './basic-loading.component';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { DbxLoadingComponent } from './loading.component';
import { DbxActionLoadingContextDirective } from './loading.action.directive';

const importsAndExports = [DbxLoadingComponent, DbxBasicLoadingComponent, DbxLoadingProgressComponent, DbxActionLoadingContextDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxLoadingModule { }
