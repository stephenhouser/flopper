import { chenScore } from '@/lib/chen';
import { Player, type Action } from '@/models/poker';

// Forward declare GameState to avoid circular imports
export type GameState = {
  players: Player[];
  board: any[]; // CardT[]
  pot: number;
  phase: string;
  currentBet: number;
  dealerPosition: number;
  activePlayerIndex: number;
  bigBlind: number;
};

// AI Decision Result
export type AIDecision = {
  action: Action;
  amount: number;
  reasoning?: string; // Optional explanation for debugging
};

// Base AI interface
export interface AIPlayer {
  name: string;
  decide(player: Player, gameState: GameState): AIDecision;
}

// Chen Formula AI - Conservative play based on starting hand strength
export class ChenAI implements AIPlayer {
  name = 'Chen AI';
  
  decide(player: Player, gameState: GameState): AIDecision {
    const score = chenScore(player.cards[0], player.cards[1]);
    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    const potOdds = callAmount / (gameState.pot + callAmount + gameState.players.reduce((sum, p) => sum + p.bet, 0));
    
    // Conservative thresholds based on Chen score
    if (score < 4) {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Chen score ${score} too low`
      };
    } else if (score >= 10 && Math.random() > 0.2) {
      const raiseAmount = Math.min(gameState.bigBlind * 3, player.stack);
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'raise', 
        amount: gameState.currentBet === 0 ? 0 : raiseAmount,
        reasoning: `Strong hand (Chen ${score}), betting for value`
      };
    } else if (score >= 6 && potOdds < 0.3) {
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'call', 
        amount: gameState.currentBet === 0 ? 0 : callAmount,
        reasoning: `Decent hand (Chen ${score}), good pot odds`
      };
    } else if (callAmount <= player.stack) {
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'call', 
        amount: gameState.currentBet === 0 ? 0 : callAmount,
        reasoning: `Marginal hand, checking/calling`
      };
    } else {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Can't afford to call`
      };
    }
  }
}

// Aggressive AI - Likes to bet and raise frequently
export class AggressiveAI implements AIPlayer {
  name = 'Aggressive AI';
  
  decide(player: Player, gameState: GameState): AIDecision {
    const score = chenScore(player.cards[0], player.cards[1]);
    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    
    // Much more aggressive thresholds
    if (score < 2) {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Hand too weak even for aggression`
      };
    } else if (score >= 4 && Math.random() > 0.4) { // 60% of the time with decent hands
      const raiseAmount = Math.min(gameState.bigBlind * 4, player.stack);
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'raise', 
        amount: gameState.currentBet === 0 ? 0 : raiseAmount,
        reasoning: `Aggressive play with Chen ${score}`
      };
    } else if (callAmount <= player.stack) {
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'call', 
        amount: gameState.currentBet === 0 ? 0 : callAmount,
        reasoning: `Staying aggressive, calling`
      };
    } else {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Stack too short to continue`
      };
    }
  }
}

// Tight AI - Very selective, only plays premium hands
export class TightAI implements AIPlayer {
  name = 'Tight AI';
  
  decide(player: Player, gameState: GameState): AIDecision {
    const score = chenScore(player.cards[0], player.cards[1]);
    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    
    // Very tight thresholds
    if (score < 8) {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Tight fold, Chen ${score} below premium threshold`
      };
    } else if (score >= 12) {
      const raiseAmount = Math.min(gameState.bigBlind * 3, player.stack);
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'raise', 
        amount: gameState.currentBet === 0 ? 0 : raiseAmount,
        reasoning: `Premium hand (Chen ${score}), value betting`
      };
    } else if (callAmount <= player.stack) {
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'call', 
        amount: gameState.currentBet === 0 ? 0 : callAmount,
        reasoning: `Good hand but playing cautiously`
      };
    } else {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Can't afford the bet`
      };
    }
  }
}

// Positional AI - Adjusts play based on table position
export class PositionalAI implements AIPlayer {
  name = 'Positional AI';
  
  decide(player: Player, gameState: GameState): AIDecision {
    const score = chenScore(player.cards[0], player.cards[1]);
    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    const isLatePosition = player.labels.includes('CO') || player.labels.includes('Dealer');
    const isEarlyPosition = player.labels.includes('UTG') || player.labels.includes('UTG+1');
    
    // Adjust thresholds based on position
    let threshold = 6; // Default
    if (isEarlyPosition) threshold = 8; // Tighter in early position
    if (isLatePosition) threshold = 4; // Looser in late position
    
    if (score < threshold) {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Positional fold: Chen ${score} below ${threshold} threshold for ${player.labels.join(',')}`
      };
    } else if (score >= 10 || (isLatePosition && score >= 6)) {
      const raiseAmount = Math.min(gameState.bigBlind * 3, player.stack);
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'raise', 
        amount: gameState.currentBet === 0 ? 0 : raiseAmount,
        reasoning: `Strong hand or good position for aggression`
      };
    } else if (callAmount <= player.stack) {
      return { 
        action: gameState.currentBet === 0 ? 'check' : 'call', 
        amount: gameState.currentBet === 0 ? 0 : callAmount,
        reasoning: `Playable hand from ${player.labels.join(',')}`
      };
    } else {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Stack management fold`
      };
    }
  }
}

