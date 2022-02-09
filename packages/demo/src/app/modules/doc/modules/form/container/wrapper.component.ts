import { Component } from '@angular/core';
import { expandableWrapper, nameField, sectionWrapper, subsectionWrapper, toggleWrapper } from '@dereekb/dbx-form';
import { FormlyFieldConfig } from '@ngx-formly/core';

@Component({
  templateUrl: './wrapper.component.html'
})
export class DocFormWrapperComponent {

  expandableFieldValue: any;
  readonly expandableField: FormlyFieldConfig[] = [
    nameField(),
    expandableWrapper(nameField(), {
      expandLabel: 'Add Name'
    })
  ];

  toggleFieldValue: any;
  readonly toggleField: FormlyFieldConfig[] = [
    toggleWrapper(nameField())
  ];

  sectionFieldValue: any;
  readonly sectionField: FormlyFieldConfig[] = [
    sectionWrapper(nameField(), {
      header: 'Header',
      hint: 'Section Field Hint'
    })
  ];

  subsectionFieldValue: any;
  readonly subsectionField: FormlyFieldConfig[] = [
    subsectionWrapper(nameField(), {
      header: 'Header',
      hint: 'Section Field Hint'
    })
  ];

}
