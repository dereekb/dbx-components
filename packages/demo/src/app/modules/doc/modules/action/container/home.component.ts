import { DOC_ACTION_ROUTES } from '../doc.action';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html'
})
export class DocActionHomeComponent {

  cards: DocFeatureCard[] = DOC_ACTION_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));

}
