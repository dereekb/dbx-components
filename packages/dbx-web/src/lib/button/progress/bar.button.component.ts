import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractProgressButtonDirective } from './base.progress.button.directive';

@Component({
  selector: 'dbx-bar-button',
  templateUrl: './bar.button.component.html',
  styleUrls: ['./bar.button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxBarButtonComponent extends AbstractProgressButtonDirective {}
