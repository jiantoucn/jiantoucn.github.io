import { describe, it, expect } from 'vitest';
import { calculateSwiss } from './swiss-logic';

describe('calculateSwiss', () => {
  it('should handle power-of-2 participants correctly', () => {
    // 128 players, 7 rounds should result in exactly one 7-0
    const result = calculateSwiss(128, 7, 8);
    const bracket7_0 = result.brackets.find(b => b.wins === 7);
    expect(bracket7_0?.count).toBe(1);
    
    // Total participants should match
    const total = result.brackets.reduce((acc, b) => acc + b.count, 0);
    expect(total).toBe(128);
  });

  it('should handle odd number of participants with byes', () => {
    // 9 players, 3 rounds
    // Round 1: 4 pairs, 1 bye -> 5 winners (1-0), 4 losers (0-1)
    // Round 2: 
    //   5 players at 1-0: 2 pairs (1 win, 1 loss), 1 move down
    //   4 players at 0-1 + 1 move down = 5: 2 pairs (1 win, 1 loss), 1 bye (1 win)
    //   Winners: 2 (from 1-0) + 2 (from 0-1) + 1 (bye) = 5
    //   Losers: 2 (from 1-0) + 2 (from 0-1) = 4
    // ...and so on.
    const result = calculateSwiss(9, 3, 4);
    const total = result.brackets.reduce((acc, b) => acc + b.count, 0);
    expect(total).toBe(9);
  });

  it('should calculate promotion rates correctly', () => {
    // 100 players, top 8. 
    // In a typical 7-round Swiss, 7-0 and 6-1 will definitely make it.
    // Some 5-2 might make it.
    const result = calculateSwiss(100, 7, 8);
    
    // Top bracket (7-0) should have 100% promotion
    expect(result.brackets[0].promotionRate).toBe(100);
    
    // Total qualified should be topCut
    const totalQualified = result.brackets.reduce((acc, b) => acc + b.qualifiedCount, 0);
    expect(totalQualified).toBe(8);
  });

  it('should handle edge cases like 0 participants or 0 rounds', () => {
    const result0 = calculateSwiss(0, 5, 8);
    expect(result0.brackets).toHaveLength(0);

    const resultR0 = calculateSwiss(128, 0, 8);
    expect(resultR0.brackets).toHaveLength(1);
    expect(resultR0.brackets[0].wins).toBe(0);
    expect(resultR0.brackets[0].count).toBe(128);
  });
});
