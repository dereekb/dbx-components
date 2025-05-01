import { DOC_ROUTER_ROUTES } from './../doc.router';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';
import { DocFeatureCardListComponent } from '../../shared/component/feature.card.list.component';

@Component({
    templateUrl: './home.component.html',
    standalone: true,
    imports: [DocFeatureCardListComponent]
})
export class DocRouterHomeComponent {
  cards: DocFeatureCard[] = DOC_ROUTER_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
