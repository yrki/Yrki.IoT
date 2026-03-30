import { SensorDataPoint } from './useSensorHub';

export interface SensorStatistics {
  min: number;
  max: number;
  median: number;
  average: number;
}

export function calculateSensorStatistics(history: SensorDataPoint[]): SensorStatistics | null {
  if (history.length === 0) {
    return null;
  }

  const sortedValues = history
    .map((point) => point.value)
    .sort((left, right) => left - right);

  const middleIndex = Math.floor(sortedValues.length / 2);
  const median = sortedValues.length % 2 === 0
    ? (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2
    : sortedValues[middleIndex];

  const total = sortedValues.reduce((sum, value) => sum + value, 0);

  return {
    min: sortedValues[0],
    max: sortedValues[sortedValues.length - 1],
    median,
    average: total / sortedValues.length,
  };
}
