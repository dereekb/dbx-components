import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DbxFormSearchFormComponent } from './search.form.component';
import { DbxFormlyModule } from '../formly.module';
import { DbxFormModule } from '../../form/form.module';
import { DbxFormFormlyFieldModule } from '../field';

@NgModule({
  imports: [CommonModule, DbxFormModule, DbxFormlyModule, DbxFormFormlyFieldModule],
  declarations: [DbxFormSearchFormComponent],
  exports: [DbxFormSearchFormComponent]
})
export class DbxFormFormlyFormModule {}
