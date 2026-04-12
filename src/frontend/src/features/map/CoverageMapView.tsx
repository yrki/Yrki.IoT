import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  CoverageConnectionDto,
  getCoverageConnections,
  getDevices,
  getGateways,
  getSensorGateways,
  SensorListItemDto,
} from '../../api/api';
import type { MapPosition } from './MapContainer';

const connectionSourceId = 'coverage-connections';
const connectionLayerId = 'coverage-connections-layer';

const coverageTimeRanges = [
  { label: '3h', hours: 3 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '3d', hours: 24 * 3 },
  { label: '1w', hours: 24 * 7 },
  { label: '1m', hours: 24 * 30 },
] as const;

interface CoverageMapViewProps {
  onNavigateToSensor: (sensorId: string) => void;
  onNavigateToGateway: (gatewayId: string) => void;
  initialPosition?: MapPosition;
  onPositionChange?: (pos: MapPosition) => void;
}

function rssiColor(rssi: number): string {
  // -30 dBm = best (green), -110 dBm = worst (dark red)
  const clamped = Math.max(-110, Math.min(-30, rssi));
  const t = (clamped - -110) / (-30 - -110); // 0 = worst, 1 = best

  // Interpolate: dark red (#991b1b) → orange (#f97316) → green (#22c55e)
  if (t < 0.5) {
    const s = t / 0.5;
    const r = Math.round(153 + s * (249 - 153));
    const g = Math.round(27 + s * (115 - 27));
    const b = Math.round(27 + s * (22 - 27));
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.5) / 0.5;
  const r = Math.round(249 + s * (34 - 249));
  const g = Math.round(115 + s * (197 - 115));
  const b = Math.round(22 + s * (94 - 22));
  return `rgb(${r},${g},${b})`;
}

const staleColor = '#1e293b';

function hasCoordinates(device: SensorListItemDto): boolean {
  return device.latitude != null && device.longitude != null
    && isFinite(device.latitude) && isFinite(device.longitude)
    && device.latitude >= -90 && device.latitude <= 90
    && device.longitude >= -180 && device.longitude <= 180;
}

