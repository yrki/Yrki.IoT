import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Paper, Select, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getDevices, getGateways, SensorListItemDto } from '../../api/api';
import { clusterDevices, DeviceCluster } from './deviceClusters';

const activityFadeDurationMs = 6 * 60 * 60 * 1000;
const clusterRadiusPx = 44;

interface MapViewProps {
  onNavigateToSensor: (sensorId: string) => void;
  onNavigateToGateway: (gatewayId: string) => void;
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

function MapView({ onNavigateToSensor, onNavigateToGateway }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [devices, setDevices] = useState<SensorListItemDto[]>([]);
  const [kindFilter, setKindFilter] = useState<DeviceKindFilter>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

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

  useEffect(() => {
    Promise.all([getDevices(), getGateways()])
      .then(([sensors, gateways]) => {
        setDevices([...sensors, ...gateways]);
      })
      .catch((err) => console.error('Failed to fetch devices for map:', err));
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [10.4, 63.4],
      zoom: 5,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

      popupRef.current = popup;
    };

    const renderMarkers = () => {
      clearMarkers();

      if (mappableDevices.length === 0) {
        return;
      }

      const now = Date.now();
      const clusters = clusterDevices(
        mappableDevices,
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
            openLocationPopup(devicesAtLocation, lngLat, now);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(lngLat)
            .addTo(map);

          markersRef.current.push(marker);
          continue;
        }

        const clusterKind = getClusterKind(cluster);
        const clusterLabel = clusterKind === 'Gateway'
          ? 'Gateway cluster'
          : clusterKind === 'Mixed'
            ? 'Mixed cluster'
            : 'Device cluster';
        const clusterEl = createClusterElement(cluster.devices.length, clusterKind);

        clusterEl.title = areDevicesAtExactSameLocation(cluster.devices)
          ? `${cluster.devices.length} devices at one location`
          : `${cluster.devices.length} devices in this area`;
        clusterEl.addEventListener('click', (event) => {
          event.stopPropagation();
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
  }, [devicesByCoordinate, filteredDevices, onNavigateToSensor, onNavigateToGateway]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
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
    <Paper
      sx={{
        borderRadius: '6px',
        backgroundColor: 'rgba(36, 42, 51, 0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
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
      </Stack>
      <Box
        ref={mapContainer}
        sx={{
          flex: 1,
          minHeight: 0,
        }}
      />
    </Paper>
  );
}

export default MapView;
