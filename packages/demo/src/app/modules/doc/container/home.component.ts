import { DOC_ROUTES } from './../doc';
import { Component } from '@angular/core';
import { DocFeatureCard } from '../modules/shared/component/feature.card.list.component';

@Component({
  templateUrl: './home.component.html'
})
export class DocHomeComponent {

  cards: DocFeatureCard[] = DOC_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));

}
