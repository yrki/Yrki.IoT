import { describe, expect, it } from 'vitest';
import { getActivityProgress, getSensorActivityColor, getSensorActivityHex } from './sensorActivity';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

describe('getActivityProgress', () => {
  it('Shall_return_1_when_contact_is_right_now', () => {
    const now = Date.now();
    expect(getActivityProgress(new Date(now).toISOString(), now)).toBe(1);
  });

  it('Shall_return_0_when_contact_is_6_hours_ago', () => {
    const now = Date.now();
    const sixHoursAgo = new Date(now - SIX_HOURS_MS).toISOString();
    expect(getActivityProgress(sixHoursAgo, now)).toBe(0);
  });

  it('Shall_return_0_when_contact_is_older_than_6_hours', () => {
    const now = Date.now();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    expect(getActivityProgress(yesterday, now)).toBe(0);
  });

  it('Shall_return_0_5_when_contact_is_3_hours_ago', () => {
    const now = Date.now();
    const threeHoursAgo = new Date(now - SIX_HOURS_MS / 2).toISOString();
    expect(getActivityProgress(threeHoursAgo, now)).toBeCloseTo(0.5, 1);
  });
});

describe('getSensorActivityColor', () => {
  it('Shall_return_grey_when_stale', () => {
    const now = Date.now();
    const old = new Date(now - SIX_HOURS_MS * 2).toISOString();
    expect(getSensorActivityColor(old, now)).toBe('rgba(148, 163, 184, 0.55)');
  });

  it('Shall_return_green_tinted_color_when_fresh', () => {
    const now = Date.now();
    const fresh = new Date(now).toISOString();
    const color = getSensorActivityColor(fresh, now);
    // Fresh sensor should have high green component
    expect(color).toMatch(/^rgba\(\d+, \d+, 105/);
    // Green should be higher than red
    const match = color.match(/rgba\((\d+), (\d+)/);
    expect(Number(match![2])).toBeGreaterThan(Number(match![1]));
  });
});

describe('getSensorActivityHex', () => {
  it('Shall_return_grey_hex_when_stale', () => {
    const now = Date.now();
    const old = new Date(now - SIX_HOURS_MS * 2).toISOString();
    expect(getSensorActivityHex(old, now)).toBe(0x94a3b8);
  });

  it('Shall_return_green_dominant_hex_when_fresh', () => {
    const now = Date.now();
    const fresh = new Date(now).toISOString();
    const hex = getSensorActivityHex(fresh, now);
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    expect(g).toBeGreaterThan(r);
  });
});
