import { describe, expect, it } from 'vitest';
import { loadHistoricalApp } from '../helpers/load-historical-app.js';

const app = loadHistoricalApp();

describe('approved historical dataset regression', () => {
  it('preserves all-time title totals and deterministic insertion-order ties', () => {
    const stats = app.buildStats('all');
    expect(stats.total).toBe(18);
    expect(stats.tally).toEqual({
      'Mac Alvi': 5,
      'Anjishu Bhattacharjee': 1,
      'Shamjid Siraj': 1,
      'Arka Basak': 2,
      'Abrar Siddique': 5,
      'Rainul Islam': 1,
      'Irfan Ahmed': 1,
      'Ohidul Islam': 1,
      'Sajid Sadman': 1
    });
    expect(stats.sorted.slice(0, 3)).toEqual([
      ['Mac Alvi', 5],
      ['Abrar Siddique', 5],
      ['Arka Basak', 2]
    ]);
  });

  it('filters last five and last ten seasons exactly', () => {
    expect(app.getFilteredSeasons('last5').map((season) => season.year)).toEqual([
      '2021/22', '2022/23', '2023/24', '2024/25', '2025/26'
    ]);
    expect(app.getFilteredSeasons('last10')).toHaveLength(10);
    expect(app.getFilteredSeasons('last10')[0].year).toBe('2016/17');
  });

  it('preserves streak, drought, and comeback calculations', () => {
    expect(app.trailingStreak(app.seasons, 'Abrar Siddique')).toBe(1);
    expect(app.trailingStreak(app.seasons.slice(0, 2), 'Mac Alvi')).toBe(2);
    expect(app.longestEverStreak()).toEqual({ name: 'Mac Alvi', len: 2 });
    expect(app.seasonsSinceLastWin('Anjishu Bhattacharjee')).toBe(15);
    expect(app.seasonsSinceLastWin('Unknown Manager')).toBe(18);
    expect(app.seasonsForManager('Jawadur Rahman', '2008/09')).toBe(18);
    expect(app.comebackKing()).toEqual({ name: 'Mac Alvi', gap: 8 });
  });

  it('preserves runner-up and chief bottler behavior', () => {
    const stats = app.buildStats('all');
    expect(stats.bottleLeader).toEqual({ name: 'Irfan Ahmed', count: 3 });
    expect(stats.awardsShame.find((award) => award.title === 'Chief Bottler')).toEqual({
      emoji: '🍾',
      title: 'Chief Bottler',
      winner: 'Irfan Ahmed',
      detail: "3× runner-up, couldn't finish the job"
    });
  });

  it('preserves never-won and one-and-done classifications', () => {
    const stats = app.buildStats('all');
    expect(stats.neverWon.map((manager) => manager.name)).toEqual(['Jawadur Rahman', 'Wakif Mahmud']);
    expect(stats.awardsShame.find((award) => award.title === 'One & Done')?.winner)
      .toBe('Anjishu Bhattacharjee, Shamjid Siraj');
  });

  it('normalizes duplicate or ambiguous names without silently merging historical records', () => {
    expect(app.normalizeName('  Mac   Alvi ')).toBe('mac alvi');
    expect(app.normalizeName('MAC ALVI')).toBe('mac alvi');
    expect(app.seasons.filter((season) => season.winner === 'Mac Alvi')).toHaveLength(5);
  });
});

describe('characterized edge behavior', () => {
  it('handles empty and single-season arrays in the directly parameterized helper', () => {
    expect(app.trailingStreak([], 'Nobody')).toBe(0);
    expect(app.trailingStreak([{ winner: 'Solo' }], 'Solo')).toBe(1);
    expect(app.trailingStreak([{ winner: 'Solo' }], 'Other')).toBe(0);
  });

  it('records missing runner-up information without inventing values', () => {
    const missing = app.seasons.filter((season) => !season.runnerUp);
    expect(missing).toHaveLength(10);
    expect(missing.every((season) => season.runnerUp === '')).toBe(true);
  });
});
