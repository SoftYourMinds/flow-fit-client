import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Location, LocationsService } from './locations.service';
import { WORKOUT_TYPE_OPTIONS } from '../constants/workout-types.constant';

describe('LocationsService', () => {
  let service: LocationsService;

  const mockLocations: Location[] = [
    { id: 10, name: 'Studio A', type: 'STUDIO' },
    { id: 25, name: 'Wisewell_kyiv', type: 'GYM' },
  ];

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LocationsService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return null when no locations are provided', () => {
    expect(service.resolveDefaultLocationId([])).toBeNull();
  });

  it('should fallback to the first location when nothing is stored', () => {
    expect(service.resolveDefaultLocationId(mockLocations)).toBe(10);
  });

  it('should persist and resolve the last selected location', () => {
    service.saveLastSelectedLocationId(25);

    expect(service.getLastSelectedLocationId()).toBe(25);
    expect(service.resolveDefaultLocationId(mockLocations)).toBe(25);
  });

  it('should fallback to the first location if the stored location no longer exists', () => {
    service.saveLastSelectedLocationId(999);

    expect(service.resolveDefaultLocationId(mockLocations)).toBe(10);
  });

  it('should ignore invalid values stored in localStorage', () => {
    localStorage.setItem('flowfit-last-location-id', 'not-a-number');

    expect(service.getLastSelectedLocationId()).toBeNull();
    expect(service.resolveDefaultLocationId(mockLocations)).toBe(10);
  });
});

describe('WORKOUT_TYPE_OPTIONS', () => {
  it('should include reformer full and reformer mix and exclude power and yoga', () => {
    const options: readonly string[] = WORKOUT_TYPE_OPTIONS;

    expect(options).toContain('reformer full');
    expect(options).toContain('reformer mix');
    expect(options).not.toContain('power');
    expect(options).not.toContain('yoga');
  });
});
