import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ErrorInput } from '@dereekb/util';
import { ReadableErrorModule } from './error.module';

describe('ReadableErrorComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ReadableErrorModule],
      declarations: [ErrorComponent]
    }).compileComponents();
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
