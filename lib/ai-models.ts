import { AIDecisionMaker, ActionResult, GameState, SimplePlayer } from '@/hooks/useTexasHoldem';
import { chenScore } from '@/lib/chen';

// Aggressive AI - likes to bet and raise
export class AggressiveAI implements AIDecisionMaker {
  getName() { return 'Aggressive AI'; }
  
  decide(player: SimplePlayer, gameState: GameState): ActionResult {
    const chenRating = chenScore(player.cards[0], player.cards[1]);
    
    // Aggressive players bet/raise more often
    if (chenRating >= 4) { // Much lower threshold than Chen AI
      const raiseAmount = Math.min(gameState.bigBlind * 4, player.stack);
      return {
        action: 'raise',
        amount: raiseAmount,
        newStack: player.stack - raiseAmount,
        newBet: player.bet + raiseAmount
      };
    } else if (chenRating >= 2) {
      // Even weak hands get played aggressively
      const callAmount = Math.min(gameState.currentBet - player.bet, player.stack);
      return {
        action: gameState.currentBet === 0 ? 'check' : 'call',
        amount: callAmount,
        newStack: player.stack - callAmount,
        newBet: player.bet + callAmount
      };
    }
    
    // Only fold very weak hands
    return {
      action: 'fold',
      amount: 0,
      newStack: player.stack,
      newBet: player.bet
    };
  }
}

// Tight AI - only plays premium hands
export class TightAI implements AIDecisionMaker {
  getName() { return 'Tight AI'; }
  
  decide(player: SimplePlayer, gameState: GameState): ActionResult {
    const chenRating = chenScore(player.cards[0], player.cards[1]);
    
    // Very selective - only plays strong hands
    if (chenRating >= 12) { // Much higher threshold
      const raiseAmount = Math.min(gameState.bigBlind * 3, player.stack);
      return {
        action: 'raise',
        amount: raiseAmount,
        newStack: player.stack - raiseAmount,
        newBet: player.bet + raiseAmount
      };
    } else if (chenRating >= 8) {
      // Only call with good hands
      const callAmount = Math.min(gameState.currentBet - player.bet, player.stack);
      if (gameState.currentBet <= gameState.bigBlind * 2) { // Don't call big bets
        return {
          action: gameState.currentBet === 0 ? 'check' : 'call',
          amount: callAmount,
          newStack: player.stack - callAmount,
          newBet: player.bet + callAmount
        };
      }
    }
    
    // Fold everything else
    return {
      action: 'fold',
      amount: 0,
      newStack: player.stack,
      newBet: player.bet
    };
  }
}

// Position-aware AI - considers position in decisions
export class PositionalAI implements AIDecisionMaker {
  getName() { return 'Positional AI'; }
  
  decide(player: SimplePlayer, gameState: GameState): ActionResult {
    const chenRating = chenScore(player.cards[0], player.cards[1]);
    const isEarlyPosition = player.position <= gameState.players.length * 0.3;
    const isLatePosition = player.position >= gameState.players.length * 0.7;
    
    // Adjust hand requirements based on position
    let handThreshold = 6; // Default
    if (isEarlyPosition) handThreshold = 8; // Tighter in early position
    if (isLatePosition) handThreshold = 4;  // Looser in late position
    
    if (chenRating >= handThreshold + 4) {
      // Strong hand - raise
      const raiseAmount = Math.min(gameState.bigBlind * 3, player.stack);
      return {
        action: 'raise',
        amount: raiseAmount,
        newStack: player.stack - raiseAmount,
        newBet: player.bet + raiseAmount
      };
    } else if (chenRating >= handThreshold) {
      // Decent hand - call
      const callAmount = Math.min(gameState.currentBet - player.bet, player.stack);
      return {
        action: gameState.currentBet === 0 ? 'check' : 'call',
        amount: callAmount,
        newStack: player.stack - callAmount,
        newBet: player.bet + callAmount
      };
    }
    
    return {
      action: 'fold',
      amount: 0,
      newStack: player.stack,
      newBet: player.bet
    };
  }
}

// Pot-aware AI - considers pot odds
export class PotOddsAI implements AIDecisionMaker {
  getName() { return 'Pot Odds AI'; }
  
  decide(player: SimplePlayer, gameState: GameState): ActionResult {
    const chenRating = chenScore(player.cards[0], player.cards[1]);
    const potSize = gameState.pot + gameState.players.reduce((sum, p) => sum + p.bet, 0);
    const betToCall = gameState.currentBet - player.bet;
    
    // Calculate pot odds
    const potOdds = potSize / Math.max(betToCall, 1);
    
    // Strong hands - always play
    if (chenRating >= 10) {
      const raiseAmount = Math.min(gameState.bigBlind * 3, player.stack);
      return {
        action: 'raise',
        amount: raiseAmount,
        newStack: player.stack - raiseAmount,
        newBet: player.bet + raiseAmount
      };
    }
    
    // Medium hands - consider pot odds
    if (chenRating >= 4) {
      // If pot odds are good (pot is much larger than bet), call
      if (potOdds > 3 || gameState.currentBet === 0) {
        const callAmount = Math.min(betToCall, player.stack);
        return {
          action: gameState.currentBet === 0 ? 'check' : 'call',
          amount: callAmount,
          newStack: player.stack - callAmount,
          newBet: player.bet + callAmount
        };
      }
    }
    
    return {
      action: 'fold',
      amount: 0,
      newStack: player.stack,
      newBet: player.bet
    };
  }
}
