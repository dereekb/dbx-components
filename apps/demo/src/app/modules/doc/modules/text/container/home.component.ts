import { DOC_TEXT_ROUTES } from './../doc.text';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';
import { DocFeatureCardListComponent } from '../../shared/component/feature.card.list.component';

@Component({
    templateUrl: './home.component.html',
    standalone: true,
    imports: [DocFeatureCardListComponent]
})
export class DocTextHomeComponent {
  cards: DocFeatureCard[] = DOC_TEXT_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
