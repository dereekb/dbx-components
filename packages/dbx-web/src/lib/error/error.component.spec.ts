import { TestBed, waitForAsync } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ErrorInput } from '@dereekb/util';
import { DbxErrorComponent } from './error.component';

describe('ReadableErrorComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));

  it('should render', () => {
    // TODO

    expect(true).toBe(true);
  });
});

@Component({
  template: `
    <dbx-error [error]="error"></dbx-error>
  `,
  standalone: true,
  imports: [DbxErrorComponent]
})
class ErrorComponent {
  error?: ErrorInput;
}
