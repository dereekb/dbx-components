import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { DbxCalendarComponent } from './calendar.component';
import { DbxCalendarStore } from './calendar.store';

describe('DbxCalendarComponent', () => {
  let component: DbxCalendarComponent<any>;
  let fixture: ComponentFixture<DbxCalendarComponent<any>>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DbxCalendarComponent],
      providers: [DbxCalendarStore]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DbxCalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create', () => {
    expect(component).toBeDefined();
  });

  it('should have a calendar store', () => {
    expect(component.calendarStore).toBeDefined();
  });

  it('should have viewDate$ observable', () => {
    expect(component.viewDate$).toBeDefined();
  });

  it('should have events$ observable', () => {
    expect(component.events$).toBeDefined();
  });
});
