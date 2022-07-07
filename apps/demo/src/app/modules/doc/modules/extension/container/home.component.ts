import { DOC_EXTENSION_ROUTES } from '../doc.extension';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html'
})
export class DocExtensionHomeComponent {
  cards: DocFeatureCard[] = DOC_EXTENSION_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
