/**
 * Core Logic for Swiss Tournament Calculator.
 * 
 * This module provides functions to calculate score distributions and promotion probabilities
 * for Swiss-system tournaments. It uses a simulation-based approach (or distribution propagation)
 * to model the outcomes of each round.
 * 
 * Complexity: O(rounds^2), which is negligible for typical tournament parameters (rounds < 20).
 */

export interface ScoreBracket {
  /** Number of wins */
  wins: number;
  /** Number of losses */
  losses: number;
  /** Total players with this record */
  count: number;
  /** Number of players guaranteed to qualify */
  qualifiedCount: number;
  /** Percentage of players with this record who qualify */
  promotionRate: number;
  /** Cumulative number of players with this record or better */
  cumulativeCount: number;
}

export interface SwissResult {
  /** Distribution of scores */
  brackets: ScoreBracket[];
  /** Total number of participants */
  totalParticipants: number;
  /** Total number of rounds */
  totalRounds: number;
  /** Number of players making the top cut */
  topCut: number;
  /** The minimum wins needed to have a >0% chance of qualifying */
  promotionLine: number;
  /** The minimum wins needed to have a 100% chance of qualifying */
  guaranteedWins: number;
}

/**
 * Calculates the score distribution for a Swiss tournament.
 * 
 * @param participants Total number of players
 * @param rounds Number of Swiss rounds
 * @param topCut Number of players to advance to top cut
 * @returns SwissResult object containing brackets and stats
 */
