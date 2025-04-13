import { GameEngine, Player } from "./gameEngine";
import { Server } from "socket.io";

type GameMode = "classic" | "fast";

type GameInstance = {
  mode: GameMode;
  multiplier: number; // for fast mode: 1, 2, etc.
  players: Player[];
  engine: GameEngine;
  hasDeclaredYaniv: boolean;
  io: Server;
};

export class GameManager {
  private static games: Map<string, GameInstance> = new Map();

  static createGame(
    roomId: string,
    players: Player[],
    io: Server,
    config: { mode?: "classic" | "fast"; multiplier?: number } = {}
  ) {
    const engine = new GameEngine(players);
    this.games.set(roomId, {
        players,
        engine,
        hasDeclaredYaniv: false,
        io,
        mode: config.mode || "classic",
        multiplier: config.multiplier || 1,
    });
  }


  static initializeDefaultRooms(io: Server) {
    const defaultRooms = ["room-1", "room-2", "room-3"];
    defaultRooms.forEach((roomId,idx) => {
        if (!this.games.has(roomId)) {
            this.createGame(roomId, [], io, { mode: "classic", multiplier: idx + 1 });
            console.log(`✅ Default room created: ${roomId}`);
        }
    });
    // for (const roomId of defaultRooms) {
    //   if (!this.games.has(roomId)) {
    //     this.createGame(roomId, [], io, { mode: "classic", multiplier:  });
    //     console.log(`✅ Default room created: ${roomId}`);
    //   }
    // }
  }

  
  static getAllRoomIds(): string[] {
    return Array.from(this.games.keys());
  }

  static getAvailableRooms(): string[] {
    return Array.from(this.games.entries())
      .filter(([_, game]) => game.players.length < 4 && !game.engine.roundActive)
      .map(([roomId]) => roomId);
  }

  static getAllGames(): IterableIterator<[string, GameInstance]> {
    return this.games.entries(); 
  }

  static getGame(roomId: string): GameInstance | undefined {
    return this.games.get(roomId);
  }

  static removeGame(roomId: string) {
    this.games.delete(roomId);
  }
}
