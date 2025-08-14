import type { CardT } from '@/lib/cards';
import { exportSessionToPokerStars } from '@/lib/export/pokerstars';
import type { HandHistory, Session } from '@/models/poker';

function card(rank: CardT['rank'], suit: CardT['suit']): CardT { return { rank, suit }; }

describe('exportSessionToPokerStars', () => {
  test('returns message when no session or empty', () => {
    expect(exportSessionToPokerStars(null)).toMatch(/No hands to export/);
    const empty: Session = { id: 's', startTime: Date.now(), hands: [] };
    expect(exportSessionToPokerStars(empty)).toMatch(/No hands to export/);
  });

  test('exports a simple folded preflop hand', () => {
    const hand: HandHistory = {
      handId: 'hand_1',
      timestamp: 1700000000000,
      players: [
        { name: 'Hero', position: 'BTN', cards: [card('A','♠'), card('K','♦')], isHero: true },
        { name: 'P2', position: 'SB', cards: [card('2','♣'), card('7','♥')], isHero: false },
        { name: 'P3', position: 'BB', cards: [card('9','♣'), card('9','♦')], isHero: false },
      ],
      blinds: { smallBlind: 1, bigBlind: 2 },
      communityCards: {},
      actions: [
        { player: 'Hero', action: 'fold', amount: 0, street: 'preflop', timestamp: 1700000001000 },
      ],
      pot: 3,
      result: 'folded',
    };
    const session: Session = { id: 's1', startTime: 1700000000000, hands: [hand] };
    const out = exportSessionToPokerStars(session);
    expect(out).toMatch(/PokerStars Hand #hand_1/);
    expect(out).toMatch(/\*\*\* HOLE CARDS \*\*\*/);
    expect(out).toMatch(/Hero: folds/);
    expect(out).toMatch(/Total pot \$3/);
    expect(out).toMatch(/Hero folded/);
  });

  test('exports completed hand with board and actions per street', () => {
    const hand: HandHistory = {
      handId: 'hand_2',
      timestamp: 1700000000000,
      players: [
        { name: 'Hero', position: 'BTN', cards: [card('A','♠'), card('K','♦')], isHero: true },
        { name: 'Villain', position: 'SB', cards: [card('Q','♣'), card('Q','♥')], isHero: false },
      ],
      blinds: { smallBlind: 1, bigBlind: 2 },
      communityCards: {
        flop: [card('2','♠'), card('5','♦'), card('T','♣')],
        turn: card('J','♠'),
        river: card('A','♣'),
      },
      actions: [
        { player: 'Hero', action: 'raise', amount: 4, street: 'preflop', timestamp: 1700000001000 },
        { player: 'Villain', action: 'call', amount: 4, street: 'preflop', timestamp: 1700000002000 },
        { player: 'Hero', action: 'check', amount: 4, street: 'flop', timestamp: 1700000003000 },
        { player: 'Villain', action: 'raise', amount: 6, street: 'flop', timestamp: 1700000004000 },
        { player: 'Hero', action: 'call', amount: 6, street: 'flop', timestamp: 1700000005000 },
        { player: 'Villain', action: 'check', amount: 6, street: 'turn', timestamp: 1700000006000 },
        { player: 'Hero', action: 'raise', amount: 10, street: 'turn', timestamp: 1700000007000 },
        { player: 'Villain', action: 'call', amount: 10, street: 'turn', timestamp: 1700000008000 },
        { player: 'Hero', action: 'check', amount: 10, street: 'river', timestamp: 1700000009000 },
        { player: 'Villain', action: 'check', amount: 10, street: 'river', timestamp: 1700000010000 },
      ],
      pot: 40,
      result: 'completed',
      heroWon: true,
    };

    const session: Session = { id: 's2', startTime: 1700000000000, hands: [hand] };
    const out = exportSessionToPokerStars(session);
    // Header and seats
    expect(out).toMatch(/PokerStars Hand #hand_2/);
    expect(out).toMatch(/Seat 1: Hero/);
    expect(out).toMatch(/Seat 2: Villain/);
    // Streets and actions
    expect(out).toMatch(/\*\*\* FLOP \*\*\* \[[^\]]+\]/);
    expect(out).toMatch(/\*\*\* TURN \*\*\* \[[^\]]+\]/);
    expect(out).toMatch(/\*\*\* RIVER \*\*\* \[[^\]]+\]/);
    expect(out).toMatch(/Hero: raises \$4/);
    expect(out).toMatch(/Villain: calls \$4/);
    expect(out).toMatch(/Villain: bets \$6/);
    expect(out).toMatch(/Hero: calls \$6/);
    // Summary
    expect(out).toMatch(/\*\*\* SUMMARY \*\*\*/);
    expect(out).toMatch(/Total pot \$40/);
    expect(out).toMatch(/Hero wins the pot/);
  });
});
