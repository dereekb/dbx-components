import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocSupportPageLayoutExampleComponent } from '../examples/support.page.layout.example.component';

@Component({
  templateUrl: './layout-examples.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocSupportPageLayoutExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExamplesLayoutExamplesComponent {}
