import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocActionFormWithSecondaryExampleComponent } from '../examples/action.form-with-secondary.example.component';

@Component({
  templateUrl: './action.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocActionFormWithSecondaryExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExamplesActionComponent {}
