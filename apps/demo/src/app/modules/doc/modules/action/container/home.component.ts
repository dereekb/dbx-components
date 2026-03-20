import { DOC_ACTION_ROUTES } from '../doc.action';
import { type DocFeatureCard, DocFeatureCardListComponent } from './../../shared/component/feature.card.list.component';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxSectionComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DbxSectionComponent, DocFeatureCardListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocActionHomeComponent {
  cards: DocFeatureCard[] = DOC_ACTION_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
