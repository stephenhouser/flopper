import { AggressiveAI, PositionalAI, PotOddsAI, TightAI } from '@/lib/ai-models';
import { makeDeck, shuffle, type CardT } from '@/lib/cards';
import { chenScore } from '@/lib/chen';
import type { TrainerSettings } from '@/models/poker';
import { useCallback, useEffect, useRef, useState } from 'react';

// Simple, clean types
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete';

export type SimplePlayer = {
  id: number;
  name: string;
  cards: [CardT, CardT];
  stack: number;
  bet: number;
  folded: boolean;
  isHero: boolean;
  position: number; // 0 = dealer/button
  aiType: string; // 'chen', 'aggressive', 'tight', 'random', etc.
};

export type GameState = {
  players: SimplePlayer[];
  board: CardT[];
  pot: number;
  phase: GamePhase;
  currentBet: number;
  dealerPosition: number;
  activePlayerIndex: number; // whose turn it is
  bigBlind: number;
};

export type PlayerAction = 'fold' | 'call' | 'check' | 'bet' | 'raise';

export type ActionResult = {
  action: PlayerAction;
  amount: number;
  newStack: number;
  newBet: number;
};

// AI Decision Interface - this is where different AI models plug in
export interface AIDecisionMaker {
  decide(player: SimplePlayer, gameState: GameState): ActionResult;
  getName(): string;
}

// Simple Chen-based AI
class ChenAI implements AIDecisionMaker {
  getName() { return 'Chen Rating AI'; }
  
  decide(player: SimplePlayer, gameState: GameState): ActionResult {
    const chenRating = chenScore(player.cards[0], player.cards[1]);
    const potOdds = gameState.pot / Math.max(gameState.currentBet - player.bet, 1);
    
    // Simple decision tree based on Chen score
    if (chenRating >= 10) {
      // Strong hand - always play aggressively
      const raiseAmount = Math.min(gameState.bigBlind * 3, player.stack);
      return {
        action: 'raise',
        amount: raiseAmount,
        newStack: player.stack - raiseAmount,
        newBet: raiseAmount
      };
    } else if (chenRating >= 6) {
      // Medium hand - call if reasonable
      const callAmount = Math.min(gameState.currentBet - player.bet, player.stack);
      if (potOdds > 2 || gameState.currentBet === 0) {
        return {
          action: gameState.currentBet === 0 ? 'check' : 'call',
          amount: callAmount,
          newStack: player.stack - callAmount,
          newBet: player.bet + callAmount
        };
      }
    }
    
    // Weak hand or bad odds - fold
    return {
      action: 'fold',
      amount: 0,
      newStack: player.stack,
      newBet: player.bet
    };
  }
}

// Random AI for testing
class RandomAI implements AIDecisionMaker {
  getName() { return 'Random AI'; }
  
