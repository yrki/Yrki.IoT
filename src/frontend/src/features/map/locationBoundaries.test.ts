import { describe, expect, it } from 'vitest';
import { getDevicesInsideBoundary, getLocationPolygonStyle, isPointInPolygon } from './locationBoundaries';
import type { LocationBoundary, SensorListItemDto } from '../../api/api';

const square: LocationBoundary = [
  [10.0, 60.0],
  [10.0, 60.5],
  [10.5, 60.5],
  [10.5, 60.0],
];

function makeDevice(id: string, longitude: number | null, latitude: number | null): SensorListItemDto {
  return {
    id,
    uniqueId: id,
    name: id,
    manufacturer: null,
    type: 'Temperature',
    locationName: null,
    locationId: null,
    lastContact: '2026-04-01T00:00:00.000Z',
    installationDate: '2026-04-01T00:00:00.000Z',
    latitude,
    longitude,
  };
}

describe('isPointInPolygon', () => {
  it('Shall_return_true_for_point_inside_polygon', () => {
    // Arrange
    const longitude = 10.25;
    const latitude = 60.25;

    // Act
    const result = isPointInPolygon(longitude, latitude, square);

    // Assert
    expect(result).toBe(true);
  });

  it('Shall_return_false_for_point_outside_polygon', () => {
    // Arrange
    const longitude = 11.0;
    const latitude = 60.25;

    // Act
    const result = isPointInPolygon(longitude, latitude, square);

    // Assert
    expect(result).toBe(false);
  });

  it('Shall_return_false_for_polygon_with_fewer_than_three_vertices', () => {
    // Arrange
    const degenerate: LocationBoundary = [
      [10.0, 60.0],
      [10.5, 60.5],
    ];

    // Act
    const result = isPointInPolygon(10.25, 60.25, degenerate);

    // Assert
    expect(result).toBe(false);
  });
});

describe('getDevicesInsideBoundary', () => {
  it('Shall_return_only_devices_with_coordinates_inside_polygon', () => {
    // Arrange
    const devices = [
      makeDevice('inside', 10.25, 60.25),
      makeDevice('outside', 11.5, 60.25),
      makeDevice('missing', null, null),
    ];

    // Act
    const result = getDevicesInsideBoundary(devices, square);

    // Assert
    expect(result.map((device) => device.id)).toEqual(['inside']);
  });
});

describe('getLocationPolygonStyle', () => {
  it('Shall_return_stable_color_for_same_location_id', () => {
    // Arrange
    const id = 'aac17b14-1c9c-4f37-9b3a-49019b8b1cd1';

    // Act
    const first = getLocationPolygonStyle(id);
    const second = getLocationPolygonStyle(id);

    // Assert
    expect(first).toEqual(second);
  });

  it('Shall_return_different_colors_for_different_ids', () => {
    // Arrange
    const idA = '00000000-0000-0000-0000-000000000001';
    const idB = '00000000-0000-0000-0000-000000000002';

    // Act
    const styleA = getLocationPolygonStyle(idA);
    const styleB = getLocationPolygonStyle(idB);

    // Assert
    expect(styleA.fill).not.toEqual(styleB.fill);
  });
});
