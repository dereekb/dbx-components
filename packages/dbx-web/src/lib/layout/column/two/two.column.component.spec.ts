import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbxTwoColumnComponent } from './two.column.component';
import { provideTwoColumnsContext } from './two.column.store';

describe('DbxTwoColumnComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));

  let fixture: ComponentFixture<TwoColumnsTestComponent>;
  let component: TwoColumnsTestComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(TwoColumnsTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

@Component({
  template: `
    <dbx-two-column>
      <ng-container left>
        <p>Left Content</p>
      </ng-container>
      <div right>
        <p>Right Content</p>
      </div>
    </dbx-two-column>
  `,
  standalone: true,
  imports: [DbxTwoColumnComponent],
  providers: provideTwoColumnsContext()
})
class TwoColumnsTestComponent {}
