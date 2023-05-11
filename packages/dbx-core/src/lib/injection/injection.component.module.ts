import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxAsyncPipeModule } from '../pipe/async/async.pipe.module';
import { DbxInjectionArrayComponent } from './injection.array.component';
import { DbxInjectionComponent } from './injection.component';
import { DbxInjectionContextDirective } from './injection.context.directive';

const declarations = [DbxInjectionComponent, DbxInjectionArrayComponent, DbxInjectionContextDirective];

@NgModule({
  imports: [CommonModule, DbxAsyncPipeModule],
  declarations,
  exports: declarations
})
export class DbxInjectionComponentModule {}