function CoverageMapView({ onNavigateToSensor, onNavigateToGateway, initialPosition, onPositionChange }: CoverageMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [devices, setDevices] = useState<SensorListItemDto[]>([]);
  const [connections, setConnections] = useState<CoverageConnectionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [coverageHours, setCoverageHours] = useState(24 * 7);
  const [popupDevice, setPopupDevice] = useState<SensorListItemDto | null>(null);
  const replacingPopupRef = useRef(false);

  // Load devices once
  useEffect(() => {
    setLoading(true);
    Promise.all([getDevices(), getGateways()])
      .then(([sensors, gateways]) => setDevices([...sensors, ...gateways]))
      .catch((err) => console.error('Failed to fetch devices:', err))
      .finally(() => setLoading(false));
  }, []);

  // Load connections whenever the time range changes
  useEffect(() => {
    setLoadingConnections(true);
    getCoverageConnections(coverageHours)
      .then(setConnections)
      .catch((err) => console.error('Failed to fetch coverage connections:', err))
      .finally(() => setLoadingConnections(false));
  }, [coverageHours]);

  // Map initialisation
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

  // Coordinate lookup
  const deviceByUniqueId = useMemo(() => {
    const byId = new Map<string, SensorListItemDto>();
    for (const device of devices) {
      if (hasCoordinates(device)) {
        byId.set(device.uniqueId, device);
      }
    }
    return byId;
  }, [devices]);

  // Connection line layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    if (!map.getSource(connectionSourceId)) {
      map.addSource(connectionSourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: connectionLayerId,
        type: 'line',
        source: connectionSourceId,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.7,
        },
      });
    }
  }, [mapReady]);

  // Build connection features
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const source = map.getSource(connectionSourceId) as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    const cutoff = Date.now() - coverageHours * 60 * 60 * 1000;

    const features: GeoJSON.Feature[] = connections.flatMap((conn) => {
      const gw = deviceByUniqueId.get(conn.gatewayId);
      const sensor = deviceByUniqueId.get(conn.sensorId);
      if (!gw || !sensor) {
        return [];
      }

      const isStale = new Date(conn.lastSeenAt).getTime() < cutoff;
      const color = isStale || conn.averageRssi == null
        ? staleColor
        : rssiColor(conn.averageRssi);

      return [{
        type: 'Feature' as const,
        properties: {
          gatewayId: conn.gatewayId,
          sensorId: conn.sensorId,
          rssi: conn.averageRssi ?? 0,
          readingCount: conn.readingCount,
          color,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [gw.longitude!, gw.latitude!],
            [sensor.longitude!, sensor.latitude!],
          ],
        },
      }];
    });

    source.setData({ type: 'FeatureCollection', features });
  }, [connections, deviceByUniqueId, mapReady, coverageHours]);

  // Device markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    for (const marker of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];

    const mappableDevices = devices.filter(hasCoordinates);
    if (mappableDevices.length === 0) {
      return;
    }

    for (const device of mappableDevices) {
      const isGateway = device.kind === 'Gateway';
      const size = isGateway ? 16 : 12;

      const el = document.createElement('div');
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = isGateway ? '3px' : '50%';
      el.style.backgroundColor = isGateway ? '#3b82f6' : '#22c55e';
      el.style.border = `2px solid ${isGateway ? '#1d4ed8' : '#15803d'}`;
      el.style.cursor = 'pointer';
      el.style.boxShadow = isGateway
        ? '0 0 6px rgba(59, 130, 246, 0.5)'
        : '0 0 4px rgba(34, 197, 94, 0.4)';
      el.title = `${isGateway ? 'Gateway' : 'Sensor'}: ${device.name ?? device.uniqueId}`;

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        setPopupDevice(device);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([device.longitude!, device.latitude!])
        .addTo(map);
      marker.getElement().style.zIndex = isGateway ? '20' : '10';
      markersRef.current.push(marker);
    }

    // Only fit bounds on first load (not when returning from the other map mode)
    if (!initialPosition) {
      if (mappableDevices.length === 1) {
        map.setCenter([mappableDevices[0].longitude!, mappableDevices[0].latitude!]);
        map.setZoom(14);
      } else {
        const bounds = new maplibregl.LngLatBounds();
        for (const device of mappableDevices) {
          bounds.extend([device.longitude!, device.latitude!]);
        }
        map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
      }
    }

    return () => {
      for (const marker of markersRef.current) {
        marker.remove();
      }
      markersRef.current = [];
    };
  }, [devices, mapReady]);

  const showDevicePopup = useCallback((map: maplibregl.Map, device: SensorListItemDto) => {
    replacingPopupRef.current = true;
    popupRef.current?.remove();
    replacingPopupRef.current = false;

    const isGateway = device.kind === 'Gateway';
    const deviceConnections = connections.filter((conn) =>
      isGateway ? conn.gatewayId === device.uniqueId : conn.sensorId === device.uniqueId,
    );

    const cutoff = Date.now() - coverageHours * 60 * 60 * 1000;

    const container = document.createElement('div');
    container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.fontSize = '13px';
    container.style.maxWidth = '340px';
    container.style.color = '#1e293b';

    // Title
    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.fontSize = '14px';
    title.style.marginBottom = '6px';
    title.style.color = isGateway ? '#3b82f6' : '#22c55e';
    title.textContent = `${isGateway ? 'Gateway' : 'Sensor'}: ${device.name ?? device.uniqueId}`;
    container.appendChild(title);

    if (device.name && device.name !== device.uniqueId) {
      const id = document.createElement('div');
      id.style.fontFamily = 'monospace';
      id.style.fontSize = '11px';
      id.style.color = '#334155';
      id.style.marginBottom = '8px';
      id.textContent = device.uniqueId;
      container.appendChild(id);
    }

    // Connection summary from coverage data
    if (deviceConnections.length > 0) {
      const list = document.createElement('div');
      list.style.borderTop = '1px solid rgba(148,163,184,0.2)';
      list.style.paddingTop = '6px';
      list.style.marginTop = '4px';

      const header = document.createElement('div');
      header.style.fontSize = '11px';
      header.style.color = '#334155';
      header.style.marginBottom = '4px';
      header.textContent = isGateway
        ? `Sensors (${deviceConnections.length}):`
        : `Gateways (${deviceConnections.length}):`;
      list.appendChild(header);

      for (const conn of deviceConnections.slice(0, 10)) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.gap = '12px';
        row.style.padding = '2px 0';
        row.style.fontSize = '12px';

        const peerName = document.createElement('span');
        peerName.style.fontFamily = 'monospace';
        peerName.style.fontSize = '11px';
        peerName.style.flex = '1';
        peerName.style.minWidth = '0';
        peerName.style.overflow = 'hidden';
        peerName.style.textOverflow = 'ellipsis';
        const peerId = isGateway ? conn.sensorId : conn.gatewayId;
        peerName.textContent = peerId;
        row.appendChild(peerName);

        const rssiSpan = document.createElement('span');
        rssiSpan.style.fontWeight = '600';
        rssiSpan.style.whiteSpace = 'nowrap';
        const isStale = new Date(conn.lastSeenAt).getTime() < cutoff;
        if (isStale || conn.averageRssi == null) {
          rssiSpan.textContent = 'stale';
          rssiSpan.style.color = staleColor;
        } else {
          rssiSpan.textContent = `${Math.round(conn.averageRssi)} dBm`;
          rssiSpan.style.color = rssiColor(conn.averageRssi);
        }
        row.appendChild(rssiSpan);

        const lastSeen = document.createElement('div');
        lastSeen.style.fontSize = '10px';
        lastSeen.style.color = '#334155';
        lastSeen.textContent = new Date(conn.lastSeenAt).toLocaleString([], {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });

        const rowWrapper = document.createElement('div');
        rowWrapper.appendChild(row);
        rowWrapper.appendChild(lastSeen);
        rowWrapper.style.padding = '2px 0 4px';
        rowWrapper.style.borderBottom = '1px solid rgba(148,163,184,0.1)';

        list.appendChild(rowWrapper);
      }

      if (deviceConnections.length > 10) {
        const more = document.createElement('div');
        more.style.fontSize = '11px';
        more.style.color = '#334155';
        more.style.marginTop = '4px';
        more.textContent = `+${deviceConnections.length - 10} more`;
        list.appendChild(more);
      }

      container.appendChild(list);
    }

    // Lazy-loaded RSSI detail section (sensor only)
    if (!isGateway) {
      const detailSection = document.createElement('div');
      detailSection.style.borderTop = '1px solid rgba(148,163,184,0.2)';
      detailSection.style.paddingTop = '6px';
      detailSection.style.marginTop = '6px';
      detailSection.style.fontSize = '12px';
      detailSection.style.color = '#334155';
      detailSection.textContent = 'Loading RSSI details...';
      container.appendChild(detailSection);

      getSensorGateways(device.uniqueId, coverageHours)
        .then((gatewayStats) => {
          detailSection.textContent = '';

          if (gatewayStats.length === 0) {
            detailSection.textContent = 'No RSSI data available.';
            return;
          }

          const detailHeader = document.createElement('div');
          detailHeader.style.fontSize = '11px';
          detailHeader.style.color = '#334155';
          detailHeader.style.marginBottom = '4px';
          detailHeader.textContent = 'RSSI details per gateway:';
          detailSection.appendChild(detailHeader);

          for (const gw of gatewayStats) {
            const gwBlock = document.createElement('div');
            gwBlock.style.marginBottom = '6px';
            gwBlock.style.padding = '4px 6px';
            gwBlock.style.borderRadius = '4px';
            gwBlock.style.backgroundColor = 'rgba(255,255,255,0.04)';

            const gwHeader = document.createElement('div');
            gwHeader.style.fontFamily = 'monospace';
            gwHeader.style.fontSize = '11px';
            gwHeader.style.marginBottom = '3px';
            gwHeader.style.color = '#3b82f6';
            gwHeader.textContent = gw.gatewayId.length > 24 ? gw.gatewayId.substring(0, 22) + '...' : gw.gatewayId;
            gwBlock.appendChild(gwHeader);

            const statsRow = document.createElement('div');
            statsRow.style.display = 'flex';
            statsRow.style.gap = '10px';
            statsRow.style.fontSize = '11px';

            const items = [
              { label: 'Best', value: gw.maxRssi, better: true },
              { label: 'Avg', value: Math.round(gw.averageRssi), better: false },
              { label: 'Worst', value: gw.minRssi, better: false },
            ];

            for (const item of items) {
              const stat = document.createElement('span');
              stat.style.whiteSpace = 'nowrap';
              const labelSpan = document.createElement('span');
              labelSpan.style.color = '#334155';
              labelSpan.textContent = `${item.label}: `;
              stat.appendChild(labelSpan);

              const valueSpan = document.createElement('span');
              valueSpan.style.fontWeight = '600';
              if (item.value != null) {
                valueSpan.textContent = `${item.value} dBm`;
                valueSpan.style.color = rssiColor(item.value);
              } else {
                valueSpan.textContent = '—';
                valueSpan.style.color = '#334155';
              }
              stat.appendChild(valueSpan);
              statsRow.appendChild(stat);
            }

            gwBlock.appendChild(statsRow);

            const countRow = document.createElement('div');
            countRow.style.fontSize = '10px';
            countRow.style.color = '#334155';
            countRow.style.marginTop = '2px';
            countRow.textContent = `${gw.readingCount} readings`;
            gwBlock.appendChild(countRow);

            detailSection.appendChild(gwBlock);
          }
        })
        .catch(() => {
          detailSection.textContent = 'Failed to load RSSI details.';
          detailSection.style.color = '#ef4444';
        });
    }

    // Navigation link
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = isGateway ? 'Open gateway' : 'Open sensor';
    link.style.display = 'inline-block';
    link.style.marginTop = '8px';
    link.style.color = '#38bdf8';
    link.style.fontSize = '12px';
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      if (isGateway) {
        onNavigateToGateway(device.uniqueId);
      } else {
        onNavigateToSensor(device.uniqueId);
      }
    });
    container.appendChild(link);

    const popup = new maplibregl.Popup({
      offset: 12,
      closeButton: false,
      closeOnClick: true,
      maxWidth: '360px',
    })
      .setLngLat([device.longitude!, device.latitude!])
      .setDOMContent(container)
      .addTo(map);

    popup.getElement().style.zIndex = '1000';
    popup.on('close', () => {
      popupRef.current = null;
      if (!replacingPopupRef.current) {
        setPopupDevice(null);
      }
    });
    popupRef.current = popup;
  }, [connections, coverageHours, onNavigateToSensor, onNavigateToGateway]);

  // (Re-)render popup whenever the selected device, connections, or time range changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !popupDevice) {
      return;
    }
    showDevicePopup(map, popupDevice);
  }, [popupDevice, connections, coverageHours, showDevicePopup]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      {(loading || loadingConnections) && (
        <Box sx={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Time range selector */}
      <Paper
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
          p: 1,
          borderRadius: '8px',
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <ButtonGroup size="small" variant="outlined">
          {coverageTimeRanges.map((range) => (
            <Button
              key={range.label}
              variant={coverageHours === range.hours ? 'contained' : 'outlined'}
              onClick={() => setCoverageHours(range.hours)}
            >
              {range.label}
            </Button>
          ))}
        </ButtonGroup>
      </Paper>

      {/* Legend */}
      <Paper
        sx={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
          p: 1.5,
          borderRadius: '8px',
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.5, display: 'block', color: 'text.secondary' }}>
          RSSI ({coverageTimeRanges.find((r) => r.hours === coverageHours)?.label ?? `${coverageHours}h`})
        </Typography>
        <Stack spacing={0.5}>
          {[
            { label: 'Excellent (-30 dBm)', color: rssiColor(-30) },
            { label: 'Good (-60 dBm)', color: rssiColor(-60) },
            { label: 'Fair (-80 dBm)', color: rssiColor(-80) },
            { label: 'Poor (-100 dBm)', color: rssiColor(-100) },
            { label: 'Stale (older)', color: staleColor },
          ].map(({ label, color }) => (
            <Stack key={label} direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 20, height: 3, borderRadius: 1, backgroundColor: color, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
                {label}
              </Typography>
            </Stack>
          ))}
        </Stack>
        <Stack direction="row" spacing={1.5} sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#3b82f6', border: '1px solid #1d4ed8' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>Gateway</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e', border: '1px solid #15803d' }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>Sensor</Typography>
          </Stack>
        </Stack>
      </Paper>

      <Box ref={mapContainer} sx={{ flex: 1, minHeight: 0 }} />
    </Box>
  );
}

export default CoverageMapView;
