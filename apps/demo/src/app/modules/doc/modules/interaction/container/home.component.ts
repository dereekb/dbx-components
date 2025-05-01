import { DOC_INTERACTION_ROUTES } from '../doc.interaction';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';
import { DocFeatureCardListComponent } from '../../shared/component/feature.card.list.component';

@Component({
    templateUrl: './home.component.html',
    standalone: true,
    imports: [DocFeatureCardListComponent]
})
export class DocInteractionHomeComponent {
  cards: DocFeatureCard[] = DOC_INTERACTION_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
