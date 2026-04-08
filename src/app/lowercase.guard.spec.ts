import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { lowercaseGuard } from './lowercase.guard';

describe('lowercaseGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => lowercaseGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
