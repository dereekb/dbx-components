import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocHeroCardExampleComponent } from '../examples/hero.card.example.component';

@Component({
  templateUrl: './card.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocHeroCardExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExamplesCardComponent {}
