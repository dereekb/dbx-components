import { NgModule } from '@angular/core';
import { DbxBasicLoadingComponent } from './basic-loading.component';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { DbxLoadingComponent } from './loading.component';
import { DbxActionLoadingContextDirective } from './loading.action.directive';

const importsAndExports = [DbxLoadingComponent, DbxBasicLoadingComponent, DbxLoadingProgressComponent, DbxActionLoadingContextDirective];

/**
 * Convenience NgModule that imports and exports all loading-related components and directives.
 *
 * Includes {@link DbxLoadingComponent}, {@link DbxBasicLoadingComponent},
 * {@link DbxLoadingProgressComponent}, and {@link DbxActionLoadingContextDirective}.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxLoadingModule {}
