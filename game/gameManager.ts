
import { GameEngine, Player } from "./gameEngine";
import { Server } from "socket.io";

type GameInstance = {
  players: Player[];
  engine: GameEngine;
  hasDeclaredYaniv: boolean; // ✅ Track Yaniv declaration
};

export class GameManager {
  private static games: Map<string, GameInstance> = new Map();

  static createGame(roomId: string, players: Player[], io: Server) {
    console.log("🟢 Creating game:", roomId, players);
    const engine = new GameEngine(players);
    this.games.set(roomId, {
      players,
      engine,
      hasDeclaredYaniv: false,
    });
  }

  static getGame(roomId: string): GameInstance | undefined {
    
    return this.games.get(roomId);
  }
  static removeGame(roomId: string) {
    this.games.delete(roomId);
  }
}
