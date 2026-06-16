import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DbxStyleDemoComponent } from '@dereekb/dbx-web/style-demo';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';

@Component({
  templateUrl: './playground.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DbxStyleDemoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExamplesPlaygroundComponent {}
