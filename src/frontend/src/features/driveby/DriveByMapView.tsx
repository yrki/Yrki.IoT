import { useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import {
  Box,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  GatewayPositionDto,
  SensorListItemDto,
  getDevices,
  getGateways,
  getGatewayPositions,
} from '../../api/api';

const HUB_URL = import.meta.env.VITE_SIGNALR_URL ?? '/hubs/sensors';
const GATEWAY_REFRESH_MS = 15_000;
const MIN_DISTANCE_METERS = 2;
const FOLLOW_ZOOM = 16;

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <rect x="2" y="2" width="20" height="20" rx="4" fill="rgba(251,146,60,0.95)"/>
  <path d="M7.5 16.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="white"/>
  <path d="M5.5 11l1.2-3.6a1 1 0 0 1 .95-.7h8.7a1 1 0 0 1 .95.7L18.5 11M5 12.5h14a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

interface SensorMarkerState {
  marker: maplibregl.Marker;
  lastContact: string;
  active: boolean;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filterByDistance(positions: GatewayPositionDto[]): GatewayPositionDto[] {
  if (positions.length === 0) return [];
  const result: GatewayPositionDto[] = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    const prev = result[result.length - 1];
    const curr = positions[i];
    if (
      prev.latitude == null || prev.longitude == null ||
      curr.latitude == null || curr.longitude == null
    ) continue;
    if (haversineMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude) >= MIN_DISTANCE_METERS) {
      result.push(curr);
    }
  }
  return result;
}

function createSensorElement(active: boolean): HTMLDivElement {
  const el = document.createElement('div');
  el.style.width = '10px';
  el.style.height = '10px';
  el.style.borderRadius = '50%';
  el.style.backgroundColor = active ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.85)';
  el.style.border = '1.5px solid rgba(255,255,255,0.7)';
  el.style.transition = 'background-color 0.3s ease';
  return el;
}

function createCarElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.innerHTML = CAR_SVG;
  el.style.width = '24px';
  el.style.height = '24px';
  el.style.filter = 'drop-shadow(0 0 4px rgba(251, 146, 60, 0.6))';
  return el;
}

function pulseMarker(el: HTMLDivElement) {
  el.style.backgroundColor = 'rgba(34, 197, 94, 0.9)';
  el.animate(
    [
      { transform: 'scale(1)', opacity: '0.8' },
      { transform: 'scale(2.2)', opacity: '1' },
      { transform: 'scale(1)', opacity: '0.9' },
    ],
    { duration: 800, iterations: 2, easing: 'ease-in-out' },
  );
}

