import { DOC_BUGS_ROUTES } from '../doc.bugs';
import { type DocFeatureCard, DocFeatureCardListComponent } from '../../shared/component/feature.card.list.component';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DocFeatureCardListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocBugsHomeComponent {
  cards: DocFeatureCard[] = DOC_BUGS_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
