import { DOC_TEXT_ROUTES } from './../doc.text';
import { type DocFeatureCard, DocFeatureCardListComponent } from './../../shared/component/feature.card.list.component';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DocFeatureCardListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocTextHomeComponent {
  cards: DocFeatureCard[] = DOC_TEXT_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
