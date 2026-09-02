import { DOC_AUTH_ROUTES } from '../doc.auth';
import { type DocFeatureCard, DocFeatureCardListComponent } from './../../shared/component/feature.card.list.component';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html',
  imports: [DocFeatureCardListComponent]
})
export class DocAuthHomeComponent {
  cards: DocFeatureCard[] = DOC_AUTH_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
