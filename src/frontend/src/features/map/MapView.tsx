import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, FormControl, InputLabel, MenuItem, Select, Snackbar, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  assignDevicesToLocation,
  BuildingDto,
  createLocation,
  getBuildings,
  getDevices,
  getGateways,
  getLocations,
  LocationBoundary,
  LocationDto,
  SensorListItemDto,
  updateLocation,
} from '../../api/api';
import { clusterDevices, DeviceCluster } from './deviceClusters';
import {
  getDevicesInsideBoundary,
  getLocationPolygonStyle,
  isPointInPolygon,
  locationsWithBoundary,
} from './locationBoundaries';
import AssignBoundaryDialog, { AssignBoundarySubmitPayload } from './AssignBoundaryDialog';

const activityFadeDurationMs = 6 * 60 * 60 * 1000;
const clusterRadiusPx = 44;
const polygonZoomThreshold = 12;
const boundarySourceId = 'location-boundaries';
const boundaryFillLayerId = 'location-boundaries-fill';
const boundaryOutlineLayerId = 'location-boundaries-outline';
const boundaryVerticesSourceId = 'location-boundary-vertices';
const boundaryVerticesLayerId = 'location-boundary-vertices-layer';
const vertexHitRadiusPx = 10;
const drawingSourceId = 'map-drawing';
const drawingFillLayerId = 'map-drawing-fill';
const drawingOutlineLayerId = 'map-drawing-outline';
const drawingVerticesLayerId = 'map-drawing-vertices';

import type { MapPosition } from './MapContainer';

interface MapViewProps {
  onNavigateToSensor: (sensorId: string) => void;
  onNavigateToGateway: (gatewayId: string) => void;
  initialPosition?: MapPosition;
  onPositionChange?: (pos: MapPosition) => void;
}

type DeviceKindFilter = 'all' | 'Sensor' | 'Gateway';

function hasCoordinates(device: SensorListItemDto): boolean {
  return device.latitude != null && device.longitude != null
    && isFinite(device.latitude) && isFinite(device.longitude)
    && device.latitude >= -90 && device.latitude <= 90
    && device.longitude >= -180 && device.longitude <= 180;
}

function getSensorColor(lastContact: string, now: number): string {
  const ageMs = Math.max(0, now - new Date(lastContact).getTime());
  const progress = Math.max(0, 1 - ageMs / activityFadeDurationMs);

  if (progress <= 0) {
    return 'rgba(148, 163, 184, 0.55)';
  }

  const green = Math.round(120 + progress * 90);
  const red = Math.round(148 - progress * 88);
  return `rgba(${red}, ${green}, 105, ${0.35 + progress * 0.65})`;
}

function getGatewayColor(lastContact: string, now: number): string {
  const ageMs = Math.max(0, now - new Date(lastContact).getTime());
  const progress = Math.max(0, 1 - ageMs / activityFadeDurationMs);

  if (progress <= 0) {
    return 'rgba(148, 163, 184, 0.55)';
  }

  const blue = Math.round(120 + progress * 135);
  const red = Math.round(148 - progress * 89);
  const green = Math.round(148 - progress * 18);
  return `rgba(${red}, ${green}, ${blue}, ${0.35 + progress * 0.65})`;
}

function getActivityGlow(lastContact: string, now: number, isGateway: boolean): string {
  const ageMs = Math.max(0, now - new Date(lastContact).getTime());
  const progress = Math.max(0, 1 - ageMs / activityFadeDurationMs);

  if (progress <= 0) {
    return 'none';
  }

  const glowColor = isGateway
    ? `rgba(59, 130, 246, ${0.2 + progress * 0.4})`
    : `rgba(34, 197, 94, ${0.2 + progress * 0.4})`;
  return `0 0 ${4 + progress * 6}px ${glowColor}`;
}

function getStatusDotColor(lastContact: string, now: number): string {
  const progress = Math.max(0, 1 - Math.max(0, now - new Date(lastContact).getTime()) / activityFadeDurationMs);
  return progress <= 0 ? 'rgba(148, 163, 184, 0.75)' : 'rgba(34, 197, 94, 0.95)';
}

