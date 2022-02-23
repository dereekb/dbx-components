import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbxTwoColumnLayoutModule } from './two.column.module';
import { ProvideTwoColumnsContext } from './two.column.store';


describe('DbxTwoColumnsComponent', () => {

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
    <dbx-two-columns>
      <ng-container left>
        <p>Left Content</p>
      </ng-container>
      <div right>
        <p>Right Content</p>
      </div>
    </dbx-two-columns>
  `,
  providers: ProvideTwoColumnsContext()
})
class TwoColumnsTestComponent { }
