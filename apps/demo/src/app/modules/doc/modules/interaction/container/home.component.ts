import { DOC_INTERACTION_ROUTES } from '../doc.interaction';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html'
})
export class DocInteractionHomeComponent {

  cards: DocFeatureCard[] = DOC_INTERACTION_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));

}
