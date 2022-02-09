import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormRepeatTypeComponent } from './array.field.component';
import { DbxButtonModule } from '@dereekb/dbx-web';

@NgModule({
  imports: [
    CommonModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatDividerModule,
    DbxButtonModule,
    FormlyModule.forChild({
      types: [
        { name: 'repeat', component: DbxFormRepeatTypeComponent }
      ]
    })
  ],
  declarations: [
    DbxFormRepeatTypeComponent
  ],
  exports: []
})
export class DbxFormFormlyArrayFieldModule { }
