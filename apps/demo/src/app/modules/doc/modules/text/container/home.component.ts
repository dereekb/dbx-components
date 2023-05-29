import { DOC_TEXT_ROUTES } from './../doc.text';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html'
})
export class DocTextHomeComponent {
  cards: DocFeatureCard[] = DOC_TEXT_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
