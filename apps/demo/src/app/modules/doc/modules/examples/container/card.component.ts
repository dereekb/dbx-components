import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocHeroCardExampleComponent } from '../examples/hero.card.example.component';
import { DocSupportBannerCardExampleComponent } from '../examples/support.banner.card.example.component';
import { DocFeedbackSelectionCardExampleComponent } from '../examples/feedback.selection.card.example.component';
import { DocHorizontalCardExampleComponent } from '../examples/horizontal.card.example.component';

@Component({
  templateUrl: './card.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocHeroCardExampleComponent, DocSupportBannerCardExampleComponent, DocFeedbackSelectionCardExampleComponent, DocHorizontalCardExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExamplesCardComponent {}
