import { Component, Input, ViewChild } from '@angular/core';
import { AbstractAnchorDirective } from '../anchor/anchor.directive';
import { ClickableAnchorLink } from '@/app/common/nav/anchor/anchor';

@Component({
  selector: 'app-side-nav-bar-item',
  templateUrl: './side.item.component.html',
  styleUrls: ['./side.scss']
})
export class AppSideNavBarItemComponent extends AbstractAnchorDirective<ClickableAnchorLink> {

  @Input()
  last: boolean;

}
