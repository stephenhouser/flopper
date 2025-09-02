import { getRandomAIType, makeAIDecision } from '@/lib/ai-models';
import { makeDeck, shuffle, type CardT } from '@/lib/cards';
import { chenScore } from '@/lib/chen';
import { DEFAULT_TRAINER_SETTINGS, Player, type Action, type Street, type TexasHoldemSettings } from '@/models/poker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { usePersistedState } from './usePersistedState';
import { useSession } from './useSession';

// Game phase type
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete';

export type GameState = {
  players: Player[];
  board: CardT[];
  pot: number;
  phase: GamePhase;
  currentBet: number;
  dealerPosition: number;
  activePlayerIndex: number;
  bigBlind: number;
};

// Create initial players
function createPlayers(numPlayers: number, bigBlind: number, dealerPosition: number): Player[] {
  const deck = shuffle(makeDeck());
  const players: Player[] = [];
  
  for (let i = 0; i < numPlayers; i++) {
    const card1 = deck.pop()!;
    const card2 = deck.pop()!;
    
    players.push(new Player({
      id: i,
      name: i === 0 ? 'Hero' : `Player ${i + 1}`,
      cards: [card1, card2],
      position: i,
      nPlayers: numPlayers,
      dealerPosition,
      stack: bigBlind * 100, // 100 BB starting stack
      isHero: i === 0,
      bet: 0,
      folded: false,
      aiType: i === 0 ? undefined : getRandomAIType()
    }));
  }
  
  // Post blinds
  if (numPlayers >= 2) {
    const sbIndex = (dealerPosition + 1) % numPlayers;
    const bbIndex = (dealerPosition + 2) % numPlayers;
    
    players[sbIndex].bet = Math.floor(bigBlind / 2);
    players[sbIndex].stack -= players[sbIndex].bet;
    
    players[bbIndex].bet = bigBlind;
    players[bbIndex].stack -= players[bbIndex].bet;
  }
  
  return players;
}

function findNextActivePlayer(players: Player[], startIndex: number): number {
  const activePlayers = players.filter(p => !p.folded);
  if (activePlayers.length <= 1) return startIndex;
  
  let nextIndex = (startIndex + 1) % players.length;
  while (players[nextIndex].folded && nextIndex !== startIndex) {
    nextIndex = (nextIndex + 1) % players.length;
  }
  return nextIndex;
}

