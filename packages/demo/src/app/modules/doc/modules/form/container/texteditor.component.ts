import { FormlyFieldConfig } from '@ngx-formly/core';
import { Component } from '@angular/core';
import { textEditorField } from '@dereekb/dbx-form';

@Component({
  templateUrl: './texteditor.component.html'
})
export class DocFormTextEditorComponent {

  readonly textEditorField: FormlyFieldConfig[] = [
    textEditorField({
      key: 'editor',
      label: 'Text Editor'
    })
  ]

}