function formatLastContact(lastContact: string): string {
  return new Date(lastContact).toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getCoordinateKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(7)}:${longitude.toFixed(7)}`;
}

function createMarkerElement(device: SensorListItemDto, now: number): HTMLElement {
  const isGateway = device.kind === 'Gateway';
  const color = isGateway
    ? getGatewayColor(device.lastContact, now)
    : getSensorColor(device.lastContact, now);
  const glow = getActivityGlow(device.lastContact, now, isGateway);
  const innerSize = isGateway ? 12 : 10;
  const framePadding = isGateway ? 3 : 4;

  const outer = document.createElement('div');
  outer.style.width = `${innerSize + framePadding * 2}px`;
  outer.style.height = `${innerSize + framePadding * 2}px`;
  outer.style.display = 'grid';
  outer.style.placeItems = 'center';
  outer.style.backgroundColor = 'rgba(255, 255, 255, 0.96)';
  outer.style.boxShadow = glow;
  outer.style.borderRadius = isGateway ? '5px' : '999px';
  outer.style.cursor = 'pointer';
  outer.style.border = '1px solid rgba(15, 23, 42, 0.32)';

  const inner = document.createElement('div');
  inner.style.width = `${innerSize}px`;
  inner.style.height = `${innerSize}px`;
  inner.style.backgroundColor = color;
  inner.style.borderRadius = isGateway ? '2px' : '50%';
  inner.style.border = '1px solid rgba(60, 60, 70, 0.18)';

  outer.appendChild(inner);
  return outer;
}

function createClusterElement(
  deviceCount: number,
  kind: 'Sensor' | 'Gateway' | 'Mixed',
): HTMLButtonElement {
  const size = Math.min(64, 34 + Math.log2(deviceCount) * 8);
  const el = document.createElement('button');
  const isGatewayCluster = kind === 'Gateway';
  const isMixedCluster = kind === 'Mixed';

  el.type = 'button';
  el.textContent = deviceCount.toString();
  el.setAttribute('aria-label', `${deviceCount} devices`);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = isGatewayCluster ? '12px' : '50%';
  el.style.border = '2px solid rgba(15, 23, 42, 0.28)';
  el.style.background = isGatewayCluster
    ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(59, 130, 246, 0.92))'
    : isMixedCluster
      ? 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95), rgba(14, 165, 233, 0.9))'
      : 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95), rgba(22, 163, 74, 0.9))';
  el.style.boxShadow = isGatewayCluster
    ? '0 10px 24px rgba(59, 130, 246, 0.3)'
    : isMixedCluster
      ? '0 10px 24px rgba(14, 165, 233, 0.28)'
      : '0 10px 24px rgba(22, 163, 74, 0.28)';
  el.style.color = '#0f172a';
  el.style.fontFamily = 'Manrope, sans-serif';
  el.style.fontSize = deviceCount >= 100 ? '13px' : '14px';
  el.style.fontWeight = '800';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.cursor = 'pointer';
  el.style.padding = '0';

  return el;
}

function getClusterKind(cluster: DeviceCluster): 'Sensor' | 'Gateway' | 'Mixed' {
  const gatewayCount = cluster.devices.filter((device) => device.kind === 'Gateway').length;
  if (gatewayCount === 0) {
    return 'Sensor';
  }

  if (gatewayCount === cluster.devices.length) {
    return 'Gateway';
  }

  return 'Mixed';
}

function areDevicesAtExactSameLocation(devices: SensorListItemDto[]): boolean {
  if (devices.length <= 1) {
    return true;
  }

  const first = devices[0];
  if (first.latitude == null || first.longitude == null) {
    return false;
  }

  const firstKey = getCoordinateKey(first.latitude, first.longitude);
  return devices.every((device) => device.latitude != null
    && device.longitude != null
    && getCoordinateKey(device.latitude, device.longitude) === firstKey);
}

function buildLocationPopupContent(
  devices: SensorListItemDto[],
  now: number,
  onNavigateToSensor: (sensorId: string) => void,
  onNavigateToGateway: (gatewayId: string) => void,
  onClose: () => void,
): HTMLElement {
  const container = document.createElement('div');
  container.style.fontFamily = 'Manrope, sans-serif';
  container.style.fontSize = '12px';
  container.style.lineHeight = '1.5';
  container.style.color = '#1a1a2e';
  container.style.width = '360px';
  container.style.maxWidth = 'min(360px, calc(100vw - 64px))';
  container.style.boxSizing = 'border-box';
  container.style.position = 'relative';
  container.style.paddingRight = '20px';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close details');
  closeButton.textContent = '×';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '-2px';
  closeButton.style.right = '-2px';
  closeButton.style.margin = '0';
  closeButton.style.padding = '0';
  closeButton.style.border = '0';
  closeButton.style.outline = 'none';
  closeButton.style.background = 'none';
  closeButton.style.boxShadow = 'none';
  closeButton.style.color = '#64748b';
  closeButton.style.fontFamily = 'inherit';
  closeButton.style.fontSize = '20px';
  closeButton.style.lineHeight = '1';
  closeButton.style.cursor = 'pointer';
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    onClose();
  });
  container.appendChild(closeButton);

  const title = document.createElement('div');
  title.textContent = devices.length === 1 ? 'Device at this location' : `${devices.length} devices at this location`;
  title.style.fontWeight = '700';
  title.style.fontSize = '13px';
  title.style.marginBottom = '8px';
  title.style.color = '#0f172a';
  container.appendChild(title);

  const list = document.createElement('div');
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '6px';
  list.style.width = '100%';
  container.appendChild(list);

  const sortedDevices = [...devices].sort((left, right) => {
    if ((left.kind === 'Gateway') !== (right.kind === 'Gateway')) {
      return left.kind === 'Gateway' ? -1 : 1;
    }

    return left.uniqueId.localeCompare(right.uniqueId);
  });

  for (const device of sortedDevices) {
    const isGateway = device.kind === 'Gateway';
    const row = document.createElement('button');
    row.type = 'button';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = isGateway ? '1fr auto' : '12px 1fr auto';
    row.style.gap = '10px';
    row.style.alignItems = 'center';
    row.style.width = '100%';
    row.style.boxSizing = 'border-box';
    row.style.border = '1px solid rgba(148, 163, 184, 0.24)';
    row.style.borderRadius = '8px';
    row.style.background = 'rgba(248, 250, 252, 0.96)';
    row.style.padding = '8px 10px';
    row.style.cursor = 'pointer';
    row.style.textAlign = 'left';

    if (!isGateway) {
      const statusDot = document.createElement('span');
      statusDot.style.width = '10px';
      statusDot.style.height = '10px';
      statusDot.style.borderRadius = '999px';
      statusDot.style.backgroundColor = getStatusDotColor(device.lastContact, now);
      statusDot.style.boxShadow = '0 0 0 1px rgba(34, 197, 94, 0.18)';
      row.appendChild(statusDot);
    }

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.gap = '2px';

    const nameLine = document.createElement('div');
    const displayName = device.name?.trim() || device.uniqueId;
    nameLine.textContent = isGateway || !device.name?.trim()
      ? displayName
      : `${displayName} (${device.uniqueId})`;
    nameLine.style.fontSize = '12px';
    nameLine.style.fontWeight = '700';
    nameLine.style.color = '#0f172a';
    info.appendChild(nameLine);

    if (!isGateway) {
      const metaLine = document.createElement('div');
      metaLine.textContent = `${device.manufacturer ?? '-'} • ${device.type}`;
      metaLine.style.color = '#475569';
      info.appendChild(metaLine);
    }

    const statusLine = document.createElement('div');
    statusLine.textContent = `Last contact ${formatLastContact(device.lastContact)}`;
    statusLine.style.color = '#64748b';
    info.appendChild(statusLine);

    row.appendChild(info);

    const tag = document.createElement('span');
    tag.textContent = isGateway ? 'Gateway' : 'Sensor';
    tag.style.fontSize = '11px';
    tag.style.fontWeight = '700';
    tag.style.color = isGateway ? '#2563eb' : '#15803d';
    row.appendChild(tag);

    row.addEventListener('click', (event) => {
      event.stopPropagation();
      if (isGateway) {
        onNavigateToGateway(device.uniqueId);
      } else {
        onNavigateToSensor(device.uniqueId);
      }
    });

    list.appendChild(row);
  }

  return container;
}

function zoomToCluster(map: maplibregl.Map, cluster: DeviceCluster): void {
  const bounds = new maplibregl.LngLatBounds();
  for (const device of cluster.devices) {
    bounds.extend([device.longitude!, device.latitude!]);
  }

  if (bounds.isEmpty()) {
    map.easeTo({
      center: [cluster.longitude, cluster.latitude],
      zoom: Math.max(map.getZoom() + 2, 15),
      duration: 450,
    });
    return;
  }

  map.fitBounds(bounds, {
    padding: 100,
    maxZoom: 18,
    duration: 450,
  });
}

function closePolygonRing(boundary: LocationBoundary): number[][] {
  if (boundary.length === 0) {
    return boundary;
  }

  const first = boundary[0];
  const last = boundary[boundary.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return boundary;
  }

  return [...boundary, first];
}

function polygonCentroid(boundary: LocationBoundary): [number, number] {
  let lng = 0;
  let lat = 0;
  for (const [x, y] of boundary) {
    lng += x;
    lat += y;
  }
  return [lng / boundary.length, lat / boundary.length];
}

function MapView({ onNavigateToSensor, onNavigateToGateway, initialPosition, onPositionChange }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const labelMarkersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const drawingActiveRef = useRef(false);
  const drawingPointsRef = useRef<[number, number][]>([]);
  const locationsRef = useRef<LocationDto[]>([]);
  const boundaryOverridesRef = useRef<Map<string, LocationBoundary>>(new Map());
  const [devices, setDevices] = useState<SensorListItemDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const buildingMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [boundaryOverrides, setBoundaryOverrides] = useState<Map<string, LocationBoundary>>(new Map());
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [sensorsVisible, setSensorsVisible] = useState(false);
  const [kindFilter, setKindFilter] = useState<DeviceKindFilter>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [mapReady, setMapReady] = useState(false);
  const [drawingActive, setDrawingActive] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [pendingBoundary, setPendingBoundary] = useState<LocationBoundary | null>(null);
  const [enclosedDevices, setEnclosedDevices] = useState<SensorListItemDto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    drawingActiveRef.current = drawingActive;
  }, [drawingActive]);

  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);

  useEffect(() => {
    locationsRef.current = locations;
  }, [locations]);

  useEffect(() => {
    boundaryOverridesRef.current = boundaryOverrides;
  }, [boundaryOverrides]);

  const getEffectiveBoundary = useCallback(
    (location: LocationDto): LocationBoundary | null => {
      const override = boundaryOverrides.get(location.id);
      if (override) {
        return override;
      }
      return location.boundary ?? null;
    },
    [boundaryOverrides],
  );

  const manufacturers = useMemo(
    () => [...new Set(devices.map((device) => device.manufacturer).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right)),
    [devices],
  );
  const types = useMemo(
    () => [...new Set(devices.map((device) => device.type).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [devices],
  );
  const filteredDevices = useMemo(() => devices.filter((device) => {
    if (kindFilter !== 'all' && device.kind !== kindFilter) {
      return false;
    }

    if (manufacturerFilter !== 'all' && (device.manufacturer ?? '') !== manufacturerFilter) {
      return false;
    }

    if (typeFilter !== 'all' && device.type !== typeFilter) {
      return false;
    }

    return true;
  }), [devices, kindFilter, manufacturerFilter, typeFilter]);
  const devicesByCoordinate = useMemo(() => {
    const groups = new Map<string, SensorListItemDto[]>();

    for (const device of filteredDevices) {
      if (!hasCoordinates(device)) {
        continue;
      }

      const key = getCoordinateKey(device.latitude!, device.longitude!);
      const existing = groups.get(key);
      if (existing) {
        existing.push(device);
      } else {
        groups.set(key, [device]);
      }
    }

    return groups;
  }, [filteredDevices]);
  const mapViewportSignature = useMemo(() => filteredDevices
    .filter(hasCoordinates)
    .map((device) => `${device.uniqueId}:${device.latitude}:${device.longitude}`)
    .sort((left, right) => left.localeCompare(right))
    .join('|'), [filteredDevices]);

  const reloadMapData = useCallback(async () => {
    const [sensors, gateways, locs, blds] = await Promise.all([
      getDevices(), getGateways(), getLocations(), getBuildings(),
    ]);
    setDevices([...sensors, ...gateways]);
    setLocations(locs);
    setBuildings(blds);
  }, []);

  useEffect(() => {
    reloadMapData().catch((err) => console.error('Failed to fetch map data:', err));
  }, [reloadMapData]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: initialPosition?.center ?? [10.4, 63.4],
      zoom: initialPosition?.zoom ?? 5,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', () => setMapReady(true));

    if (onPositionChange) {
      const report = () => {
        const c = map.getCenter();
        onPositionChange({ center: [c.lng, c.lat], zoom: map.getZoom() });
      };
      map.on('moveend', report);
      map.on('zoomend', report);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const updateZoomState = () => {
      setSensorsVisible(map.getZoom() >= polygonZoomThreshold);
    };

    updateZoomState();
    map.on('zoomend', updateZoomState);
    return () => {
      map.off('zoomend', updateZoomState);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    if (!map.getSource(boundarySourceId)) {
      map.addSource(boundarySourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: boundaryFillLayerId,
        type: 'fill',
        source: boundarySourceId,
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: boundaryOutlineLayerId,
        type: 'line',
        source: boundarySourceId,
        paint: {
          'line-color': ['get', 'strokeColor'],
          'line-width': 2,
          'line-opacity': 0.9,
        },
      });
    }

    if (!map.getSource(boundaryVerticesSourceId)) {
      map.addSource(boundaryVerticesSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: boundaryVerticesLayerId,
        type: 'circle',
        source: boundaryVerticesSourceId,
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-color': ['get', 'strokeColor'],
          'circle-stroke-width': 2,
        },
      });
    }

    if (!map.getSource(drawingSourceId)) {
      map.addSource(drawingSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: drawingFillLayerId,
        type: 'fill',
        source: drawingSourceId,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': '#0ea5e9',
          'fill-opacity': 0.18,
        },
      });
      map.addLayer({
        id: drawingOutlineLayerId,
        type: 'line',
        source: drawingSourceId,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#0ea5e9',
          'line-width': 2,
          'line-dasharray': [2, 1],
        },
      });
      map.addLayer({
        id: drawingVerticesLayerId,
        type: 'circle',
        source: drawingSourceId,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#0ea5e9',
          'circle-stroke-width': 2,
        },
      });
    }
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const source = map.getSource(boundarySourceId) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    const renderable = locations.flatMap((location) => {
      const boundary = getEffectiveBoundary(location);
      if (!boundary || boundary.length < 3) {
        return [];
      }
      const style = getLocationPolygonStyle(location.id, location.color);
      return [{ location, boundary, style }];
    });

    source.setData({
      type: 'FeatureCollection',
      features: renderable.map(({ location, boundary, style }) => ({
        type: 'Feature' as const,
        properties: {
          id: location.id,
          name: location.name,
          fillColor: style.fill,
          strokeColor: style.stroke,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [closePolygonRing(boundary)],
        },
      })),
    });

    const verticesSource = map.getSource(boundaryVerticesSourceId) as maplibregl.GeoJSONSource | undefined;
    if (verticesSource) {
      verticesSource.setData({
        type: 'FeatureCollection',
        features: selectedLocationId
          ? renderable
              .filter(({ location }) => location.id === selectedLocationId)
              .flatMap(({ location, boundary, style }) =>
                boundary.map((point, index) => ({
                  type: 'Feature' as const,
                  properties: {
                    locationId: location.id,
                    vertexIndex: index,
                    strokeColor: style.stroke,
                  },
                  geometry: { type: 'Point' as const, coordinates: point },
                })),
              )
          : [],
      });
    }
  }, [locations, mapReady, getEffectiveBoundary, selectedLocationId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const source = map.getSource(drawingSourceId) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    const features: GeoJSON.Feature[] = drawingPoints.map((coordinate, index) => ({
      type: 'Feature',
      properties: { index },
      geometry: { type: 'Point', coordinates: coordinate },
    }));

    if (drawingPoints.length >= 2) {
      const lineCoords = drawingPoints.length >= 3
        ? [...drawingPoints, drawingPoints[0]]
        : drawingPoints;
      features.push({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: lineCoords },
      });
    }

    if (drawingPoints.length >= 3) {
      features.push({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[...drawingPoints, drawingPoints[0]]],
        },
      });
    }

    source.setData({ type: 'FeatureCollection', features });
  }, [drawingPoints, mapReady]);

  const finishDrawing = useCallback(() => {
    const points = drawingPointsRef.current;
    if (points.length < 3) {
      setFeedback({ severity: 'error', message: 'Draw at least three points to form an area.' });
      return;
    }

    const boundary: LocationBoundary = points.map(([lng, lat]) => [lng, lat]);
    const inside = getDevicesInsideBoundary(devices, boundary);

    setPendingBoundary(boundary);
    setEnclosedDevices(inside);
    setDialogOpen(true);
    setDrawingActive(false);
  }, [devices]);

  const cancelDrawing = useCallback(() => {
    setDrawingActive(false);
    setDrawingPoints([]);
  }, []);

  const startDrawing = useCallback(() => {
    popupRef.current?.remove();
    popupRef.current = null;
    setDrawingPoints([]);
    setDrawingActive(true);
  }, []);

  const handleDialogCancel = useCallback(() => {
    setDialogOpen(false);
    setPendingBoundary(null);
    setEnclosedDevices([]);
    setDrawingPoints([]);
  }, []);

  const handleDialogSubmit = useCallback(async (payload: AssignBoundarySubmitPayload) => {
    if (!pendingBoundary) {
      return;
    }

    let targetLocationId: string;
    if (payload.mode === 'create') {
      const created = await createLocation(
        payload.newLocationName ?? '',
        undefined,
        payload.newLocationParentId ?? undefined,
        undefined,
        undefined,
        pendingBoundary,
      );
      targetLocationId = created.id;
    } else {
      if (!payload.existingLocationId) {
        throw new Error('Missing existing location id.');
      }
      await updateLocation(payload.existingLocationId, { boundary: pendingBoundary });
      targetLocationId = payload.existingLocationId;
    }

    const deviceIds = enclosedDevices.map((device) => device.id);
    let affected = 0;
    if (deviceIds.length > 0) {
      const result = await assignDevicesToLocation(targetLocationId, deviceIds);
      affected = result.affected;
    }

    setDialogOpen(false);
    setPendingBoundary(null);
    setEnclosedDevices([]);
    setDrawingPoints([]);
    setFeedback({
      severity: 'success',
      message: affected === 0
        ? 'Saved boundary. No sensors were inside the area.'
        : `Saved boundary and assigned ${affected} sensor${affected === 1 ? '' : 's'}.`,
    });

    await reloadMapData();
  }, [pendingBoundary, enclosedDevices, reloadMapData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    if (!drawingActive) {
      map.getCanvas().style.cursor = '';
      return;
    }

    map.getCanvas().style.cursor = 'crosshair';
    popupRef.current?.remove();
    popupRef.current = null;

    const onClick = (event: maplibregl.MapMouseEvent) => {
      const next: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      setDrawingPoints((previous) => [...previous, next]);
    };

    const onDblClick = (event: maplibregl.MapMouseEvent) => {
      event.preventDefault();
      finishDrawing();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        finishDrawing();
      } else if (event.key === 'Escape') {
        cancelDrawing();
      }
    };

    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);

    return () => {
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
      window.removeEventListener('keydown', onKey);
      map.getCanvas().style.cursor = '';
    };
  }, [drawingActive, mapReady, finishDrawing, cancelDrawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    let dragging: { locationId: string; vertexIndex: number } | null = null;

    const findVertexAt = (point: maplibregl.Point) => {
      const box: [maplibregl.PointLike, maplibregl.PointLike] = [
        [point.x - vertexHitRadiusPx, point.y - vertexHitRadiusPx],
        [point.x + vertexHitRadiusPx, point.y + vertexHitRadiusPx],
      ];
      const features = map.queryRenderedFeatures(box, { layers: [boundaryVerticesLayerId] });
      if (features.length === 0) {
        return null;
      }
      const feature = features[0];
      const locationId = feature.properties?.locationId as string | undefined;
      const vertexIndex = feature.properties?.vertexIndex;
      if (!locationId || typeof vertexIndex !== 'number') {
        return null;
      }
      return { locationId, vertexIndex };
    };

    const updateVertex = (locationId: string, vertexIndex: number, next: [number, number]) => {
      setBoundaryOverrides((previous) => {
        const updated = new Map(previous);
        const base = updated.get(locationId)
          ?? locationsRef.current.find((location) => location.id === locationId)?.boundary
          ?? null;
        if (!base) {
          return previous;
        }
        const cloned = base.map((point) => [point[0], point[1]] as [number, number]);
        if (vertexIndex < 0 || vertexIndex >= cloned.length) {
          return previous;
        }
        cloned[vertexIndex] = next;
        updated.set(locationId, cloned);
        return updated;
      });
    };

    const onMouseMove = (event: maplibregl.MapMouseEvent) => {
      if (drawingActiveRef.current) {
        return;
      }
      if (dragging) {
        updateVertex(dragging.locationId, dragging.vertexIndex, [event.lngLat.lng, event.lngLat.lat]);
        return;
      }
      const hit = findVertexAt(event.point);
      map.getCanvas().style.cursor = hit ? 'grab' : '';
    };

    const onMouseDown = (event: maplibregl.MapMouseEvent) => {
      if (drawingActiveRef.current) {
        return;
      }
      const hit = findVertexAt(event.point);
      if (!hit) {
        return;
      }
      event.preventDefault();
      dragging = hit;
      map.getCanvas().style.cursor = 'grabbing';
      map.dragPan.disable();
    };

    const onMouseUp = async () => {
      if (!dragging) {
        return;
      }
      const completed = dragging;
      dragging = null;
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';

      const updatedBoundary = boundaryOverridesRef.current.get(completed.locationId);
      if (!updatedBoundary) {
        return;
      }

      try {
        await updateLocation(completed.locationId, { boundary: updatedBoundary });
        await reloadMapData();
      } catch (error) {
        console.error('Failed to save resized boundary:', error);
        setFeedback({ severity: 'error', message: 'Failed to save the resized area.' });
      } finally {
        setBoundaryOverrides((previous) => {
          if (!previous.has(completed.locationId)) {
            return previous;
          }
          const next = new Map(previous);
          next.delete(completed.locationId);
          return next;
        });
      }
    };

    map.on('mousemove', onMouseMove);
    map.on('mousedown', onMouseDown);
    map.on('mouseup', onMouseUp);

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('mousedown', onMouseDown);
      map.off('mouseup', onMouseUp);
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';
    };
  }, [mapReady, reloadMapData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const onMapClick = (event: maplibregl.MapMouseEvent) => {
      if (drawingActiveRef.current) {
        return;
      }
      const vertexHits = map.queryRenderedFeatures(event.point, { layers: [boundaryVerticesLayerId] });
      if (vertexHits.length > 0) {
        return;
      }
      const polygonHits = map.queryRenderedFeatures(event.point, { layers: [boundaryFillLayerId] });
      if (polygonHits.length > 0) {
        const id = polygonHits[0].properties?.id as string | undefined;
        if (id) {
          setSelectedLocationId((current) => (current === id ? null : id));
        }
        return;
      }
      setSelectedLocationId(null);
    };

    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const clearLabels = () => {
      for (const marker of labelMarkersRef.current) {
        marker.remove();
      }
      labelMarkersRef.current = [];
    };

    clearLabels();

    const labelZIndex = sensorsVisible ? '50' : '500';
    const labelBackground = sensorsVisible ? '#ffffff' : 'rgba(255, 255, 255, 0.94)';
    const labelBoxShadow = sensorsVisible ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.2)';
    const labelBorder = sensorsVisible ? '1px solid rgba(148, 163, 184, 0.45)' : 'none';
    const dimmedTextColor = 'rgba(71, 85, 105, 0.78)';
    const dimmedSubColor = 'rgba(100, 116, 139, 0.7)';

    for (const location of locations) {
      const boundary = getEffectiveBoundary(location);
      if (!boundary || boundary.length < 3) {
        continue;
      }

      const style = getLocationPolygonStyle(location.id, location.color);
      const insideCount = getDevicesInsideBoundary(filteredDevices, boundary).length;
      const sensorWord = insideCount === 1 ? 'sensor' : 'sensors';

      const labelEl = document.createElement('div');
      labelEl.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      labelEl.style.background = labelBackground;
      labelEl.style.color = sensorsVisible ? dimmedTextColor : style.stroke;
      labelEl.style.padding = '6px 10px';
      labelEl.style.borderRadius = '6px';
      labelEl.style.boxShadow = labelBoxShadow;
      labelEl.style.border = labelBorder;
      labelEl.style.pointerEvents = 'none';
      labelEl.style.textAlign = 'center';
      labelEl.style.whiteSpace = 'nowrap';
      labelEl.style.zIndex = labelZIndex;

      const nameEl = document.createElement('div');
      nameEl.textContent = location.name;
      nameEl.style.fontSize = '15px';
      nameEl.style.fontWeight = sensorsVisible ? '600' : '700';
      nameEl.style.lineHeight = '1.15';
      nameEl.style.letterSpacing = '0.01em';

      const countEl = document.createElement('div');
      countEl.textContent = `${insideCount} ${sensorWord}`;
      countEl.style.fontSize = '13px';
      countEl.style.fontWeight = sensorsVisible ? '500' : '600';
      countEl.style.color = sensorsVisible ? dimmedSubColor : 'inherit';
      countEl.style.opacity = sensorsVisible ? '1' : '0.85';
      countEl.style.marginTop = '2px';

      labelEl.appendChild(nameEl);
      labelEl.appendChild(countEl);

      const marker = new maplibregl.Marker({ element: labelEl, anchor: 'center' })
        .setLngLat(polygonCentroid(boundary))
        .addTo(map);
      marker.getElement().style.zIndex = labelZIndex;

      labelMarkersRef.current.push(marker);
    }

    return () => {
      clearLabels();
    };
  }, [locations, mapReady, getEffectiveBoundary, filteredDevices, sensorsVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const mappableDevices = filteredDevices.filter(hasCoordinates);

    const clearMarkers = () => {
      for (const marker of markersRef.current) {
        marker.remove();
      }
      markersRef.current = [];
    };
    const closePopup = () => {
      popupRef.current?.remove();
      popupRef.current = null;
    };
    const openLocationPopup = (devicesAtLocation: SensorListItemDto[], lngLat: [number, number], now: number) => {
      closePopup();

      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
        closeOnClick: true,
        maxWidth: '420px',
      })
        .setLngLat(lngLat)
        .setDOMContent(buildLocationPopupContent(devicesAtLocation, now, onNavigateToSensor, onNavigateToGateway, closePopup))
        .addTo(map);

      popup.getElement().style.zIndex = '1000';

      popupRef.current = popup;
    };

    const polygonsForCulling = locationsWithBoundary(locations)
      .map((location) => location.boundary as LocationBoundary);

    const isInsideAnyPolygon = (device: SensorListItemDto) =>
      polygonsForCulling.some((boundary) =>
        isPointInPolygon(device.longitude!, device.latitude!, boundary));

    const renderMarkers = () => {
      clearMarkers();

      if (mappableDevices.length === 0) {
        return;
      }

      const now = Date.now();
      const skipClustering = map.getZoom() >= polygonZoomThreshold;
      const visibleDevices = skipClustering
        ? mappableDevices
        : mappableDevices.filter((device) => !isInsideAnyPolygon(device));

      if (visibleDevices.length === 0) {
        return;
      }

      const clusters = skipClustering
        ? visibleDevices.map((device): DeviceCluster => {
            const projected = map.project([device.longitude!, device.latitude!]);
            return {
              longitude: device.longitude!,
              latitude: device.latitude!,
              devices: [device],
              projectedX: projected.x,
              projectedY: projected.y,
            };
          })
        : clusterDevices(
            visibleDevices,
            (device) => map.project([device.longitude!, device.latitude!]),
            clusterRadiusPx,
          );

      for (const cluster of clusters) {
        if (cluster.devices.length === 1) {
          const [device] = cluster.devices;
          const lngLat: [number, number] = [device.longitude!, device.latitude!];
          const el = createMarkerElement(device, now);
          const coordinateKey = getCoordinateKey(device.latitude!, device.longitude!);
          const devicesAtLocation = devicesByCoordinate.get(coordinateKey) ?? [device];

          el.addEventListener('click', (event) => {
            event.stopPropagation();
            if (drawingActiveRef.current) {
              return;
            }
            openLocationPopup(devicesAtLocation, lngLat, now);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(lngLat)
            .addTo(map);
          marker.getElement().style.zIndex = '100';

          markersRef.current.push(marker);
          continue;
        }

        const clusterKind = getClusterKind(cluster);
        const clusterEl = createClusterElement(cluster.devices.length, clusterKind);

        clusterEl.title = areDevicesAtExactSameLocation(cluster.devices)
          ? `${cluster.devices.length} devices at one location`
          : `${cluster.devices.length} devices in this area`;
        clusterEl.addEventListener('click', (event) => {
          event.stopPropagation();
          if (drawingActiveRef.current) {
            return;
          }
          if (areDevicesAtExactSameLocation(cluster.devices)) {
            const first = cluster.devices[0];
            openLocationPopup(cluster.devices, [first.longitude!, first.latitude!], now);
            return;
          }

          closePopup();
          zoomToCluster(map, cluster);
        });

        const marker = new maplibregl.Marker({ element: clusterEl })
          .setLngLat([cluster.longitude, cluster.latitude])
          .addTo(map);
        marker.getElement().style.zIndex = '100';

        markersRef.current.push(marker);
      }
    };

    renderMarkers();
    map.on('moveend', renderMarkers);
    map.on('zoomend', renderMarkers);
    map.on('resize', renderMarkers);

    return () => {
      map.off('moveend', renderMarkers);
      map.off('zoomend', renderMarkers);
      map.off('resize', renderMarkers);
      closePopup();
      clearMarkers();
    };
  }, [devicesByCoordinate, filteredDevices, locations, onNavigateToSensor, onNavigateToGateway]);

  // Render building markers as green triangles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Clear existing building markers
    for (const marker of buildingMarkersRef.current) marker.remove();
    buildingMarkersRef.current = [];

    for (const building of buildings) {
      if (building.latitude == null || building.longitude == null) continue;

      const el = document.createElement('div');
      el.style.width = '0';
      el.style.height = '0';
      el.style.borderLeft = '8px solid transparent';
      el.style.borderRight = '8px solid transparent';
      el.style.borderBottom = '14px solid #22c55e';
      el.style.filter = 'drop-shadow(0 0 3px rgba(34,197,94,0.5))';
      el.style.cursor = 'pointer';
      el.title = building.name;

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        const popup = new maplibregl.Popup({ offset: 12, closeButton: false, closeOnClick: true, maxWidth: '240px' })
          .setLngLat([building.longitude!, building.latitude!])
          .setHTML(`
            <div style="font-family:-apple-system,sans-serif;font-size:13px;color:#1e293b;">
              <div style="font-weight:700;margin-bottom:4px;">🏢 ${building.name}</div>
              ${building.address ? `<div style="color:#475569;font-size:12px;">${building.address}</div>` : ''}
              <div style="color:#475569;font-size:11px;margin-top:4px;">${building.deviceCount} sensor${building.deviceCount === 1 ? '' : 's'}</div>
            </div>
          `)
          .addTo(map);
        popup.getElement().style.zIndex = '1000';
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([building.longitude!, building.latitude!])
        .addTo(map);
      marker.getElement().style.zIndex = '200';
      buildingMarkersRef.current.push(marker);
    }

    return () => {
      for (const marker of buildingMarkersRef.current) marker.remove();
      buildingMarkersRef.current = [];
    };
  }, [buildings, mapReady]);

  const skipInitialFitRef = useRef(!!initialPosition);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (skipInitialFitRef.current) {
      skipInitialFitRef.current = false;
      return;
    }

    const mappableDevices = filteredDevices.filter(hasCoordinates);
    if (mappableDevices.length === 0) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }

    if (mappableDevices.length === 1) {
      map.setCenter([mappableDevices[0].longitude!, mappableDevices[0].latitude!]);
      map.setZoom(14);
      return;
    }

    const bounds = new maplibregl.LngLatBounds();
    for (const device of mappableDevices) {
      bounds.extend([device.longitude!, device.latitude!]);
    }

    map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  }, [mapViewportSignature]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        sx={{
          p: 2,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(15, 23, 42, 0.36)',
        }}
      >
        <ToggleButtonGroup
          exclusive
          value={kindFilter}
          onChange={(_, nextValue: DeviceKindFilter | null) => {
            if (nextValue) {
              setKindFilter(nextValue);
            }
          }}
          size="small"
          color="primary"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="Sensor">Sensors</ToggleButton>
          <ToggleButton value="Gateway">Gateways</ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="map-manufacturer-filter-label">Manufacturer</InputLabel>
          <Select
            labelId="map-manufacturer-filter-label"
            value={manufacturerFilter}
            label="Manufacturer"
            onChange={(event) => setManufacturerFilter(event.target.value)}
          >
            <MenuItem value="all">All manufacturers</MenuItem>
            {manufacturers.map((manufacturer) => (
              <MenuItem key={manufacturer} value={manufacturer}>{manufacturer}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="map-type-filter-label">Type</InputLabel>
          <Select
            labelId="map-type-filter-label"
            value={typeFilter}
            label="Type"
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <MenuItem value="all">All types</MenuItem>
            {types.map((type) => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        {drawingActive ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ color: 'rgba(226, 232, 240, 0.85)' }}>
              {drawingPoints.length < 3
                ? `Click on the map to add points (${drawingPoints.length}/3 minimum)`
                : `${drawingPoints.length} points · double-click or press Enter to finish`}
            </Typography>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={finishDrawing}
              disabled={drawingPoints.length < 3}
            >
              Finish
            </Button>
            <Button size="small" onClick={cancelDrawing}>Cancel</Button>
          </Stack>
        ) : (
          <Button
            size="small"
            variant="outlined"
            color="primary"
            onClick={startDrawing}
          >
            Draw area
          </Button>
        )}
      </Stack>
      <Box
        ref={mapContainer}
        sx={{
          flex: 1,
          minHeight: 0,
        }}
      />
      <AssignBoundaryDialog
        open={dialogOpen}
        enclosedDeviceCount={enclosedDevices.length}
        locations={locations}
        onCancel={handleDialogCancel}
        onSubmit={handleDialogSubmit}
      />
      <Snackbar
        open={feedback !== null}
        autoHideDuration={5000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {feedback ? (
          <Alert
            severity={feedback.severity}
            onClose={() => setFeedback(null)}
            sx={{ width: '100%' }}
          >
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

export default MapView;
