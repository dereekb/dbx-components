import { DOC_FORM_ROUTES } from '../doc.form';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html'
})
export class DocFormHomeComponent {
  cards: DocFeatureCard[] = DOC_FORM_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
