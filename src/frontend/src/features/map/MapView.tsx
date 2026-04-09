import { useEffect, useRef, useState } from 'react';
import { Box, Paper } from '@mui/material';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getDevices, getGateways, SensorListItemDto } from '../../api/api';

const activityFadeDurationMs = 6 * 60 * 60 * 1000;

interface MapViewProps {
  onNavigateToSensor: (sensorId: string) => void;
  onNavigateToGateway: (gatewayId: string) => void;
}

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

function createMarkerElement(device: SensorListItemDto, now: number): HTMLElement {
  const isGateway = device.kind === 'Gateway';
  const color = isGateway
    ? getGatewayColor(device.lastContact, now)
    : getSensorColor(device.lastContact, now);
  const glow = getActivityGlow(device.lastContact, now, isGateway);
  const size = isGateway ? 12 : 10;

  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.backgroundColor = color;
  el.style.boxShadow = glow;
  el.style.borderRadius = isGateway ? '2px' : '50%';
  el.style.cursor = 'pointer';
  el.style.border = '1px solid rgba(60, 60, 70, 0.6)';
  return el;
}

function MapView({ onNavigateToSensor, onNavigateToGateway }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [devices, setDevices] = useState<SensorListItemDto[]>([]);

  useEffect(() => {
    Promise.all([getDevices(), getGateways()])
      .then(([sensors, gateways]) => setDevices([...sensors, ...gateways]))
      .catch((err) => console.error('Failed to fetch devices for map:', err));
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

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
    if (!map) return;

    const mappableDevices = devices.filter(hasCoordinates);
    if (mappableDevices.length === 0) return;

    const now = Date.now();
    const markersToRemove: maplibregl.Marker[] = [];

    for (const device of mappableDevices) {
      const isGateway = device.kind === 'Gateway';
      const lastContactFormatted = new Date(device.lastContact).toLocaleString([], {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
      });

      const popupHtml = isGateway
        ? `<div style="font-family: sans-serif; font-size: 12px; line-height: 1.6; color: #1a1a2e; min-width: 140px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #3b82f6;">Gateway</div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span style="color: #666;">ID</span>
              <span style="font-family: monospace; font-size: 11px;">${device.uniqueId}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span style="color: #666;">Last contact</span>
              <span>${lastContactFormatted}</span>
            </div>
          </div>`
        : `<div style="font-family: sans-serif; font-size: 12px; line-height: 1.6; color: #1a1a2e; min-width: 160px;">
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #16a34a;">Sensor</div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span style="color: #666;">ID</span>
              <span style="font-family: monospace; font-size: 11px;">${device.uniqueId}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span style="color: #666;">Manufacturer</span>
              <span>${device.manufacturer ?? '-'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span style="color: #666;">Type</span>
              <span>${device.type}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span style="color: #666;">Last contact</span>
              <span>${lastContactFormatted}</span>
            </div>
          </div>`;

      const lngLat: [number, number] = [device.longitude!, device.latitude!];

      const popup = new maplibregl.Popup({ offset: 10, closeButton: false })
        .setLngLat(lngLat)
        .setHTML(popupHtml);

      const el = createMarkerElement(device, now);

      el.addEventListener('mouseenter', () => popup.addTo(map));
      el.addEventListener('mouseleave', () => popup.remove());
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isGateway) {
          onNavigateToGateway(device.uniqueId);
        } else {
          onNavigateToSensor(device.uniqueId);
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(lngLat)
        .addTo(map);

      markersToRemove.push(marker);
    }

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

    return () => {
      for (const marker of markersToRemove) {
        marker.remove();
      }
    };
  }, [devices, onNavigateToSensor, onNavigateToGateway]);

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
      <Box ref={mapContainer} sx={{ flex: 1, minHeight: 0 }} />
    </Paper>
  );
}

export default MapView;
