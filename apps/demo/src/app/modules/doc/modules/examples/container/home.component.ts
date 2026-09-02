import { DOC_EXAMPLES_ROUTES } from '../doc.examples';
import { type DocFeatureCard, DocFeatureCardListComponent } from '../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html',
  imports: [DocFeatureCardListComponent]
})
export class DocExamplesHomeComponent {
  cards: DocFeatureCard[] = DOC_EXAMPLES_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
