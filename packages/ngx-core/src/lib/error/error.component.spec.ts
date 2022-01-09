import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ErrorInput } from '@gae-web/appengine-utility';
import { AppErrorModule } from './error.module';

describe('AppErrorComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AppErrorModule],
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

  public error: ErrorInput;

}
