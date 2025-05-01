import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  imports: [UIView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DemoGuestbookLayoutComponent {}
