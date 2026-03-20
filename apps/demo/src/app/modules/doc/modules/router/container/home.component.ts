import { DOC_ROUTER_ROUTES } from './../doc.router';
import { type DocFeatureCard, DocFeatureCardListComponent } from './../../shared/component/feature.card.list.component';
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  templateUrl: './home.component.html',
  standalone: true,
  imports: [DocFeatureCardListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocRouterHomeComponent {
  cards: DocFeatureCard[] = DOC_ROUTER_ROUTES.map((anchor) => ({
    title: anchor.title,
    detail: anchor.detail,
    anchor
  }));
}
