import { ClickableAnchor } from '@dereekb/dbx-core';
import { Component, Input } from '@angular/core';
import { FlexModule } from '@ngbracket/ngx-layout/flex';
import { NgFor } from '@angular/common';
import { DbxAnchorComponent } from '@dereekb/dbx-web';
import { MatCard, MatCardHeader, MatCardTitleGroup, MatCardTitle, MatCardSubtitle, MatCardActions } from '@angular/material/card';
import { MatRipple } from '@angular/material/core';

export interface DocFeatureCard {
  title: string;
  detail?: string;
  anchor: ClickableAnchor;
}

@Component({
  selector: 'doc-feature-card-list',
  templateUrl: './feature.card.list.component.html',
  styleUrls: ['./feature.card.list.component.scss'],
  standalone: true,
  imports: [FlexModule, NgFor, DbxAnchorComponent, MatCard, MatRipple, MatCardHeader, MatCardTitleGroup, MatCardTitle, MatCardSubtitle, MatCardActions]
})
export class DocFeatureCardListComponent {
  @Input()
  cards: DocFeatureCard[] = [];
}
