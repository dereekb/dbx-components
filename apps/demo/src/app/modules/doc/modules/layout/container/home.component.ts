import { DocFeatureCard, DocFeatureCardListComponent } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';
import { DOC_LAYOUT_ROUTES } from '../doc.layout';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DocFeatureCardListComponent]
})
export class DocLayoutHomeComponent {
  cards: DocFeatureCard[] = DOC_LAYOUT_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
