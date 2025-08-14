import { betForAction, canHeroCheck, tableCurrentBet } from '@/lib/utils/bets';
import type { Player } from '@/models/poker';

describe('bet math utilities', () => {
  const mk = (over: Partial<Player> = {}): Player => ({ id: 1, name: 'Hero', role: '', bet: 0, cards: ['As','Kd'] as any, isHero: true, ...over });

  test('tableCurrentBet returns max bet across players', () => {
    const players: Player[] = [mk({ bet: 0 }), { ...mk({ id: 2, isHero: false, name: 'P2' }), bet: 3 }];
    expect(tableCurrentBet(players)).toBe(3);
  });

  test('canHeroCheck true when hero bet >= current bet', () => {
    const hero = mk({ bet: 2 });
    const players: Player[] = [hero, { ...mk({ id: 2, isHero: false, name: 'P2' }), bet: 2 }];
    expect(canHeroCheck(players, hero)).toBe(true);
  });

  test('betForAction uses bb when no current bet for raise', () => {
    const hero = mk({ bet: 0 });
    const players: Player[] = [hero];
    expect(betForAction('raise', players, 2, hero)).toBe(2);
  });

  test('betForAction doubles or more when raising against current bet', () => {
    const hero = mk({ bet: 0 });
    const players: Player[] = [hero, { ...mk({ id: 2, isHero: false, name: 'P2' }), bet: 3 }];
    expect(betForAction('raise', players, 2, hero)).toBe(6);
  });

  test('betForAction returns current bet for call and keeps hero bet for check', () => {
    const hero = mk({ bet: 2 });
    const players: Player[] = [hero, { ...mk({ id: 2, isHero: false, name: 'P2' }), bet: 3 }];
    expect(betForAction('call', players, 2, hero)).toBe(3);
    expect(betForAction('check', players, 2, hero)).toBe(2);
  });
});
