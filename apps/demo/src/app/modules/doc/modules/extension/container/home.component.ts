import { DOC_EXTENSION_ROUTES } from '../doc.extension';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';
import { DocFeatureCardListComponent } from '../../shared/component/feature.card.list.component';

@Component({
    templateUrl: './home.component.html',
    standalone: true,
    imports: [DocFeatureCardListComponent]
})
export class DocExtensionHomeComponent {
  cards: DocFeatureCard[] = DOC_EXTENSION_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
