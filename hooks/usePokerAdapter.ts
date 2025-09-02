// Enhanced adapter to connect new simple backend to existing UI components
import { chenScore } from '@/lib/chen';
import { DEFAULT_TRAINER_SETTINGS, Player, type Action, type Street, type TrainerSettings } from '@/models/poker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { usePersistedState } from './usePersistedState';
import { useSimplePoker, type GameState, type SimplePlayer } from './useSimplePoker';

// Convert SimplePlayer to the UI's expected Player format
function adaptPlayer(simplePlayer: SimplePlayer, gameState: GameState): Player {
  return new Player({
    id: simplePlayer.id,
    name: simplePlayer.name,
    cards: simplePlayer.cards,
    position: simplePlayer.position,
    nPlayers: gameState.players.length,
    stack: simplePlayer.stack,
    isHero: simplePlayer.isHero,
    bet: simplePlayer.bet,
    folded: simplePlayer.folded,
  });
}

// Enhanced adapter hook that provides the same interface your UI expects
export function usePokerGame() {
  // Settings management (must be first)
  const [settings, setSettings] = usePersistedState<TrainerSettings>(
    'flopper_trainer_settings',
    DEFAULT_TRAINER_SETTINGS
  );

  const {
    gameState,
    startNewGame,
    handlePlayerAction,
    currentPlayer,
    isHeroTurn,
    activePlayers,
    totalPot,
    lastActions,
  } = useSimplePoker(settings);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [revealedPlayers, setRevealedPlayers] = useState<Set<number>>(new Set());
  const [lastAction, setLastAction] = useState<'' | Action>('');
  const [lastActionCorrect, setLastActionCorrect] = useState<boolean | null>(null);
  const [result, setResult] = useState<string>('');
  const [buttonsDisabled, setButtonsDisabled] = useState(false);
  
  // Session tracking (simplified)
  const [totalHands, setTotalHands] = useState(0);
  const [correctHands, setCorrectHands] = useState(0);
  
  // Flash animation for hero feedback
  const heroFlashOpacity = useRef(new Animated.Value(0)).current;
  const [heroFlash, setHeroFlash] = useState<'none' | 'correct' | 'incorrect' | 'active'>('none');
  
  // Action pulse tracking
  const [pulseCounter, setPulseCounter] = useState(0);
  const lastActionPlayerRef = useRef<number | null>(null);
  const [playerLastActions, setPlayerLastActions] = useState<Record<number, Action>>({});

  // Convert simple players to UI Player objects
  const players = useMemo(() => 
    gameState.players.map(p => adaptPlayer(p, gameState)),
    [gameState.players, gameState]
  );

  // Hero-specific data
  const hero = players.find(p => p.isHero);
  const heroScore = hero ? chenScore(hero.cards[0], hero.cards[1]) : 0;

  // Check if hero can check (no bet to call)
  const canCheck = gameState.currentBet === 0 || (hero?.bet === gameState.currentBet);

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

  // Handle hero actions with feedback
  const act = useCallback((action: Action) => {
    if (!hero || !isHeroTurn) return;
    
    setButtonsDisabled(true);
    setLastAction(action);
    
    // Simple feedback logic - can be enhanced
    let correct = false;
    let feedbackText = '';
    
    if (action === 'fold') {
      correct = heroScore < 6; // Fold weak hands
      feedbackText = correct ? 'Good fold with weak hand' : 'Folding a decent hand';
    } else if (action === 'raise') {
      correct = heroScore >= 8; // Raise with strong hands
      feedbackText = correct ? 'Good aggressive play' : 'Raising with marginal hand';
    } else {
      correct = true; // Call/check are generally safe
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
    
    // Handle the actual game action
    let amount = 0;
    let gameAction: 'fold' | 'call' | 'check' | 'bet' | 'raise' = action;
    
    if (action === 'call') {
      amount = gameState.currentBet - (hero.bet || 0);
    } else if (action === 'raise') {
      gameAction = gameState.currentBet === 0 ? 'bet' : 'raise';
      amount = gameState.bigBlind * 2; // Simple betting amount
    }
    
    handlePlayerAction(hero.id, gameAction, amount);
    
    // Re-enable buttons after delay
    setTimeout(() => {
      setButtonsDisabled(false);
    }, 1000);
  }, [hero, isHeroTurn, heroScore, gameState.currentBet, gameState.bigBlind, settings.showFeedback, heroFlashOpacity, handlePlayerAction]);

  // Start new hand
  const newHand = useCallback(() => {
    startNewGame(settings.numPlayers, settings.bigBlind);
    setRevealedPlayers(new Set());
    setLastAction('');
    setLastActionCorrect(null);
    setResult('');
    setButtonsDisabled(false);
    setPulseCounter(prev => prev + 1);
    setPlayerLastActions({}); // Clear AI actions
  }, [settings.numPlayers, settings.bigBlind, startNewGame]);

  // Deal table (for settings compatibility)
  const dealTable = useCallback((numPlayers: number) => {
    startNewGame(numPlayers, settings.bigBlind);
    setRevealedPlayers(new Set());
  }, [settings.bigBlind, startNewGame]);

  // Format bet label (simplified version of what you had)
  const betLabel = useCallback((player: Player): string => {
    if (player.bet === 0) return '';
    return `$${player.bet}`;
  }, []);

  // Action label (shows last action for all players)
  const actionLabel = useCallback((player: Player): string => {
    console.log(`ActionLabel for player ${player.id} (${player.name}), lastActions:`, lastActions);
    if (player.isHero && lastAction) {
      return lastAction.toUpperCase();
    }
    if (!player.isHero && lastActions[player.id]) {
      console.log(`AI Player ${player.id} (${player.name}) last action: ${lastActions[player.id]}`);
      return lastActions[player.id].toUpperCase();
    }
    return '';
  }, [lastAction, lastActions]);

  // Pulse key for animations
  const pulseKey = useCallback((player: Player): number => {
    return lastActionPlayerRef.current === player.id ? pulseCounter : 0;
  }, [pulseCounter]);

  // Session management (simplified)
  const currentSession = { 
    id: 'simple-session', 
    startTime: Date.now(),
    hands: []
  };
  const startNewSession = useCallback(() => {
    setTotalHands(0);
    setCorrectHands(0);
    newHand();
  }, [newHand]);

  // Re-enable buttons when it becomes hero's turn
  useEffect(() => {
    if (isHeroTurn && !hero?.folded) {
      setButtonsDisabled(false);
    }
  }, [isHeroTurn, hero?.folded]);

  // Auto-start a new hand when the application loads
  useEffect(() => {
    if (gameState.phase === 'waiting') {
      startNewGame(settings.numPlayers, settings.bigBlind);
    }
  }, [gameState.phase, settings.numPlayers, settings.bigBlind, startNewGame]);

  return {
    // Settings
    settings,
    setSettings,
    
    // Game state
    players,
    currentStreet: gameState.phase === 'preflop' ? 'preflop' as Street : 
                  gameState.phase === 'flop' ? 'flop' as Street :
                  gameState.phase === 'turn' ? 'turn' as Street :
                  gameState.phase === 'river' ? 'river' as Street : 'complete' as Street,
    board: gameState.board,
    dealerPosition: gameState.dealerPosition,
    foldedHand: hero?.folded ?? false,
    heroWonHand: null, // TODO: implement win detection
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
    setCurrentSession: () => {},
    startNewSession,
    
    // UI state
    showSettings,
    setShowSettings,
    heroFlash,
    heroFlashOpacity,
    buttonsDisabled,
    
    // Derived values
    heroScore,
    canCheck,
    totalPot,
    betLabel,
    actionLabel,
    pulseKey,
    
    // Actions
    dealTable,
    newHand,
    act,
    
    // Legacy compatibility properties
    pot: totalPot,
    street: gameState.phase === 'preflop' ? 'preflop' as Street : 
           gameState.phase === 'flop' ? 'flop' as Street :
           gameState.phase === 'turn' ? 'turn' as Street :
           gameState.phase === 'river' ? 'river' as Street : 'complete' as Street,
    hero,
    isHeroTurn,
    handleHeroAction: act, // Alias for compatibility
    gamePhase: gameState.phase,
    currentBet: gameState.currentBet,
    bigBlind: gameState.bigBlind,
  };
}
