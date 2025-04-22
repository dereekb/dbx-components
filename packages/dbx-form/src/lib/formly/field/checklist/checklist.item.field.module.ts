import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxFormFormlyWrapperModule } from '../wrapper/form.wrapper.module';
import { DbxChecklistItemContentComponent, DbxChecklistItemFieldComponent } from './checklist.item.field.component';
import { DbxDefaultChecklistItemFieldDisplayComponent } from './checklist.item.field.content.default.component';

const importsAndExports = [DbxChecklistItemFieldComponent, DbxChecklistItemContentComponent, DbxDefaultChecklistItemFieldDisplayComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    DbxFormFormlyWrapperModule,
    FormlyModule.forChild({
      types: [{ name: 'checklistitem', component: DbxChecklistItemFieldComponent }]
    })
  ],
  exports: [DbxFormFormlyWrapperModule]
})
export class DbxFormFormlyChecklistItemFieldModule {}