// Pot Odds AI - Makes mathematically informed decisions
export class PotOddsAI implements AIPlayer {
  name = 'Pot Odds AI';
  
  decide(player: Player, gameState: GameState): AIDecision {
    const score = chenScore(player.cards[0], player.cards[1]);
    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    const totalPot = gameState.pot + gameState.players.reduce((sum, p) => sum + p.bet, 0);
    const potOdds = callAmount > 0 ? callAmount / (totalPot + callAmount) : 0;
    
    // Estimate hand equity based on Chen score (rough approximation)
    const handEquity = Math.min(0.85, Math.max(0.15, score / 20));
    
    if (score < 3) {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Hand equity too low regardless of pot odds`
      };
    } else if (potOdds === 0) { // No bet to call
      if (score >= 8) {
        const betAmount = Math.min(gameState.bigBlind * 2, player.stack);
        return { 
          action: 'check', 
          amount: 0, // Could bet here but keeping it simple
          reasoning: `Free card with decent hand`
        };
      } else {
        return { 
          action: 'check', 
          amount: 0,
          reasoning: `Taking free card`
        };
      }
    } else if (handEquity > potOdds * 1.2) { // Need some margin
      if (score >= 10) {
        const raiseAmount = Math.min(gameState.bigBlind * 3, player.stack);
        return { 
          action: 'raise', 
          amount: raiseAmount,
          reasoning: `Good equity (${(handEquity*100).toFixed(1)}%) vs pot odds (${(potOdds*100).toFixed(1)}%), raising for value`
        };
      } else {
        return { 
          action: 'call', 
          amount: callAmount,
          reasoning: `Positive expected value: equity ${(handEquity*100).toFixed(1)}% > pot odds ${(potOdds*100).toFixed(1)}%`
        };
      }
    } else {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: `Negative EV: equity ${(handEquity*100).toFixed(1)}% < pot odds ${(potOdds*100).toFixed(1)}%`
      };
    }
  }
}

// Random AI - For testing and unpredictability
export class RandomAI implements AIPlayer {
  name = 'Random AI';
  
  decide(player: Player, gameState: GameState): AIDecision {
    const actions: Action[] = ['fold', 'call', 'check', 'raise'];
    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    
    // Filter valid actions
    const validActions = actions.filter(action => {
      if (action === 'call' && callAmount === 0) return false;
      if (action === 'check' && callAmount > 0) return false;
      if (action === 'call' && callAmount > player.stack) return false;
      if (action === 'raise' && player.stack <= callAmount) return false;
      return true;
    });
    
    const randomAction = validActions[Math.floor(Math.random() * validActions.length)];
    let amount = 0;
    
    if (randomAction === 'call') {
      amount = callAmount;
    } else if (randomAction === 'raise') {
      amount = Math.min(gameState.bigBlind * (1 + Math.random() * 3), player.stack);
    }
    
    return { 
      action: randomAction, 
      amount,
      reasoning: `Random decision: ${randomAction}${amount > 0 ? ` for ${amount}` : ''}`
    };
  }
}

// AI Registry - Easy to add new AI types
export const AI_REGISTRY = {
  'chen': () => new ChenAI(),
  'aggressive': () => new AggressiveAI(),
  'tight': () => new TightAI(),
  'positional': () => new PositionalAI(),
  'pot-odds': () => new PotOddsAI(),
  'random': () => new RandomAI(),
} as const;

export type AIType = keyof typeof AI_REGISTRY;

// Helper function to get available AI types
export function getAvailableAITypes(): AIType[] {
  return Object.keys(AI_REGISTRY) as AIType[];
}

// Helper function to create AI instance
export function createAI(type: AIType): AIPlayer {
  return AI_REGISTRY[type]();
}

// Helper function to get random AI type
export function getRandomAIType(): AIType {
  const types = getAvailableAITypes();
  return types[Math.floor(Math.random() * types.length)];
}

// Main AI decision function that uses the modular system
export function makeAIDecision(player: Player, gameState: GameState): AIDecision {
  const aiType = (player.aiType as AIType) || 'chen';
  const ai = createAI(aiType);
  return ai.decide(player, gameState);
}
