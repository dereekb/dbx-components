import { DOC_AUTH_ROUTES } from '../doc.auth';
import { DocFeatureCard } from './../../shared/component/feature.card.list.component';
import { Component } from '@angular/core';
import { DocFeatureCardListComponent } from '../../shared/component/feature.card.list.component';

@Component({
    templateUrl: './home.component.html',
    standalone: true,
    imports: [DocFeatureCardListComponent]
})
export class DocAuthHomeComponent {
  cards: DocFeatureCard[] = DOC_AUTH_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
