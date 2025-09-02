// Enhanced adapter to connect new simple backend to existing UI components
import { chenScore } from '@/lib/chen';
import { DEFAULT_TRAINER_SETTINGS, Player, type Action, type Street, type TexasHoldemSettings } from '@/models/poker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { usePersistedState } from './usePersistedState';
import { useSession } from './useSession';
import { useTexasHoldem, type GameState, type SimplePlayer } from './useTexasHoldem';

// Convert SimplePlayer to the UI's expected Player format
function adaptPlayer(simplePlayer: SimplePlayer, gameState: GameState): Player {
  return new Player({
    id: simplePlayer.id,
    name: simplePlayer.name,
    cards: simplePlayer.cards,
    position: simplePlayer.position,
    nPlayers: gameState.players.length,
    dealerPosition: gameState.dealerPosition,
    stack: simplePlayer.stack,
    isHero: simplePlayer.isHero,
    bet: simplePlayer.bet,
    folded: simplePlayer.folded,
    lastAction: simplePlayer.lastAction,
  });
}

// Enhanced adapter hook that provides the same interface your UI expects
export function usePokerGame() {
  // Settings management (must be first)
  const [settings, setSettings] = usePersistedState<TexasHoldemSettings>(
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
  } = useTexasHoldem(settings);

  // Session management with proper tracking
  const { currentSession, setCurrentSession, startNewSession: createNewSession, ready } = useSession('Texas Holdem');

  // Ensure session exists when app starts
  useEffect(() => {
    if (ready && !currentSession) {
      createNewSession();
    }
  }, [ready, currentSession, createNewSession]);

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

  // Convert simple players to UI Player objects
  const players = useMemo(() => 
    gameState.players.map(p => adaptPlayer(p, gameState)),
    [gameState.players, gameState.activePlayerIndex] // Add activePlayerIndex to deps to force refresh when actions happen
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
    if (player.isHero && lastAction) {
      return lastAction.toUpperCase();
    }
    if (!player.isHero && player.lastAction) {
      return player.lastAction.toUpperCase();
    }
    return '';
  }, [lastAction]);

  // Pulse key for animations
  const pulseKey = useCallback((player: Player): number => {
    return lastActionPlayerRef.current === player.id ? pulseCounter : 0;
  }, [pulseCounter]);

  // Hand completion tracking
  const handCompletedRef = useRef(false);
  
  // Track hand completion for history
  useEffect(() => {
    if (gameState.phase === 'complete' && !handCompletedRef.current && currentSession) {
      handCompletedRef.current = true;
      
      // Add hand to session history
      const finalPot = gameState.pot + gameState.players.reduce((sum, p) => sum + p.bet, 0);
      const hand = {
        handId: `hand_${Date.now()}`,
        timestamp: Date.now(),
        players: gameState.players.map(p => ({
          name: p.name,
          position: p.position.toString(),
          cards: p.cards,
          isHero: p.isHero
        })),
        blinds: { smallBlind: gameState.bigBlind / 2, bigBlind: gameState.bigBlind },
        communityCards: gameState.board,
        actions: [], // Could be enhanced to track all actions
        pot: finalPot,
        result: 'completed' as const,
        heroWon: gameState.players.find(p => p.isHero && !p.folded) ? true : undefined
      };
      
      const updatedSession = {
        ...currentSession,
        hands: [...currentSession.hands, hand]
      };
      setCurrentSession(updatedSession);
      
      // Update tracker with the new hand
      import('@/lib/tracker').then(({ upsertPokerStarsAttachmentForSession }) => {
        upsertPokerStarsAttachmentForSession(updatedSession, 'Texas Holdem').catch(() => {});
      });
    } else if (gameState.phase !== 'complete') {
      handCompletedRef.current = false;
    }
  }, [gameState.phase, gameState.players, gameState.board, gameState.pot, currentSession, setCurrentSession]);

  const startNewSession = useCallback(() => {
    setTotalHands(0);
    setCorrectHands(0);
    createNewSession();
    startNewGame();
  }, [createNewSession, startNewGame]);

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
    setCurrentSession,
    startNewSession,
    
    // UI state
    showSettings,
    setShowSettings,
    heroFlash,
    heroFlashOpacity,
    buttonsDisabled: buttonsDisabled || !isHeroTurn, // Disable when not hero's turn
    
    // Turn management
    currentPlayer,
    isHeroTurn,
    activePlayerIndex: gameState.activePlayerIndex,
    
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
    handleHeroAction: act, // Alias for compatibility
    gamePhase: gameState.phase,
    currentBet: gameState.currentBet,
    bigBlind: gameState.bigBlind,
  };
}
