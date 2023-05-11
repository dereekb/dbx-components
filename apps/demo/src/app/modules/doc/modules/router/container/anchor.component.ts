import { Component } from '@angular/core';
import { ClickableAnchor, ClickableAnchorLink, ClickableIconAnchorLink } from '@dereekb/dbx-core';
import { LOREM } from '../../shared';

@Component({
  templateUrl: './anchor.component.html'
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
