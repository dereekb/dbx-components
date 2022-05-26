import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ErrorInput } from '@dereekb/util';
import { DbxReadableErrorModule } from './error.module';

describe('ReadableErrorComponent', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DbxReadableErrorModule],
      declarations: [ErrorComponent]
    }).compileComponents();
  });

  it('should render', () => {
    // TODO

    expect(true).toBe(true);
  });
});

@Component({
  template: `
    <dbx-error [error]="error"></dbx-error>
  `
})
class ErrorComponent {
  error?: ErrorInput;
}
