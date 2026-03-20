import { DOC_EXTENSION_ROUTES } from '../doc.extension';
import { type DocFeatureCard, DocFeatureCardListComponent } from './../../shared/component/feature.card.list.component';
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DocFeatureCardListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionHomeComponent {
  cards: DocFeatureCard[] = DOC_EXTENSION_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
