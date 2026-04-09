import { SensorListItemDto } from '../../api/api';

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface DeviceCluster {
  devices: SensorListItemDto[];
  latitude: number;
  longitude: number;
  projectedX: number;
  projectedY: number;
}

export function clusterDevices(
  devices: SensorListItemDto[],
  project: (device: SensorListItemDto) => ProjectedPoint,
  clusterRadiusPx: number,
): DeviceCluster[] {
  if (devices.length === 0) {
    return [];
  }

  const radiusSquared = clusterRadiusPx * clusterRadiusPx;
  const cellSize = clusterRadiusPx;
  const buckets = new Map<string, DeviceCluster[]>();
  const clusters: DeviceCluster[] = [];

  for (const device of devices) {
    const projected = project(device);
    const cellX = Math.floor(projected.x / cellSize);
    const cellY = Math.floor(projected.y / cellSize);

    let closestCluster: DeviceCluster | null = null;
    let closestDistanceSquared = Number.POSITIVE_INFINITY;

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const bucketKey = `${cellX + offsetX}:${cellY + offsetY}`;
        const bucketClusters = buckets.get(bucketKey);

        if (!bucketClusters) {
          continue;
        }

        for (const cluster of bucketClusters) {
          const deltaX = cluster.projectedX - projected.x;
          const deltaY = cluster.projectedY - projected.y;
          const distanceSquared = deltaX * deltaX + deltaY * deltaY;

          if (distanceSquared <= radiusSquared && distanceSquared < closestDistanceSquared) {
            closestCluster = cluster;
            closestDistanceSquared = distanceSquared;
          }
        }
      }
    }

    if (!closestCluster) {
      const newCluster: DeviceCluster = {
        devices: [device],
        latitude: device.latitude ?? 0,
        longitude: device.longitude ?? 0,
        projectedX: projected.x,
        projectedY: projected.y,
      };

      const ownBucketKey = `${cellX}:${cellY}`;
      const ownBucket = buckets.get(ownBucketKey);
      if (ownBucket) {
        ownBucket.push(newCluster);
      } else {
        buckets.set(ownBucketKey, [newCluster]);
      }

      clusters.push(newCluster);
      continue;
    }

    const memberCount = closestCluster.devices.length;
    closestCluster.devices.push(device);
    closestCluster.latitude = ((closestCluster.latitude * memberCount) + (device.latitude ?? 0)) / (memberCount + 1);
    closestCluster.longitude = ((closestCluster.longitude * memberCount) + (device.longitude ?? 0)) / (memberCount + 1);
    closestCluster.projectedX = ((closestCluster.projectedX * memberCount) + projected.x) / (memberCount + 1);
    closestCluster.projectedY = ((closestCluster.projectedY * memberCount) + projected.y) / (memberCount + 1);
  }

  return clusters;
}