// Main consolidated hook
export function useTexasHoldem() {
  // Settings management
  const [settings, setSettings] = usePersistedState<TexasHoldemSettings>(
    'flopper_trainer_settings',
    DEFAULT_TRAINER_SETTINGS
  );

  // Session management
  const { currentSession, setCurrentSession, startNewSession: createNewSession, ready } = useSession('Texas Holdem');

  // Game state
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    board: [],
    pot: 0,
    phase: 'waiting',
    currentBet: 0,
    dealerPosition: 0,
    activePlayerIndex: 0,
    bigBlind: settings.bigBlind
  });

  const [deck, setDeck] = useState<CardT[]>([]);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [revealedPlayers, setRevealedPlayers] = useState<Set<number>>(new Set());
  const [lastAction, setLastAction] = useState<'' | Action>('');
  const [lastActionCorrect, setLastActionCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState<string>('');
  const [buttonsDisabled, setButtonsDisabled] = useState(false);
  
  // Stats
  const [totalHands, setTotalHands] = useState(0);
  const [correctHands, setCorrectHands] = useState(0);
  
  // Flash animation
  const heroFlashOpacity = useRef(new Animated.Value(0)).current;
  const [heroFlash, setHeroFlash] = useState<'none' | 'correct' | 'incorrect' | 'active'>('none');
  
  // Action pulse tracking
  const [pulseCounter, setPulseCounter] = useState(0);
  const lastActionPlayerRef = useRef<number | null>(null);

  // AI processing
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived values
  const hero = gameState.players.find(p => p.isHero);
  const heroScore = hero ? chenScore(hero.cards[0], hero.cards[1]) : 0;
  const currentPlayer = gameState.players[gameState.activePlayerIndex];
  const isHeroTurn = currentPlayer?.isHero ?? false;
  const canCheck = gameState.currentBet === 0 || (hero?.bet === gameState.currentBet);
  const totalPot = gameState.pot + gameState.players.reduce((sum, p) => sum + p.bet, 0);

  // Ensure session exists
  useEffect(() => {
    if (ready && !currentSession) {
      createNewSession();
    }
  }, [ready, currentSession, createNewSession]);

  // Start new game
  const startNewGame = useCallback((numPlayers = settings.numPlayers, bigBlind = settings.bigBlind) => {
    const dealerPosition = Math.floor(Math.random() * numPlayers);
    const players = createPlayers(numPlayers, bigBlind, dealerPosition);
    const newDeck = shuffle(makeDeck());
    
    // Remove dealt cards from deck
    players.forEach(player => {
      const card1Index = newDeck.findIndex(card => card.rank === player.cards[0].rank && card.suit === player.cards[0].suit);
      const card2Index = newDeck.findIndex(card => card.rank === player.cards[1].rank && card.suit === player.cards[1].suit);
      if (card1Index !== -1) newDeck.splice(card1Index, 1);
      if (card2Index !== -1) newDeck.splice(card2Index, 1);
    });
    
    setDeck(newDeck);
    setGameState({
      players,
      board: [],
      pot: 0,
      phase: 'preflop',
      currentBet: bigBlind,
      dealerPosition,
      activePlayerIndex: (dealerPosition + 3) % numPlayers, // UTG starts
      bigBlind
    });
    
    setRevealedPlayers(new Set());
    setLastAction('');
    setLastActionCorrect(null);
    setResult('');
    setButtonsDisabled(false);
    setPulseCounter(prev => prev + 1);
  }, [settings.numPlayers, settings.bigBlind]);

  // Handle player actions
  const handlePlayerAction = useCallback((playerId: number, action: Action, amount = 0) => {
    setGameState(prev => {
      const playerIndex = prev.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return prev;
      
      const player = prev.players[playerIndex];
      const newPlayers = [...prev.players];
      
      if (action === 'fold') {
        player.folded = true;
        player.lastAction = action;
      } else if (action === 'call') {
        const callAmount = Math.min(prev.currentBet - player.bet, player.stack);
        player.bet += callAmount;
        player.stack -= callAmount;
        player.lastAction = action;
      } else if (action === 'check') {
        player.lastAction = action;
      } else if (action === 'raise') {
        const raiseAmount = Math.min(amount, player.stack);
        player.bet += raiseAmount;
        player.stack -= raiseAmount;
        player.lastAction = action;
        return {
          ...prev,
          players: newPlayers,
          currentBet: player.bet,
          activePlayerIndex: findNextActivePlayer(newPlayers, playerIndex)
        };
      }
      
      return {
        ...prev,
        players: newPlayers,
        activePlayerIndex: findNextActivePlayer(newPlayers, playerIndex)
      };
    });
  }, []);

  // Hero action handler
  const act = useCallback((action: Action) => {
    if (!hero || !isHeroTurn) return;
    
    setButtonsDisabled(true);
    setLastAction(action);
    
    // Simple feedback logic
    let correct = false;
    let feedbackText = '';
    
    if (action === 'fold') {
      correct = heroScore < 6;
      feedbackText = correct ? 'Good fold with weak hand' : 'Folding a decent hand';
    } else if (action === 'raise') {
      correct = heroScore >= 8;
      feedbackText = correct ? 'Good aggressive play' : 'Raising with marginal hand';
    } else {
      correct = true;
      feedbackText = 'Safe play';
    }
    
    setLastActionCorrect(correct);
    setResult(feedbackText);
    
    // Flash animation
    if (settings.showFeedback) {
      setHeroFlash(correct ? 'correct' : 'incorrect');
      heroFlashOpacity.setValue(1);
      Animated.timing(heroFlashOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setHeroFlash('none');
      });
    }
    
    // Update stats
    setTotalHands(prev => prev + 1);
    if (correct) {
      setCorrectHands(prev => prev + 1);
    }
    
    // Handle the action
    let amount = 0;
    if (action === 'call') {
      amount = gameState.currentBet - (hero.bet || 0);
    } else if (action === 'raise') {
      amount = gameState.bigBlind * 2;
    }
    
    handlePlayerAction(hero.id, action, amount);
    
    setTimeout(() => {
      setButtonsDisabled(false);
    }, 1000);
  }, [hero, isHeroTurn, heroScore, gameState.currentBet, gameState.bigBlind, settings.showFeedback, heroFlashOpacity, handlePlayerAction]);

  // AI turn processing
  const processAITurn = useCallback(() => {
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    
    aiTimeoutRef.current = setTimeout(() => {
      if (currentPlayer && !currentPlayer.isHero && !currentPlayer.folded) {
        const decision = makeAIDecision(currentPlayer, gameState);
        handlePlayerAction(currentPlayer.id, decision.action, decision.amount);
      }
    }, 1000);
  }, [currentPlayer, gameState, handlePlayerAction]);

  // Auto-process AI turns
  useEffect(() => {
    if (currentPlayer && !currentPlayer.isHero && !currentPlayer.folded && gameState.phase === 'preflop') {
      processAITurn();
    }
  }, [gameState.activePlayerIndex, gameState.phase, processAITurn, currentPlayer]);

  // Toggle player reveal
  const togglePlayerReveal = useCallback((playerId: number) => {
    setRevealedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  }, []);

  // Pulse key for animations
  const pulseKey = useCallback((player: Player): number => {
    return lastActionPlayerRef.current === player.id ? pulseCounter : 0;
  }, [pulseCounter]);

  // New hand
  const newHand = useCallback(() => {
    startNewGame(settings.numPlayers, settings.bigBlind);
  }, [settings.numPlayers, settings.bigBlind, startNewGame]);

  // Deal table (compatibility)
  const dealTable = useCallback((numPlayers: number) => {
    startNewGame(numPlayers, settings.bigBlind);
  }, [settings.bigBlind, startNewGame]);

  // Start new session
  const startNewSession = useCallback(() => {
    setTotalHands(0);
    setCorrectHands(0);
    createNewSession();
    startNewGame();
  }, [createNewSession, startNewGame]);

  // Auto-start when ready
  useEffect(() => {
    if (gameState.phase === 'waiting' && ready) {
      startNewGame(settings.numPlayers, settings.bigBlind);
    }
  }, [gameState.phase, ready, settings.numPlayers, settings.bigBlind, startNewGame]);

  // Re-enable buttons when it's hero's turn
  useEffect(() => {
    if (isHeroTurn && !hero?.folded) {
      setButtonsDisabled(false);
    }
  }, [isHeroTurn, hero?.folded]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, []);

  return {
    // Settings
    settings,
    setSettings,
    
    // Game state  
    players: gameState.players,
    currentStreet: gameState.phase === 'preflop' ? 'preflop' as Street : 
                  gameState.phase === 'flop' ? 'flop' as Street :
                  gameState.phase === 'turn' ? 'turn' as Street :
                  gameState.phase === 'river' ? 'river' as Street : 'complete' as Street,
    board: gameState.board,
    dealerPosition: gameState.dealerPosition,
    foldedHand: hero?.folded ?? false,
    heroWonHand: null,
    revealedPlayers,
    togglePlayerReveal,
    
    // Stats and feedback
    heroAction: lastAction,
    lastActionCorrect,
    result,
    totalHands,
    correctHands,
    
    // Session
    currentSession,
    setCurrentSession,
    startNewSession,
    
    // UI state
    showSettings,
    setShowSettings,
    heroFlash,
    heroFlashOpacity,
    buttonsDisabled: buttonsDisabled || !isHeroTurn,
    
    // Turn management
    currentPlayer,
    isHeroTurn,
    activePlayerIndex: gameState.activePlayerIndex,
    
    // Derived values
    heroScore,
    canCheck,
    totalPot,
    pulseKey,
    
    // Actions
    dealTable,
    newHand,
    act,
    
    // Legacy compatibility
    pot: totalPot,
    street: gameState.phase === 'preflop' ? 'preflop' as Street : 
           gameState.phase === 'flop' ? 'flop' as Street :
           gameState.phase === 'turn' ? 'turn' as Street :
           gameState.phase === 'river' ? 'river' as Street : 'complete' as Street,
    hero,
    handleHeroAction: act,
    gamePhase: gameState.phase,
    currentBet: gameState.currentBet,
    bigBlind: gameState.bigBlind,
  };
}