export function calculateSwiss(
  participants: number,
  rounds: number,
  topCut: number
): SwissResult {
  if (participants <= 0 || rounds < 0 || topCut < 0) {
    return {
      brackets: [],
      totalParticipants: participants,
      totalRounds: rounds,
      topCut,
      promotionLine: 0,
      guaranteedWins: 0,
    };
  }

  // Initial distribution: everyone starts at 0 wins (score 0)
  // Map key: score (wins), value: count of players
  let distribution: Map<number, number> = new Map();
  distribution.set(0, participants);

  // Propagate distribution through rounds
  for (let r = 0; r < rounds; r++) {
    const nextDistribution: Map<number, number> = new Map();
    // Process scores from highest to lowest to handle pairings correctly
    const scores = Array.from(distribution.keys()).sort((a, b) => b - a);
    
    // Carry over represents players who couldn't be paired within their score group (down-pairers)
    // In this simplified model, we assume down-pairers win or lose with 50% prob, 
    // but typically in Swiss logic, the down-paired player is strong and likely to win against a lower score.
    // However, for pure distribution math without player strength modeling, 
    // we assume standard win/loss propagation.
    // Actually, strictly speaking, a down-pair doesn't change the TOTAL wins/losses in the pool differently 
    // than a normal pair, except for the bye.
    let carryOver = 0;

    for (const score of scores) {
      const count = distribution.get(score)! + carryOver;
      const pairs = Math.floor(count / 2);
      const remainder = count % 2;

      // Winners advance to score + 1
      if (pairs > 0) {
        nextDistribution.set(
          score + 1,
          (nextDistribution.get(score + 1) || 0) + pairs
        );
        // Losers stay at current score (in terms of wins) 
        // Note: In some implementations, score is points (3 for win). Here score is wins.
        // So losers stay at 'score' wins.
        nextDistribution.set(
          score,
          (nextDistribution.get(score) || 0) + pairs
        );
      }

      carryOver = remainder;
    }

    // The last person gets a bye (counts as a win)
    if (carryOver > 0) {
      // The person with the lowest score gets the bye
      // In this loop, we are going high to low, so carryOver eventually drops to the bottom
      // But we need to find the lowest score processed to add the bye.
      // Actually, since we process all scores, 'carryOver' after the loop is the last person.
      // But wait, the loop finishes. The last 'score' processed was 0.
      // So the bye goes to 0 -> 1 win.
      // However, if the lowest score group was empty initially, we might need to be careful.
      // But 'scores' contains all keys.
      // Logic check: carryOver drops down. The last 'score' in 'scores' array is the lowest score present.
      // So we should add the bye to (lowestScore + 1).
      
      // Since we just finished the loop, we can just add to nextDistribution at key 0+1?
      // No, it should be whatever the lowest score was + 1.
      // In a standard round 1 start, lowest is 0. Bye becomes 1-0.
      // Correct.
      
      // We can just add it to the lowest key from the previous distribution + 1?
      // Actually, simplest is just: the bye is a free win.
      // The carryOver comes from the absolute bottom.
      // So they get +1 win.
      
      // Let's find the lowest score that actually had players.
      const lowestScore = scores[scores.length - 1]; 
      // Note: carryOver technically belongs to 'lowestScore' bucket (or pushed down from above).
      // So they become lowestScore + 1.
      nextDistribution.set(
        lowestScore + 1,
        (nextDistribution.get(lowestScore + 1) || 0) + 1
      );
    }

    distribution = nextDistribution;
  }

  // Convert map to sorted array of brackets
  const finalScores = Array.from(distribution.entries())
    .map(([wins, count]) => ({
      wins,
      losses: rounds - wins,
      count,
    }))
    .sort((a, b) => b.wins - a.wins);

  // Calculate Top Cut and Promotion Rates
  let cumulative = 0;
  let promotionLine = 0;
  let guaranteedWins = 0;
  const brackets: ScoreBracket[] = [];

  for (const bracket of finalScores) {
    const prevCumulative = cumulative;
    cumulative += bracket.count;

    let qualifiedCount = 0;
    
    if (prevCumulative >= topCut) {
      // Already filled top cut
      qualifiedCount = 0;
    } else if (cumulative <= topCut) {
      // Entire bracket is qualified
      qualifiedCount = bracket.count;
      // If we haven't set guaranteedWins yet, and this bracket fits entirely,
      // it means this score is guaranteed.
      // WAIT: Logic check.
      // If topCut is 8.
      // 7-0: 1 player. Cum: 1. Fits.
      // 6-1: 7 players. Cum: 8. Fits.
      // So 6-1 is guaranteed.
      // 5-2: 21 players. Cum: 29. Overflow.
      
      // guaranteedWins logic: The LOWEST score where everyone is safe.
      // So if 6-1 is safe, guaranteedWins <= 6.
      // We should update guaranteedWins as we go down, as long as the bracket is fully qualified.
      guaranteedWins = bracket.wins;
    } else {
      // Partial qualification (The Bubble)
      qualifiedCount = topCut - prevCumulative;
      promotionLine = bracket.wins;
    }

    brackets.push({
      ...bracket,
      qualifiedCount,
      promotionRate: bracket.count > 0 ? (qualifiedCount / bracket.count) * 100 : 0,
      cumulativeCount: cumulative,
    });
  }
  
  // Refine guaranteedWins
  // The loop above updates guaranteedWins every time a full bracket fits.
  // Since we go from high to low, the last time we update it, it will be the lowest score that fits.
  // Example: 8 cut.
  // 7-0 (1): Fits. GW=7.
  // 6-1 (7): Fits. GW=6.
  // 5-2 (21): Partial. GW stays 6.
  // So GW is 6. Correct.
  
  // Edge case: No one is guaranteed (e.g. Top 8, but 10 people at X-0).
  // Then GW should be higher than the highest score?
  // Or just "undefined"?
  // The UI shows "Guaranteed Wins".
  // If even X-0 isn't guaranteed (rare, but possible if participants < topCut? No, if participants > topCut but few rounds).
  // If 10 people are 7-0 and topCut is 8.
  // 7-0 (10): Partial. GW never updated (starts 0).
  // In that case, guaranteedWins is technically "impossible" or > max rounds.
  // We'll handle this by checking if guaranteedWins is still 0 (assuming >0 rounds).
  
  // Correction: If guaranteedWins is 0, it might mean we never found a fully qualified bracket.
  // But if rounds=0, wins=0.
  // Let's ensure reasonable fallback.
  
  if (guaranteedWins === 0 && brackets.length > 0 && brackets[0].promotionRate < 100) {
      // Even the top bracket isn't 100%.
      // Set guaranteed to rounds + 1 (impossible)
      guaranteedWins = rounds + 1;
  }

  return {
    brackets,
    totalParticipants: participants,
    totalRounds: rounds,
    topCut,
    promotionLine: promotionLine,
    guaranteedWins: guaranteedWins,
  };
}
