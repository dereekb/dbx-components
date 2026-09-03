import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocActionFormWithSecondaryExampleComponent } from '../examples/action.form-with-secondary.example.component';

@Component({
  templateUrl: './action.component.html',
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocActionFormWithSecondaryExampleComponent]
})
export class DocExamplesActionComponent {}
