# AI Models System

The Texas Hold'em trainer uses a modular AI system that makes it easy to add new AI personalities and strategies.

## Available AI Types

### 1. Chen AI (`'chen'`)
- **Strategy**: Conservative play based on Chen formula hand ratings
- **Characteristics**: Folding weak hands (< 4), raising strong hands (> 10), considers pot odds
- **Best for**: Baseline solid poker strategy

### 2. Aggressive AI (`'aggressive'`)
- **Strategy**: Likes to bet and raise frequently with lower thresholds
- **Characteristics**: Plays many hands, bets/raises 60% of the time with decent hands
- **Best for**: Testing against loose-aggressive opponents

### 3. Tight AI (`'tight'`)
- **Strategy**: Very selective, only plays premium hands
- **Characteristics**: Folds most hands (Chen < 8), only raises with premium hands (Chen > 12)
- **Best for**: Learning to play against tight opponents

### 4. Positional AI (`'positional'`)
- **Strategy**: Adjusts hand requirements based on table position
- **Characteristics**: Tighter in early position, looser in late position
- **Best for**: Learning position-based strategy

### 5. Pot Odds AI (`'pot-odds'`)
- **Strategy**: Makes mathematically informed decisions based on pot odds vs hand equity
- **Characteristics**: Calculates expected value for each decision
- **Best for**: Learning mathematical approach to poker

### 6. Random AI (`'random'`)
- **Strategy**: Makes random but valid decisions
- **Characteristics**: Unpredictable, good for testing edge cases
- **Best for**: Testing and variety

## How to Add a New AI Personality

### Step 1: Create the AI Class

```typescript
export class MyCustomAI implements AIPlayer {
  name = 'My Custom AI';
  
  decide(player: Player, gameState: GameState): AIDecision {
    const score = chenScore(player.cards[0], player.cards[1]);
    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    
    // Your custom logic here
    if (score < 5) {
      return { 
        action: 'fold', 
        amount: 0,
        reasoning: 'Custom logic: hand too weak'
      };
    }
    
    // ... more logic
    
    return { 
      action: 'call', 
      amount: callAmount,
      reasoning: 'Custom decision'
    };
  }
}
```

### Step 2: Add to Registry

```typescript
export const AI_REGISTRY = {
  'chen': () => new ChenAI(),
  'aggressive': () => new AggressiveAI(),
  'tight': () => new TightAI(),
  'positional': () => new PositionalAI(),
  'pot-odds': () => new PotOddsAI(),
  'random': () => new RandomAI(),
  'my-custom': () => new MyCustomAI(), // Add your AI here
} as const;
```

### Step 3: Use Your AI

Your new AI will automatically be available for random selection, or you can manually assign it to players by setting their `aiType` property to `'my-custom'`.

## AI Decision Interface

```typescript
export type AIDecision = {
  action: Action;           // 'fold', 'call', 'check', or 'raise'
  amount: number;           // Bet/raise amount (0 for fold/check)
  reasoning?: string;       // Optional explanation for debugging
};
```

## Available Data in `decide()` Method

### Player Object
- `player.cards` - The player's hole cards
- `player.stack` - Player's chip stack
- `player.bet` - Player's current bet this round
- `player.position` - Seat position (0 = dealer)
- `player.labels` - Position labels like ['Dealer'], ['SB'], ['UTG'], etc.
- `player.isSmallBlind`, `player.isBigBlind` - Blind status

### Game State
- `gameState.players` - All players in the game
- `gameState.pot` - Main pot amount
- `gameState.currentBet` - Current bet to call
- `gameState.bigBlind` - Big blind amount
- `gameState.phase` - Current phase ('preflop', 'flop', 'turn', 'river')
- `gameState.board` - Community cards (if any)

## Tips for AI Development

1. **Start Simple**: Begin with basic Chen score thresholds
2. **Add Randomness**: Use `Math.random()` to avoid predictable play
3. **Consider Position**: Adjust strategy based on `player.labels`
4. **Use Pot Odds**: Calculate expected value for mathematical decisions
5. **Add Reasoning**: Include `reasoning` strings for debugging
6. **Test Edge Cases**: Handle cases where player can't afford to call

## Example: Bluff-Heavy AI

```typescript
export class BlufferAI implements AIPlayer {
  name = 'Bluffer AI';
  
  decide(player: Player, gameState: GameState): AIDecision {
    const score = chenScore(player.cards[0], player.cards[1]);
    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    const bluffChance = 0.3; // 30% bluff rate
    
    // Occasionally bluff with weak hands
    if (score < 4 && Math.random() < bluffChance && gameState.currentBet === 0) {
      const betAmount = Math.min(gameState.bigBlind * 2, player.stack);
      return {
        action: 'check', // Could bet here for bluffs
        amount: 0,
        reasoning: 'Bluff attempt with weak hand'
      };
    }
    
    // Otherwise play normally
    // ... rest of logic
  }
}
```

This modular system makes it easy to experiment with different strategies and test various opponent types!
