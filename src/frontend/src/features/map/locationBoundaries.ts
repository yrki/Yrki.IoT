import type { LocationBoundary, LocationDto, SensorListItemDto } from '../../api/api';

export function isPointInPolygon(
  longitude: number,
  latitude: number,
  polygon: LocationBoundary,
): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersects = ((yi > latitude) !== (yj > latitude))
      && (longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function getDevicesInsideBoundary(
  devices: SensorListItemDto[],
  boundary: LocationBoundary,
): SensorListItemDto[] {
  return devices.filter((device) =>
    device.latitude != null
    && device.longitude != null
    && isPointInPolygon(device.longitude, device.latitude, boundary));
}

/**
 * Stable hue derived from a location id so each polygon keeps the same color
 * across renders without storing extra state.
 */
function hashLocationId(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface LocationPolygonStyle {
  fill: string;
  stroke: string;
}

function hexToRgba(hex: string, alpha: number): string | null {
  const match = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!match) {
    return null;
  }
  const value = match[1];
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function normalizeHex(hex: string): string | null {
  const match = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!match) {
    return null;
  }
  return `#${match[1].toLowerCase()}`;
}

export function getLocationPolygonStyle(
  locationId: string,
  customColor: string | null = null,
): LocationPolygonStyle {
  if (customColor) {
    const fill = hexToRgba(customColor, 0.32);
    const stroke = normalizeHex(customColor);
    if (fill && stroke) {
      return { fill, stroke };
    }
  }

  const hue = hashLocationId(locationId) % 360;
  return {
    fill: `hsla(${hue}, 70%, 55%, 0.28)`,
    stroke: `hsla(${hue}, 75%, 38%, 0.9)`,
  };
}

export function locationsWithBoundary(locations: LocationDto[]): LocationDto[] {
  return locations.filter((location) => Array.isArray(location.boundary) && location.boundary.length >= 3);
}
