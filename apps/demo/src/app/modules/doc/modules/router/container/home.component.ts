import { DOC_ROUTER_ROUTES } from './../doc.router';
import { DocFeatureCard, DocFeatureCardListComponent } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';

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
