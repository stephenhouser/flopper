import { makeDeck, shuffle } from '@/lib/cards';
import type { CardT } from '@/lib/cards';
import { assignRolesAndPositions, dealFlopFromDeck, dealPlayers, dealRiverFromDeck, dealTurnFromDeck, minRaise, nextStreet, rotateToSmallBlindFirst, settleBetsIntoPot, smallBlindFromBigBlind, totalPot, collectBets, resetBets } from '@/lib/gameplay';
import { DEFAULT_SETTINGS } from '@/models/poker';

function topN(deck: CardT[], n: number): CardT[] { return deck.slice(-n); }

describe('gameplay core helpers', () => {
  test('assignRolesAndPositions assigns BTN/SB/BB correctly', () => {
    const roles = assignRolesAndPositions(6, 0);
    expect(roles[0].role).toBe('Dealer');
    expect(roles[1].role).toBe('SB');
    expect(roles[2].role).toBe('BB');
  });

  test('rotateToSmallBlindFirst rotates correctly', () => {
    const deck = shuffle(makeDeck());
    const { players } = dealPlayers(6, deck, 2, 0, 0);
    const order = players.map(p => p.role);
    expect(order[0]).toBe('SB');
    expect(order[1]).toBe('BB');
  });

  test('smallBlindFromBigBlind respects min and factor', () => {
    expect(smallBlindFromBigBlind(2)).toBe(1);
    expect(smallBlindFromBigBlind(10)).toBe(5);
  });

  test('deal community streets pulls from deck end', () => {
    const deck = shuffle(makeDeck());
    const flopTop = topN(deck, 3);
    const { flop, deck: d1 } = dealFlopFromDeck(deck);
    expect(flop).toEqual(flopTop.reverse());
    const turnTop = topN(d1, 1);
    const { turn, deck: d2 } = dealTurnFromDeck(d1);
    expect(turn).toEqual(turnTop[0]);
    const riverTop = topN(d2, 1);
    const { river } = dealRiverFromDeck(d2);
    expect(river).toEqual(riverTop[0]);
  });

  test('minRaise uses bb when no current bet, else doubles or more', () => {
    expect(minRaise(0, 2)).toBe(2);
    expect(minRaise(2, 2)).toBe(4);
    expect(minRaise(3, 2)).toBe(6);
  });

  test('nextStreet honors settings', () => {
    const s0 = { showFlop: false, showTurn: true, showRiver: true };
    expect(nextStreet('preflop', s0)).toBe('complete');
    const s1 = { showFlop: true, showTurn: false, showRiver: true };
    expect(nextStreet('preflop', s1)).toBe('flop');
    expect(nextStreet('flop', s1)).toBe('complete');
  });

  test('settleBetsIntoPot collects all bets and resets', () => {
    const deck = shuffle(makeDeck());
    const { players } = dealPlayers(6, deck, 2, 0, 0);
    const updated = players.map(p => ({ ...p, bet: 2 }));
    const { pot, players: cleared } = settleBetsIntoPot(10, updated);
    expect(pot).toBe(10 + 6 * 2);
    expect(cleared.every(p => p.bet === 0)).toBe(true);
  });

  test('totalPot adds bets to pot', () => {
    const deck = shuffle(makeDeck());
    const { players } = dealPlayers(6, deck, 2, 0, 0);
    const updated = players.map(p => ({ ...p, bet: 1 }));
    const sum = totalPot(5, updated);
    expect(sum).toBe(5 + 6);
  });

  test('collectBets and resetBets utility', () => {
    const deck = shuffle(makeDeck());
    const { players } = dealPlayers(6, deck, 2, 0, 0);
    const updated = players.map(p => ({ ...p, bet: 3 }));
    expect(collectBets(updated)).toBe(18);
    const cleared = resetBets(updated);
    expect(collectBets(cleared)).toBe(0);
  });
});
