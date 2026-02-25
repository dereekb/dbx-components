import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbxTableViewComponent } from './table.component';
import { DbxTableStore } from './table.store';

describe('DbxTableViewComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));

  let fixture: ComponentFixture<TableTestComponent>;
  let component: TableTestComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(TableTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

@Component({
  template: `
    <dbx-table-view></dbx-table-view>
  `,
  standalone: true,
  imports: [DbxTableViewComponent],
  providers: [DbxTableStore]
})
class TableTestComponent {}