  decide(player: SimplePlayer, gameState: GameState): ActionResult {
    const actions: PlayerAction[] = ['fold', 'call', 'check'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    
    if (action === 'call') {
      const callAmount = Math.min(gameState.currentBet - player.bet, player.stack);
      return {
        action: 'call',
        amount: callAmount,
        newStack: player.stack - callAmount,
        newBet: player.bet + callAmount
      };
    }
    
    return {
      action: gameState.currentBet === 0 ? 'check' : 'fold',
      amount: 0,
      newStack: player.stack,
      newBet: player.bet
    };
  }
}

// AI Registry - easy to add new AI types
const AI_REGISTRY: Record<string, () => AIDecisionMaker> = {
  'chen': () => new ChenAI(),
  'random': () => new RandomAI(),
  'aggressive': () => new AggressiveAI(),
  'tight': () => new TightAI(),
  'positional': () => new PositionalAI(),
  'pot-odds': () => new PotOddsAI(),
};

export function useSimplePoker(settings?: TrainerSettings) {
  // Core game state
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    board: [],
    pot: 0,
    phase: 'waiting',
    currentBet: 0,
    dealerPosition: 0,
    activePlayerIndex: 0,
    bigBlind: 2
  });

  // Deck management
  const [deck, setDeck] = useState<CardT[]>([]);
  
  // AI timing
  const aiTimeoutRef = useRef<number | undefined>(undefined);
  
  // Track last actions for display
  const [lastActions, setLastActions] = useState<Record<number, PlayerAction>>({});
  
  // Track who has acted in the current betting round
  const [playersActed, setPlayersActed] = useState<Set<number>>(new Set());

  // Initialize a new game
  const startNewGame = useCallback((numPlayers: number = 6, bigBlind: number = 2) => {
    // Clear previous actions
    setLastActions({});
    setPlayersActed(new Set());
    
    const newDeck = shuffle(makeDeck());
    const players: SimplePlayer[] = [];
    
    for (let i = 0; i < numPlayers; i++) {
      // Deal 2 cards to each player
      const card1 = newDeck.pop()!;
      const card2 = newDeck.pop()!;
      
      // Assign different AI types to create variety
      let aiType = 'chen';
      if (i === 1) aiType = 'aggressive';
      else if (i === 2) aiType = 'tight';
      else if (i === 3) aiType = 'positional';
      else if (i === 4) aiType = 'pot-odds';
      else if (i === 5) aiType = 'random';
      
      players.push({
        id: i,
        name: i === 0 ? 'Hero' : `${aiType.charAt(0).toUpperCase() + aiType.slice(1)} AI ${i}`,
        cards: [card1, card2],
        stack: bigBlind * 100, // Start with 100 big blinds
        bet: 0,
        folded: false,
        isHero: i === 0,
        position: i,
        aiType: i === 0 ? 'human' : aiType
      });
    }

    // Post blinds
    const smallBlindIndex = (0 + 1) % numPlayers; // Next to dealer
    const bigBlindIndex = (0 + 2) % numPlayers;
    
    const smallBlindAmount = Math.floor(bigBlind / 2);
    players[smallBlindIndex].bet = smallBlindAmount;
    players[smallBlindIndex].stack -= smallBlindAmount;
    players[bigBlindIndex].bet = bigBlind;
    players[bigBlindIndex].stack -= bigBlind;
    
    // Small and big blinds have already "acted" by posting blinds
    setPlayersActed(new Set([players[smallBlindIndex].id, players[bigBlindIndex].id]));

    setDeck(newDeck);
    setGameState({
      players,
      board: [],
      pot: 0,
      phase: 'preflop',
      currentBet: bigBlind,
      dealerPosition: 0,
      activePlayerIndex: (bigBlindIndex + 1) % numPlayers, // First to act after big blind
      bigBlind
    });
  }, []);

  // Deal community cards
  const dealFlop = useCallback(() => {
    setDeck(prevDeck => {
      const newDeck = [...prevDeck];
      const flop = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
      
      setGameState(prev => ({
        ...prev,
        board: flop,
        phase: 'flop',
        currentBet: 0,
        activePlayerIndex: findNextActivePlayer(prev.players, prev.dealerPosition),
        players: prev.players.map(p => ({ ...p, bet: 0 })) // Reset bets for new street
      }));
      
      return newDeck;
    });
  }, []);

  const dealTurn = useCallback(() => {
    setDeck(prevDeck => {
      const newDeck = [...prevDeck];
      const turn = newDeck.pop()!;
      
      setGameState(prev => ({
        ...prev,
        board: [...prev.board, turn],
        phase: 'turn',
        currentBet: 0,
        activePlayerIndex: findNextActivePlayer(prev.players, prev.dealerPosition),
        players: prev.players.map(p => ({ ...p, bet: 0 }))
      }));
      
      return newDeck;
    });
  }, []);

  const dealRiver = useCallback(() => {
    setDeck(prevDeck => {
      const newDeck = [...prevDeck];
      const river = newDeck.pop()!;
      
      setGameState(prev => ({
        ...prev,
        board: [...prev.board, river],
        phase: 'river',
        currentBet: 0,
        activePlayerIndex: findNextActivePlayer(prev.players, prev.dealerPosition),
        players: prev.players.map(p => ({ ...p, bet: 0 }))
      }));
      
      return newDeck;
    });
  }, []);

  // Player action handling
  const handlePlayerAction = useCallback((playerId: number, action: PlayerAction, amount: number = 0) => {
    console.log(`Player ${playerId} action: ${action}, amount: ${amount}`);
    
    // Track that this player has acted in this betting round
    setPlayersActed(prevActed => new Set([...prevActed, playerId]));

    // Track the action for display
    setLastActions(prevActions => {
      const newActions = {
        ...prevActions,
        [playerId]: action
      };
      console.log(`Updated lastActions for player ${playerId}: ${action}`, newActions);
      return newActions;
    });

    setGameState(prev => {
      const newPlayers = [...prev.players];
      const playerIndex = newPlayers.findIndex(p => p.id === playerId);
      const player = newPlayers[playerIndex];
      
      if (!player || player.folded) return prev;

      // Apply the action
      switch (action) {
        case 'fold':
          player.folded = true;
          break;
          
        case 'call':
          const callAmount = Math.min(prev.currentBet - player.bet, player.stack);
          player.bet += callAmount;
          player.stack -= callAmount;
          break;
          
        case 'check':
          // No money changes
          break;
          
        case 'bet':
        case 'raise':
          player.bet += amount;
          player.stack -= amount;
          break;
      }

      // Update current bet if this was a raise/bet
      const newCurrentBet = Math.max(prev.currentBet, player.bet);
      
      // Find next active player
      const nextPlayerIndex = findNextActivePlayer(newPlayers, playerIndex);
      
      return {
        ...prev,
        players: newPlayers,
        currentBet: newCurrentBet,
        activePlayerIndex: nextPlayerIndex
      };
    });
  }, []);

  // AI decision making
  const processAITurn = useCallback(() => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    
    aiTimeoutRef.current = setTimeout(() => {
      setGameState(prev => {
        const currentPlayer = prev.players[prev.activePlayerIndex];
        
        if (!currentPlayer || currentPlayer.isHero || currentPlayer.folded) {
          return prev;
        }

        // Get AI decision
        const aiMaker = AI_REGISTRY[currentPlayer.aiType]?.() || AI_REGISTRY['random']();
        const decision = aiMaker.decide(currentPlayer, prev);
        
        // Apply the decision
        const newPlayers = [...prev.players];
        const player = newPlayers[prev.activePlayerIndex];
        
        player.folded = decision.action === 'fold';
        player.stack = decision.newStack;
        player.bet = decision.newBet;
        
        const newCurrentBet = Math.max(prev.currentBet, player.bet);
        const nextPlayerIndex = findNextActivePlayer(newPlayers, prev.activePlayerIndex);
        
        return {
          ...prev,
          players: newPlayers,
          currentBet: newCurrentBet,
          activePlayerIndex: nextPlayerIndex
        };
      });
    }, 1000); // 1 second delay for AI actions
  }, []);

  // Check if we should advance to next street or end hand
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.activePlayerIndex];
    
    if (gameState.phase === 'waiting' || gameState.phase === 'complete') return;
    
    // Check if betting round is complete
    const activePlayers = gameState.players.filter(p => !p.folded);
    
    if (activePlayers.length <= 1) {
      // Only one player left - end hand immediately
      console.log(`Only ${activePlayers.length} active player(s) left, ending hand`);
      setGameState(prev => ({ ...prev, phase: 'complete' }));
      return;
    }
    
    const playersWithMatchingBets = activePlayers.filter(p => p.bet === gameState.currentBet);
    
    // Don't complete the betting round if it's the hero's turn
    const isHeroTurn = currentPlayer && currentPlayer.isHero && !currentPlayer.folded;
    
    // Simplified betting round completion: all active players have matching bets AND it's not hero's turn
    const isBettingRoundComplete = !isHeroTurn && playersWithMatchingBets.length === activePlayers.length;
    
    console.log(`Phase: ${gameState.phase}, Current player: ${currentPlayer?.id}, Is hero turn: ${isHeroTurn}, Active players: ${activePlayers.map(p => p.id)}, Players with matching bets: ${playersWithMatchingBets.length}/${activePlayers.length}, Betting complete: ${isBettingRoundComplete}`);
    
    if (isBettingRoundComplete) {
      // All active players have matching bets - advance street based on settings
      setTimeout(() => {
        if (gameState.phase === 'preflop') {
          if (settings?.showFlop) {
            dealFlop();
          } else {
            // Skip flop, check if we should go to turn
            if (settings?.showTurn) {
              // Deal flop cards (hidden) and then turn
              const newDeck = [...deck];
              const flopCards = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
              const turnCard = newDeck.pop()!;
              setDeck(newDeck);
              setGameState(prev => ({
                ...prev,
                board: [...flopCards, turnCard],
                phase: 'turn',
                currentBet: 0,
                activePlayerIndex: (prev.dealerPosition + 1) % prev.players.length,
                players: prev.players.map(p => ({ ...p, bet: 0 }))
              }));
            } else if (settings?.showRiver) {
              // Deal flop and turn (hidden) and then river
              const newDeck = [...deck];
              const flopCards = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
              const turnCard = newDeck.pop()!;
              const riverCard = newDeck.pop()!;
              setDeck(newDeck);
              setGameState(prev => ({
                ...prev,
                board: [...flopCards, turnCard, riverCard],
                phase: 'river',
                currentBet: 0,
                activePlayerIndex: (prev.dealerPosition + 1) % prev.players.length,
                players: prev.players.map(p => ({ ...p, bet: 0 }))
              }));
            } else {
              setGameState(prev => ({ ...prev, phase: 'showdown' }));
            }
          }
        }
        else if (gameState.phase === 'flop') {
          if (settings?.showTurn) {
            dealTurn();
          } else if (settings?.showRiver) {
            // Deal turn (hidden) and then river
            const newDeck = [...deck];
            const turnCard = newDeck.pop()!;
            const riverCard = newDeck.pop()!;
            setDeck(newDeck);
            setGameState(prev => ({
              ...prev,
              board: [...prev.board, turnCard, riverCard],
              phase: 'river',
              currentBet: 0,
              activePlayerIndex: (prev.dealerPosition + 1) % prev.players.length,
              players: prev.players.map(p => ({ ...p, bet: 0 }))
            }));
          } else {
            setGameState(prev => ({ ...prev, phase: 'showdown' }));
          }
        }
        else if (gameState.phase === 'turn') {
          if (settings?.showRiver) {
            dealRiver();
          } else {
            setGameState(prev => ({ ...prev, phase: 'showdown' }));
          }
        }
        else if (gameState.phase === 'river') {
          setGameState(prev => ({ ...prev, phase: 'showdown' }));
        }
      }, 500);
      return;
    }
    
    // If it's an AI player's turn, process their action
    if (currentPlayer && !currentPlayer.isHero && !currentPlayer.folded) {
      processAITurn();
    }
  }, [gameState.activePlayerIndex, gameState.phase, gameState.currentBet, settings, deck, processAITurn, dealFlop, dealTurn, dealRiver]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, []);

  return {
    gameState,
    startNewGame,
    handlePlayerAction,
    
    // For UI convenience
    currentPlayer: gameState.players[gameState.activePlayerIndex],
    isHeroTurn: gameState.players[gameState.activePlayerIndex]?.isHero ?? false,
    activePlayers: gameState.players.filter(p => !p.folded),
    totalPot: gameState.pot + gameState.players.reduce((sum, p) => sum + p.bet, 0),
    
    // Action tracking
    lastActions,
  };
}

// Helper function to find next active player
function findNextActivePlayer(players: SimplePlayer[], startIndex: number): number {
  const activePlayers = players.filter(p => !p.folded);
  if (activePlayers.length <= 1) return startIndex;
  
  let nextIndex = (startIndex + 1) % players.length;
  while (players[nextIndex].folded && nextIndex !== startIndex) {
    nextIndex = (nextIndex + 1) % players.length;
  }
  return nextIndex;
}
