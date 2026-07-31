import { calculateDistanceMeters } from './geo.utils';

describe('Geo Utils', () => {
  it('should calculate distance correctly between two points', () => {
    // Coordinates for Hanoi
    const lat1 = 21.0285;
    const lon1 = 105.8542;

    // Coordinates for Ho Chi Minh City
    const lat2 = 10.8231;
    const lon2 = 106.6297;

    // Expected distance is approximately 1139 km
    const distance = calculateDistanceMeters(lat1, lon1, lat2, lon2);
    expect(distance).toBeGreaterThan(1130000);
    expect(distance).toBeLessThan(1150000);
  });

  it('should return 0 for same coordinates', () => {
    const lat = 21.0285;
    const lon = 105.8542;
    const distance = calculateDistanceMeters(lat, lon, lat, lon);
    expect(distance).toBe(0);
  });
});
