// ✅ Refactored gameEngine.ts

export type Card = {
    suit: string;
    value: string;
  };
  
  export type Player = {
    id: string;
    name: string;
    hand: Card[];
    score: number;
    ready?: boolean;
  };
  
  export class GameEngine {
    players: Player[];
    deck: Card[];
    discardPile: Card[];
    turnIndex: number;
    roundActive: boolean;
    lastDiscardSet: Card[];
  
   

    constructor(players: Player[]) {
      this.players = players;
      this.deck = [];
      this.discardPile = [];
      this.turnIndex = 0;
      this.roundActive = false;
      this.lastDiscardSet = []
    }
  
    generateDeck(): Card[] {
        const suits = ["♠", "♥", "♦", "♣"];
        const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
        const deck: Card[] = [];
      
        for (let suit of suits) {
          for (let value of values) {
            deck.push({ suit, value });
          }
        }
      
        const fullDeck = [...deck, ...deck]; // Two decks
        fullDeck.push({ suit: "🃏", value: "Joker" });
        fullDeck.push({ suit: "🃏", value: "Joker" });
      
        return this.shuffle(fullDeck);
      }
  
    shuffle(deck: Card[]): Card[] {
      return deck.sort(() => Math.random() - 0.5);
    }
  
    dealCards(count: number) {
      for (const player of this.players) {
        player.hand = [];
        for (let i = 0; i < count; i++) {
          const card = this.drawCard();
          if (card) player.hand.push(card);
        }
      }
    }
  
    drawCard(): Card {
      if (this.deck.length === 0) {
        this.deck = this.shuffle(this.discardPile);
        this.discardPile = [];
      }
      return this.deck.pop()!;
    }
  
    getCurrentPlayer(): Player {
      return this.players[this.turnIndex];
    }
  
    nextTurn() {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
    }
  
    isValidDiscard(discard: Card[], hand: Card[]): boolean {
        if (discard.length === 1) return true;
      
        const nonJokers = discard.filter(c => c.value !== "Joker");
        const jokerCount = discard.length - nonJokers.length;
      
        // Set: All same value
        const isSet = nonJokers.every(c => c.value === nonJokers[0]?.value);
        if (isSet && nonJokers.length + jokerCount === discard.length) return true;
      
        // Sequence: Same suit + ascending values
        const valuesInOrder = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
        const sorted = nonJokers
          .slice()
          .sort((a, b) => valuesInOrder.indexOf(a.value) - valuesInOrder.indexOf(b.value));
      
        const allSameSuit = nonJokers.every(c => c.suit === nonJokers[0]?.suit);
        if (!allSameSuit) return false;
      
        // Check sequence gaps
        let gaps = 0;
        for (let i = 1; i < sorted.length; i++) {
          const diff = valuesInOrder.indexOf(sorted[i].value) - valuesInOrder.indexOf(sorted[i - 1].value);
          if (diff === 1) continue;
          gaps += diff - 1;
        }
      
        return gaps <= jokerCount;
      }
      
  
    discardCards(playerId: string, discard: Card[]): boolean {
      if (discard.length === 0) return false;
      const player = this.players.find((p) => p.id === playerId);
      if (!player) return false;
  
      const hasCards = discard.every((card) =>
        player.hand.some((c) => c.suit === card.suit && c.value === card.value)
      );
      if (!hasCards || !this.isValidDiscard(discard, player.hand)) return false;
  
      for (let card of discard) {
        const index = player.hand.findIndex(
          (c) => c.suit === card.suit && c.value === card.value
        );
        if (index !== -1) player.hand.splice(index, 1);
      }
      this.discardPile.push(...discard);
      this.lastDiscardSet = [...discard]; // 🔥 Track full discard set
      return true;
    }
  
    
    declareYaniv(callerId: string): { result: string; scores: Record<string, number> } {
      const caller = this.players.find((p) => p.id === callerId);
      if (!caller) return { result: "invalid", scores: {} };
  
      const callerPoints = this.calculatePoints(caller.hand);
      let asafPlayer: Player | null = null;
  
      for (let p of this.players) {
        if (p.id !== callerId && this.calculatePoints(p.hand) <= callerPoints) {
          asafPlayer = p;
          break;
        }
      }
  
      const results: Record<string, number> = {};
  
      for (let p of this.players) {
        const handValue = this.calculatePoints(p.hand);
        if (p === caller) {
          p.score += asafPlayer ? handValue + 30 : 0;
        } else {
          p.score += p === asafPlayer ? 0 : handValue;
        }
        results[p.id] = p.score;
      }
  
      this.roundActive = false;
      return { result: asafPlayer ? "asaf" : "yaniv", scores: results };
    }
  
    calculatePoints(hand: Card[]): number {
        return hand.reduce((sum, card) => {
          if (card.value === "Joker") return sum; // Jokers = 0
          if (card.value === "A") return sum + 1;
          if (["J", "Q", "K"].includes(card.value)) return sum + 10;
          return sum + parseInt(card.value, 10);
        }, 0);
      }
  
    startNewRound() {
      this.deck = this.generateDeck();
      this.discardPile = [];
      this.dealCards(5);
      this.roundActive = true;
      this.turnIndex = 0;
  
      const topCard = this.drawCard();
      if (topCard) this.discardPile.push(topCard);
    }
  
    cardValue(value: string): number {
      if (value === "A") return 1;
      if (["J", "Q", "K"].includes(value)) return 10;
      return parseInt(value, 10);
    }
  }