import { describe, expect, it } from 'vitest';
import { SensorListItemDto } from '../../api/api';
import { clusterDevices } from './deviceClusters';

function createDevice(
  uniqueId: string,
  longitude: number,
  latitude: number,
): SensorListItemDto {
  return {
    id: uniqueId,
    uniqueId,
    name: uniqueId,
    manufacturer: 'AXI',
    type: 'ColdWater',
    kind: 'Sensor',
    locationName: null,
    locationId: null,
    lastContact: '2026-04-09T10:00:00Z',
    installationDate: '2026-04-09T10:00:00Z',
    latitude,
    longitude,
  };
}

describe('clusterDevices', () => {
  it('Shall_group_devices_that_project_close_to_each_other', () => {
    // Arrange
    const devices = [
      createDevice('9900000', 10.4, 59.8),
      createDevice('9900001', 10.4001, 59.8001),
      createDevice('9900002', 10.7, 59.9),
    ];

    // Act
    const clusters = clusterDevices(
      devices,
      (device) => ({
        x: Math.round((device.longitude ?? 0) * 100),
        y: Math.round((device.latitude ?? 0) * 100),
      }),
      3,
    );

    // Assert
    expect(clusters).toHaveLength(2);
    expect(clusters.map((cluster) => cluster.devices.length).sort((left, right) => left - right)).toEqual([1, 2]);
  });

  it('Shall_keep_distant_devices_in_separate_clusters', () => {
    // Arrange
    const devices = [
      createDevice('9900000', 10.4, 59.8),
      createDevice('9900001', 10.9, 60.1),
      createDevice('9900002', 11.2, 60.4),
    ];

    // Act
    const clusters = clusterDevices(
      devices,
      (device) => ({
        x: Math.round((device.longitude ?? 0) * 100),
        y: Math.round((device.latitude ?? 0) * 100),
      }),
      3,
    );

    // Assert
    expect(clusters).toHaveLength(3);
    expect(clusters.every((cluster) => cluster.devices.length === 1)).toBe(true);
  });
});
