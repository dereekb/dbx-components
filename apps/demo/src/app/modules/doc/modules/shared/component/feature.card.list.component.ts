import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component, Input } from '@angular/core';

export interface DocFeatureCard {
  title: string;
  detail?: string;
  anchor: ClickableAnchor;
}

@Component({
  selector: 'doc-feature-card-list',
  templateUrl: './feature.card.list.component.html',
  styleUrls: ['./feature.card.list.component.scss']
})
export class DocFeatureCardListComponent {
  @Input()
  cards: DocFeatureCard[] = [];
}
