export type Card = {
    suit: string;
    value: string;
  };
  
  export type Player = {
    id: string;
    name: string;
    hand: Card[];
    score: number;        // used in classic
    chips?: number;       // used in fast mode
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
      this.lastDiscardSet = [];
    }
  
    generateDeck(): Card[] {
      const suits = ["♠", "♥", "♦", "♣"];
      const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      const baseDeck = suits.flatMap(suit => values.map(value => ({ suit, value })));
      const deck = [...baseDeck, ...baseDeck, { suit: "🃏", value: "Joker" }, { suit: "🃏", value: "Joker" }];
      return this.shuffle(deck);
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
      if (!discard.length) return false;
      if (discard.length === 1) return true;
  
      const nonJokers = discard.filter(c => c.value !== "Joker");
      const jokerCount = discard.length - nonJokers.length;
  
      const isSet = nonJokers.every(c => c.value === nonJokers[0]?.value);
      if (isSet && nonJokers.length + jokerCount === discard.length) return true;
  
      if (nonJokers.length + jokerCount < 3) return false;
  
      const valuesInOrder = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
      const allSameSuit = nonJokers.every(c => c.suit === nonJokers[0]?.suit);
      if (!allSameSuit) return false;
  
      const sorted = [...nonJokers].sort((a, b) =>
        valuesInOrder.indexOf(a.value) - valuesInOrder.indexOf(b.value)
      );
  
      let gaps = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prevIndex = valuesInOrder.indexOf(sorted[i - 1].value);
        const currIndex = valuesInOrder.indexOf(sorted[i].value);
        const diff = currIndex - prevIndex;
        if (diff === 1) continue;
        if (diff <= 0) return false;
        gaps += diff - 1;
      }
  
      return gaps <= jokerCount;
    }
  
    discardCards(player: Player, discard: Card[]): boolean {
      const hasCards = discard.every(card =>
        player.hand.some(c => c.suit === card.suit && c.value === card.value)
      );
      if (!hasCards || !this.isValidDiscard(discard, player.hand)) return false;
  
      for (const card of discard) {
        const idx = player.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
        if (idx !== -1) player.hand.splice(idx, 1);
      }
  
      this.discardPile.push(...discard);
      this.lastDiscardSet = [...discard];
      return true;
    }
  
    performMove(playerId: string, discard: Card[]): Card | null {
      const player = this.players.find(p => p.id === playerId);
      if (!player || !this.roundActive) return null;
      const discarded = this.discardCards(player, discard);
      if (!discarded) return null;
  
      const drawnCard = this.drawCard();
      if (drawnCard) player.hand.push(drawnCard);
  
      return drawnCard;
    }
    declareYaniv(
        callerId: string,
        multiplier: number
      ): {
        result: "yaniv" | "asaf";
        scores: Record<string, number>; // total score (classic)
        chipResults?: Record<string, number>; // change in chips (fast mode)
      } {
        const caller = this.players.find((p) => p.id === callerId);
        if (!caller) return { result: "yaniv", scores: {}, chipResults: {} };
      
        const callerPoints = this.calculatePoints(caller.hand);
        let asafPlayer: Player | null = null;
      
        for (let p of this.players) {
          if (p.id !== callerId && this.calculatePoints(p.hand) <= callerPoints) {
            asafPlayer = p;
            break;
          }
        }
      
        const scores: Record<string, number> = {};
        const chipResults: Record<string, number> = {};
      
        for (let p of this.players) {
          const handValue = this.calculatePoints(p.hand);
          scores[p.id] = p.score;
      
          if (p === caller) {
            if (asafPlayer) {
              // Yaniv failed (asaf) — caller gets +30 penalty
              p.score += handValue + 30;
              chipResults[p.id] = -30 * multiplier;
            } else {
              // Successful Yaniv — no score, others pay
              chipResults[p.id] = 0;
            }
          } else {
            if (p === asafPlayer) {
              chipResults[p.id] = 30 * multiplier;
            } else {
              p.score += handValue;
              chipResults[p.id] = -handValue * multiplier;
            }
          }
        }
      
        this.roundActive = false;
      
        return {
          result: asafPlayer ? "asaf" : "yaniv",
          scores,
          chipResults,
        };
      }
      
  
    calculatePoints(hand: Card[]): number {
      return hand.reduce((sum, c) => {
        if (c.value === "Joker") return sum;
        if (c.value === "A") return sum + 1;
        if (["J", "Q", "K"].includes(c.value)) return sum + 10;
        return sum + parseInt(c.value, 10);
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
  }
  