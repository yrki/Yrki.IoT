import { describe, expect, it } from 'vitest';
import { calculateSensorStatistics } from './sensorStats';

describe('calculateSensorStatistics', () => {
  it('Shall_return_null_when_history_is_empty', () => {
    // Arrange
    const history: { time: number; value: number }[] = [];

    // Act
    const result = calculateSensorStatistics(history);

    // Assert
    expect(result).toBeNull();
  });

  it('Shall_calculate_statistics_for_odd_number_of_values', () => {
    // Arrange
    const history = [
      { time: 1, value: 10 },
      { time: 2, value: 20 },
      { time: 3, value: 30 },
    ];

    // Act
    const result = calculateSensorStatistics(history);

    // Assert
    expect(result).toEqual({
      min: 10,
      max: 30,
      median: 20,
      average: 20,
    });
  });

  it('Shall_calculate_statistics_for_even_number_of_values', () => {
    // Arrange
    const history = [
      { time: 1, value: 5 },
      { time: 2, value: 10 },
      { time: 3, value: 15 },
      { time: 4, value: 20 },
    ];

    // Act
    const result = calculateSensorStatistics(history);

    // Assert
    expect(result).toEqual({
      min: 5,
      max: 20,
      median: 12.5,
      average: 12.5,
    });
  });
});
