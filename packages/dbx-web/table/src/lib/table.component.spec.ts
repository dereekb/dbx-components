import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbxTableViewComponent } from './table.component';
import { DbxTableStore } from './table.store';

describe('DbxTableViewComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

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
  imports: [DbxTableViewComponent],
  providers: [DbxTableStore]
})
class TableTestComponent {}
