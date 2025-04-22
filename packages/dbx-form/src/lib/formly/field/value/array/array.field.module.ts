import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormRepeatArrayTypeComponent } from './array.field.component';
import { DbxButtonModule, DbxSectionLayoutModule, DbxBarLayoutModule } from '@dereekb/dbx-web';
import { MatButtonModule } from '@angular/material/button';
import { DragDropModule } from '@angular/cdk/drag-drop';

const importsAndExports = [DbxFormRepeatArrayTypeComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'repeatarray', component: DbxFormRepeatArrayTypeComponent }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyArrayFieldModule {}
