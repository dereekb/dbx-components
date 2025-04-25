import { NgModule } from '@angular/core';
import { FormlyModule } from '@ngx-formly/core';
import { DbxTextEditorFieldComponent } from './texteditor.field.component';

const importsAndExports = [DbxTextEditorFieldComponent];

@NgModule({
  imports: [
    ...importsAndExports,
    FormlyModule.forChild({
      types: [{ name: 'texteditor', component: DbxTextEditorFieldComponent }]
    })
  ],
  exports: importsAndExports
})
export class DbxFormFormlyTextEditorFieldModule {}
