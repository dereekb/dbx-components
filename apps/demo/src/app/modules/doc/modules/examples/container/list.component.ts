import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocListStandardExampleComponent } from '../examples/list.standard.example.component';
import { DocListProgressExampleComponent } from '../examples/list.progress.example.component';
import { DocListAnchorButtonExampleComponent } from '../examples/list.anchor-button.example.component';
import { DocListAnchorRowModifierExampleComponent } from '../examples/list.anchor-row-modifier.example.component';

@Component({
  templateUrl: './list.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocListStandardExampleComponent, DocListProgressExampleComponent, DocListAnchorButtonExampleComponent, DocListAnchorRowModifierExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExamplesListComponent {}
