import { Component } from '@angular/core';
import { ClickableAnchor, ClickableAnchorLink, ClickableIconAnchorLink } from '@dereekb/dbx-core';
import { LOREM } from '../../shared';
import { DbxContentContainerDirective, DbxAnchorComponent, DbxAnchorContentComponent, DbxAnchorIconComponent, DbxLinkComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardHeader, MatCardTitleGroup, MatCardTitle, MatCardSubtitle, MatCardSmImage, MatCardContent, MatCardActions } from '@angular/material/card';
import { MatRipple } from '@angular/material/core';

@Component({
  templateUrl: './anchor.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxAnchorComponent, MatButton, MatCard, MatRipple, MatCardHeader, MatCardTitleGroup, MatCardTitle, MatCardSubtitle, MatCardSmImage, MatCardContent, MatCardActions, DbxAnchorContentComponent, DbxAnchorIconComponent, DbxLinkComponent]
})
export class DocRouterAnchorComponent {
  lorem = LOREM;
  mouse = '';

  link: ClickableAnchorLink = {
    icon: 'home',
    title: 'Link To Current Page',
    ref: '.',
    target: '_blank'
  };

  url: ClickableAnchor = {
    url: 'https://github.com/dereekb/dbx-components',
    target: '_blank'
  };

  ref: ClickableAnchor = {
    ref: '.',
    target: '_blank'
  };

  icon: ClickableIconAnchorLink = {
    ...this.ref,
    icon: 'route'
  };

  fun: ClickableAnchor = {
    onClick: () => {
      if (this.lorem === LOREM) {
        this.lorem = 'Click did something!';
      } else {
        this.lorem = LOREM;
      }
    }
  };

  mouseOverWithClick: ClickableAnchor = {
    onClick: () => {
      this.mouse = 'Clicked mouse button.';
    },
    onMouse: (type) => {
      this.mouse = `Mouse over ${type}`;
    }
  };
}