function DriveByMapView() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const sensorMarkersRef = useRef<Record<string, SensorMarkerState>>({});
  const gatewayMarkersRef = useRef<Record<string, maplibregl.Marker>>({});
  const [thresholdDays, setThresholdDays] = useState(3);
  const thresholdDaysRef = useRef(thresholdDays);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [gatewayList, setGatewayList] = useState<SensorListItemDto[]>([]);
  const [focusGatewayId, setFocusGatewayId] = useState('');
  const focusGatewayIdRef = useRef('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    focusGatewayIdRef.current = focusGatewayId;
  }, [focusGatewayId]);

  useEffect(() => {
    thresholdDaysRef.current = thresholdDays;
  }, [thresholdDays]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // When user picks a gateway to focus, zoom in immediately
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusGatewayId) return;

    const marker = gatewayMarkersRef.current[focusGatewayId];
    if (marker) {
      const lngLat = marker.getLngLat();
      map.flyTo({ center: lngLat, zoom: FOLLOW_ZOOM, duration: 800 });
    }
  }, [focusGatewayId]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [10.4, 63.4],
      zoom: 5,
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      loadSensors(map);
      loadGatewayRoutes(map);
    });

    const gatewayInterval = window.setInterval(() => {
      if (mapRef.current) loadGatewayRoutes(mapRef.current);
    }, GATEWAY_REFRESH_MS);

    return () => {
      window.clearInterval(gatewayInterval);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update sensor marker colors when threshold changes
  useEffect(() => {
    const now = Date.now();
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    for (const [, state] of Object.entries(sensorMarkersRef.current)) {
      const age = now - new Date(state.lastContact).getTime();
      const active = age <= thresholdMs;
      if (active !== state.active) {
        state.active = active;
        const el = state.marker.getElement();
        el.style.backgroundColor = active ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.85)';
      }
    }
  }, [thresholdDays]);

  // SignalR for real-time sensor updates
  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('SensorReadingReceived', (reading: { sensorId: string; timestamp: string }) => {
      const state = sensorMarkersRef.current[reading.sensorId];
      if (!state) return;

      state.lastContact = reading.timestamp;
      const thresholdMs = thresholdDaysRef.current * 24 * 60 * 60 * 1000;
      const age = Date.now() - new Date(reading.timestamp).getTime();

      if (age <= thresholdMs && !state.active) {
        state.active = true;
        pulseMarker(state.marker.getElement() as HTMLDivElement);
      }
    });

    connection.start().catch((err) => console.error('SignalR connect failed:', err));

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.stop();
      }
    };
  }, []);

  async function loadSensors(map: maplibregl.Map) {
    try {
      const sensors = await getDevices();
      const now = Date.now();
      const thresholdMs = thresholdDaysRef.current * 24 * 60 * 60 * 1000;

      for (const sensor of sensors) {
        if (sensor.latitude == null || sensor.longitude == null) continue;

        const age = now - new Date(sensor.lastContact).getTime();
        const active = age <= thresholdMs;
        const el = createSensorElement(active);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([sensor.longitude, sensor.latitude])
          .addTo(map);

        sensorMarkersRef.current[sensor.uniqueId] = {
          marker,
          lastContact: sensor.lastContact,
          active,
        };
      }
    } catch (err) {
      console.error('Failed to load sensors:', err);
    }
  }

  async function loadGatewayRoutes(map: maplibregl.Map) {
    try {
      const gateways = await getGateways();

      // Update gateway list for the focus dropdown (only once or if changed)
      if (gatewayList.length !== gateways.length) {
        setGatewayList(gateways);
      }

      for (const gw of gateways) {
        const positions = await getGatewayPositions(gw.uniqueId, 1);
        const now = Date.now();
        const thirtyMinAgo = now - 30 * 60 * 1000;

        const recent = positions.filter(
          (p) => p.latitude != null && p.longitude != null && new Date(p.timestamp).getTime() >= thirtyMinAgo,
        );

        const filtered = filterByDistance(recent);
        const sourceId = `gw-route-${gw.uniqueId}`;
        const layerId = `gw-route-line-${gw.uniqueId}`;

        if (filtered.length > 0) {
          const coords = filtered.map((p) => [p.longitude!, p.latitude!]);
          const lastPos = filtered[filtered.length - 1];

          const geojsonData: GeoJSON.Feature = {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: coords },
          };

          if (map.getSource(sourceId)) {
            (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojsonData);
          } else {
            map.addSource(sourceId, { type: 'geojson', data: geojsonData });
            map.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#fb923c', 'line-width': 2.5, 'line-opacity': 0.7 },
            });
          }

          const lngLat: [number, number] = [lastPos.longitude!, lastPos.latitude!];

          if (gatewayMarkersRef.current[gw.uniqueId]) {
            gatewayMarkersRef.current[gw.uniqueId].setLngLat(lngLat);
          } else {
            const el = createCarElement();
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat(lngLat)
              .addTo(map);
            gatewayMarkersRef.current[gw.uniqueId] = marker;
          }

          // Follow the focused gateway
          if (focusGatewayIdRef.current === gw.uniqueId) {
            map.panTo(lngLat, { duration: 600 });
          }
        }
      }
    } catch (err) {
      console.error('Failed to load gateway routes:', err);
    }
  }

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%', height: 'calc(100vh - 80px)', backgroundColor: '#1a1d23' }}>
      <Box
        ref={mapContainerRef}
        sx={{ width: '100%', height: '100%', borderRadius: fullscreen ? 0 : '6px', overflow: 'hidden' }}
      />

      <IconButton
        onClick={toggleFullscreen}
        sx={{
          position: 'absolute',
          top: 12,
          right: 56,
          zIndex: 1,
          backgroundColor: 'rgba(36, 42, 51, 0.92)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(8px)',
          color: 'text.primary',
          '&:hover': { backgroundColor: 'rgba(36, 42, 51, 1)' },
        }}
        size="small"
      >
        {fullscreen ? <FullscreenExitRoundedIcon /> : <FullscreenRoundedIcon />}
      </IconButton>

      {!fullscreen && (
        <IconButton
          onClick={() => setDrawerOpen(true)}
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 1,
            backgroundColor: 'rgba(36, 42, 51, 0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
            color: 'text.primary',
            '&:hover': { backgroundColor: 'rgba(36, 42, 51, 1)' },
          }}
          size="small"
        >
          <TuneRoundedIcon />
        </IconButton>
      )}

      <Drawer
        anchor="left"
        open={drawerOpen && !fullscreen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 260,
            backgroundColor: 'rgba(36, 42, 51, 0.97)',
            borderRight: '1px solid rgba(255,255,255,0.08)',
            p: 2.5,
          },
        }}
      >
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700 }}>
          Drive-By Settings
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Sensor activity threshold
        </Typography>
        <Slider
          value={thresholdDays}
          onChange={(_e, v) => setThresholdDays(v as number)}
          min={1}
          max={30}
          step={1}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v}d`}
          size="small"
          sx={{ color: 'rgba(34, 197, 94, 0.8)' }}
        />
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 2, display: 'block' }}>
          Contact within <strong>{thresholdDays} day{thresholdDays === 1 ? '' : 's'}</strong>
        </Typography>

        {gatewayList.length > 0 && (
          <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
            <InputLabel sx={{ fontSize: '0.85rem' }}>Focus on</InputLabel>
            <Select
              value={focusGatewayId}
              label="Focus on"
              onChange={(e) => setFocusGatewayId(e.target.value)}
              sx={{ fontSize: '0.85rem' }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {gatewayList.map((gw) => (
                <MenuItem key={gw.uniqueId} value={gw.uniqueId} sx={{ fontSize: '0.85rem' }}>
                  {gw.name?.trim() || gw.uniqueId}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Legend
        </Typography>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.9)', border: '1.5px solid rgba(255,255,255,0.7)', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Active sensor</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.85)', border: '1.5px solid rgba(255,255,255,0.7)', flexShrink: 0 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>No contact</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{ width: 16, height: 16, flexShrink: 0 }}
              dangerouslySetInnerHTML={{ __html: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="4" fill="rgba(251,146,60,0.95)"/><path d="M7.5 16.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="white"/><path d="M5.5 11l1.2-3.6a1 1 0 0 1 .95-.7h8.7a1 1 0 0 1 .95.7L18.5 11M5 12.5h14a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>` }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Gateway</Typography>
          </Stack>
        </Stack>
      </Drawer>
    </Box>
  );
}

export default DriveByMapView;
