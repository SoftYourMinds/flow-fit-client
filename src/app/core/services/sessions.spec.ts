import { TestBed } from '@angular/core/testing';

import { Sessions } from './sessions';

describe('Sessions', () => {
  let service: Sessions;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sessions);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
