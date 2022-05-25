import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbxTwoColumnLayoutModule } from './two.column.module';
import { provideTwoColumnsContext } from './two.column.store';


describe('DbxTwoColumnComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DbxTwoColumnLayoutModule],
      declarations: [TwoColumnsTestComponent]
    }).compileComponents();
  });

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
  providers: provideTwoColumnsContext()
})
class TwoColumnsTestComponent { }
