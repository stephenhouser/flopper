import React from 'react';
import { act, renderHook } from '@testing-library/react';
import useHandHistory from '@/hooks/useHandHistory';
import type { Player, Session } from '@/models/poker';

function makePlayers(): Player[] {
  return Array.from({ length: 2 }).map((_, i) => ({
    id: i + 1,
    name: i === 0 ? 'Hero' : `P${i+1}`,
    isHero: i === 0,
    position: i === 0 ? 'SB' : 'BB',
    positionLabel: i === 0 ? 'SB' : 'BB',
    role: i === 0 ? 'SB' : 'BB',
    bet: 0,
    stack: 100,
    cards: [ { rank: 'A', suit: 's' }, { rank: 'K', suit: 's' } ],
  })) as unknown as Player[];
}

describe('useHandHistory', () => {
  test('create, add actions, and finalize updates session', () => {
    const initialSession: Session = { id: 's1', startTime: Date.now(), hands: [] };

    const { result } = renderHook(() => {
      const [session, setSession] = React.useState<Session | null>(initialSession);
      const hh = useHandHistory({ session, setSession, bigBlind: 2 });
      return { session, setSession, ...hh };
    });

    const players = makePlayers();

    act(() => {
      result.current.createHandHistory(players);
    });

    // add two actions on preflop
    act(() => {
      result.current.addActionToHistory('raise', 4, 'preflop', 'Hero');
      result.current.addActionToHistory('call', 4, 'preflop', 'P2');
    });

    expect(result.current.currentHandHistory?.actions).toHaveLength(2);

    // finalize as folded
    act(() => {
      result.current.finalizeHand({ pot: 6, result: 'folded', communityCards: {} });
    });

    expect(result.current.currentHandHistory).toBeNull();
    expect(result.current.session?.hands?.length ?? 0).toBe(1);
    const hand = (result.current.session as Session).hands[0];
    expect(hand.pot).toBe(6);
    expect(hand.result).toBe('folded');
  });
});
