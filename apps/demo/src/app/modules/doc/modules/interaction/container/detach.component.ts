import { Component, ChangeDetectionStrategy } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxDetachOutletComponent, DbxDetachInitDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DocInteractionExampleDetachContentComponent } from '../component/interaction.detach.content.component';

@Component({
  templateUrl: './detach.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxDetachOutletComponent, DbxDetachInitDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocInteractionDetachComponent {
  readonly detachConfig: DbxInjectionComponentConfig = {
    componentClass: DocInteractionExampleDetachContentComponent
  };
}
