import { CardT, makeDeck, shuffle } from '@/lib/cards';
import { assignPositions, awardPotToWinner, canPlayerAfford, collectBets, createInitialPlayers, dealFlopFromDeck, dealPlayers, dealRiverFromDeck, dealTurnFromDeck, deductBetFromStack, minRaise, nextStreet, placeBet, resetBets, settleBetsIntoPot, smallBlindFromBigBlind, totalPot } from '@/lib/gameplay';
import { Player } from '@/models/poker';

function topN(deck: CardT[], n: number): CardT[] { return deck.slice(-n); }

describe('gameplay core helpers', () => {
  test('assignPositions assigns BTN/SB/BB correctly', () => {
    const roles = assignPositions(6, 0);
    expect(roles[0].pos).toBe(0); // Dealer
    expect(roles[1].pos).toBe(1); // SB
    expect(roles[2].pos).toBe(2); // BB
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
    const initialPlayers = createInitialPlayers(6, 0, 2);
    const { players } = dealPlayers(initialPlayers, deck, 2, 0);
    const updated = players.map(p => ({ ...p, bet: 2 }));
    const { pot, players: cleared } = settleBetsIntoPot(10, updated as any);
    expect(pot).toBe(10 + 6 * 2);
    expect((cleared as any).every((p: any) => p.bet === 0)).toBe(true);
  });

  test('totalPot adds bets to pot', () => {
    const deck = shuffle(makeDeck());
    const initialPlayers = createInitialPlayers(6, 0, 2);
    const { players } = dealPlayers(initialPlayers, deck, 2, 0);
    const updated = players.map(p => ({ ...p, bet: 1 }));
    const sum = totalPot(5, updated as any);
    expect(sum).toBe(5 + 6);
  });

  test('collectBets and resetBets utility', () => {
    const deck = shuffle(makeDeck());
    const initialPlayers = createInitialPlayers(6, 0, 2);
    const { players } = dealPlayers(initialPlayers, deck, 2, 0);
    const updated = players.map(p => ({ ...p, bet: 3 }));
    expect(collectBets(updated as any)).toBe(18);
    const cleared = resetBets(updated as any);
    expect(collectBets(cleared as any)).toBe(0);
  });

  test('stack management utilities work correctly', () => {
    const deck = shuffle(makeDeck());
    const initialPlayers = createInitialPlayers(2, 0, 10); // bigBlind = 10, so stack = 1000
    const { players } = dealPlayers(initialPlayers, deck, 10, 0);
    
    // In heads-up: dealer is small blind, non-dealer is big blind
    // After rotation, small blind comes first in array
    const sbPlayer = players[0]; // Small blind (dealer): pos=0, bet=5, stack=995
    const bbPlayer = players[1]; // Big blind (non-dealer): pos=1, bet=10, stack=990
    
    // Verify correct blind structure
    expect((sbPlayer as any).isSmallBlind).toBe(true);
    expect((bbPlayer as any).isBigBlind).toBe(true);
    expect(sbPlayer.position).toBe(0); // Dealer position
    expect(bbPlayer.position).toBe(1); // Non-dealer position
    expect(sbPlayer.bet).toBe(5); // Small blind amount
    expect(sbPlayer.stack).toBe(995); // 1000 - 5
    expect(bbPlayer.bet).toBe(10); // Big blind amount
    expect(bbPlayer.stack).toBe(990); // 1000 - 10
    
    // Test deducting bet from stack using small blind player
    const afterBet = deductBetFromStack(sbPlayer, 100);
    expect(afterBet.stack).toBe(895); // 995 - 100
    expect(afterBet.bet).toBe(105); // 5 + 100
    
    // Test awarding pot to winner
    const afterWin = awardPotToWinner(afterBet, 200);
    expect(afterWin.stack).toBe(1095); // 895 + 200
    
    // Test affordability check
    expect(canPlayerAfford(sbPlayer, 500)).toBe(true);
    expect(canPlayerAfford(sbPlayer, 1500)).toBe(false);
  });

  test('placeBet function correctly deducts from stack and handles edge cases', () => {
    const deck = shuffle(makeDeck());
    const initialPlayers = createInitialPlayers(3, 0, 10);
    const { players } = dealPlayers(initialPlayers, deck, 10, 0);
    
    const player = players[0]; // Get any player
    const originalStack = player.stack;
    const originalBet = player.bet;
    
    // Test normal bet increase
    const afterRaise = placeBet(player, originalBet + 50);
    expect(afterRaise.bet).toBe(originalBet + 50);
    expect(afterRaise.stack).toBe(originalStack - 50);
    
    // Test betting same amount (no change)
    const noChange = placeBet(player, originalBet);
    expect(noChange.bet).toBe(originalBet);
    expect(noChange.stack).toBe(originalStack);
    
    // Test all-in protection (can't bet more than stack)
    const allIn = placeBet(player, originalStack + 100);
    expect(allIn.bet).toBe(originalBet + originalStack);
    expect(allIn.stack).toBe(0);
    
    // Test zero bet amount
    const zeroBet = placeBet(player, 0);
    expect(zeroBet.bet).toBe(Math.max(0, originalBet));
    expect(zeroBet.stack).toBe(originalStack);
  });

  test('heads-up blind structure is correct', () => {
    const deck = shuffle(makeDeck());
    const initialPlayers = createInitialPlayers(2, 0, 10); // bigBlind = 10
    const { players } = dealPlayers(initialPlayers, deck, 10, 0); // dealer position 0
    
    // After rotation, the small blind comes first in the array
    // In heads-up: dealer is small blind, so dealer comes first after rotation
    const sbPlayer = players[0]; // Small blind (dealer)
    const bbPlayer = players[1]; // Big blind (non-dealer)
    
    // Verify correct blind assignments
    expect((sbPlayer as any).isSmallBlind).toBe(true);
    expect((sbPlayer as any).isBigBlind).toBe(false);
    expect(sbPlayer.bet).toBe(5); // Small blind amount
    expect(sbPlayer.stack).toBe(995); // 1000 - 5
    
    expect((bbPlayer as any).isSmallBlind).toBe(false);
    expect((bbPlayer as any).isBigBlind).toBe(true);
    expect(bbPlayer.bet).toBe(10); // Big blind amount
    expect(bbPlayer.stack).toBe(990); // 1000 - 10
  });

  test('blind posting works correctly', () => {
    // Create a simple test player
    const testPlayer = new Player({
      id: 0,
      name: "Test",
      cards: [new CardT("A", "♠"), new CardT("K", "♥")],
      position: 0,
      nPlayers: 2,
      stack: 1000,
      isHero: false,
    });
    
    // Test small blind
    const sbResult = placeBet(testPlayer, 5);
    expect(sbResult.bet).toBe(5);
    expect(sbResult.stack).toBe(995);
    
    // Test big blind  
    const bbResult = placeBet(testPlayer, 10);
    expect(bbResult.bet).toBe(10);
    expect(bbResult.stack).toBe(990);
  });
});
