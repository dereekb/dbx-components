import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ErrorInput } from './error';
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
    <app-error [error]="error"></app-error>
  `
})
class ErrorComponent {

  error?: ErrorInput;

}
