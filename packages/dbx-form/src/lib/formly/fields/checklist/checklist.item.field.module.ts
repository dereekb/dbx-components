import { MatRippleModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DbxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';
import { MatButtonModule } from '@angular/material/button';
import { DbxAnchorModule, DbxTextModule } from '@dereekb/dbx-web';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormWrapperModule } from '../wrappers/form.wrapper.module';
import { DbxChecklistItemContentComponent, DbxChecklistItemFieldComponent } from './checklist.item.field.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [
    CommonModule,
    DbxTextModule,
    FormsModule,
    ReactiveFormsModule,
    MatRippleModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    DbxAnchorModule,
    DbxFormWrapperModule,
    FormlyModule.forChild({
      types: [
        { name: 'checklistitem', component: DbxChecklistItemFieldComponent }
      ]
    })
  ],
  declarations: [
    DbxChecklistItemFieldComponent,
    DbxChecklistItemContentComponent,
    DbxDefaultChecklistItemFieldDisplayComponent
  ],
  exports: [
    DbxFormWrapperModule
  ]
})
export class DbxFormChecklistItemFieldModule { }
