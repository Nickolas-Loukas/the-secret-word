import { type Room, type Player, type Vote, type InsertRoom, type InsertPlayer, type InsertVote } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Room management
  createRoom(room: InsertRoom): Promise<Room>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getRoomById(id: string): Promise<Room | undefined>;
  updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<boolean>;
  
  // Player management
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayer(id: string): Promise<Player | undefined>;
  getPlayersByRoom(roomId: string): Promise<Player[]>;
  updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined>;
  deletePlayer(id: string): Promise<boolean>;
  deletePlayersByRoom(roomId: string): Promise<void>;
  
  // Vote management
  createVote(vote: InsertVote): Promise<Vote>;
  getVotesByRoom(roomId: string): Promise<Vote[]>;
  getVotesByRoomAndRound(roomId: string, round: number): Promise<Vote[]>;
  deleteVotesByRoom(roomId: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private rooms: Map<string, Room>;
  private players: Map<string, Player>;
  private votes: Map<string, Vote>;

  constructor() {
    this.rooms = new Map();
    this.players = new Map();
    this.votes = new Map();
  }

  // Room methods
  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const id = randomUUID();
    const code = this.generateRoomCode();
    const room: Room = {
      ...insertRoom,
      id,
      code,
      isActive: true,
      secretWord: null,
      secretAgent: null,
      gameState: "lobby",
      createdAt: new Date(),
    };
    this.rooms.set(id, room);
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    return Array.from(this.rooms.values()).find(room => room.code === code);
  }

  async getRoomById(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const room = this.rooms.get(id);
    if (!room) return undefined;
    
    const updatedRoom = { ...room, ...updates };
    this.rooms.set(id, updatedRoom);
    return updatedRoom;
  }

  async deleteRoom(id: string): Promise<boolean> {
    return this.rooms.delete(id);
  }

  // Player methods
  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = randomUUID();
    const player: Player = {
      id,
      name: insertPlayer.name,
      roomId: insertPlayer.roomId || null,
      socketId: null,
      isConnected: true,
      score: 0,
      joinedAt: new Date(),
    };
    this.players.set(id, player);
    return player;
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayersByRoom(roomId: string): Promise<Player[]> {
    return Array.from(this.players.values()).filter(player => player.roomId === roomId);
  }

  async updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined> {
    const player = this.players.get(id);
    if (!player) return undefined;
    
    const updatedPlayer = { ...player, ...updates };
    this.players.set(id, updatedPlayer);
    return updatedPlayer;
  }

  async deletePlayer(id: string): Promise<boolean> {
    return this.players.delete(id);
  }

  async deletePlayersByRoom(roomId: string): Promise<void> {
    const playersToDelete = Array.from(this.players.values())
      .filter(player => player.roomId === roomId);
    
    playersToDelete.forEach(player => this.players.delete(player.id));
  }

  // Vote methods
  async createVote(insertVote: InsertVote): Promise<Vote> {
    const id = randomUUID();
    const vote: Vote = {
      id,
      roomId: insertVote.roomId || null,
      playerId: insertVote.playerId || null,
      suspectId: insertVote.suspectId || null,
      round: insertVote.round || 1,
      createdAt: new Date(),
    };
    this.votes.set(id, vote);
    return vote;
  }

  async getVotesByRoom(roomId: string): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(vote => vote.roomId === roomId);
  }

  async getVotesByRoomAndRound(roomId: string, round: number): Promise<Vote[]> {
    return Array.from(this.votes.values())
      .filter(vote => vote.roomId === roomId && vote.round === round);
  }

  async deleteVotesByRoom(roomId: string): Promise<void> {
    const votesToDelete = Array.from(this.votes.values())
      .filter(vote => vote.roomId === roomId);
    
    votesToDelete.forEach(vote => this.votes.delete(vote.id));
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export class DatabaseStorage implements IStorage {
  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const { db } = await import("./db");
    const { rooms } = await import("@shared/schema");
    
    const roomCode = this.generateRoomCode();
    const [room] = await db
      .insert(rooms)
      .values({
        code: roomCode,
        hostId: insertRoom.hostId,
      })
      .returning();
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    const { db } = await import("./db");
    const { rooms } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    return room || undefined;
  }

  async getRoomById(id: string): Promise<Room | undefined> {
    const { db } = await import("./db");
    const { rooms } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room || undefined;
  }

  async updateRoom(id: string, updates: Partial<Room>): Promise<Room | undefined> {
    const { db } = await import("./db");
    const { rooms } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const [room] = await db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, id))
      .returning();
    return room || undefined;
  }

  async deleteRoom(id: string): Promise<boolean> {
    const { db } = await import("./db");
    const { rooms } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    await db.delete(rooms).where(eq(rooms.id, id));
    return true;
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const { db } = await import("./db");
    const { players } = await import("@shared/schema");
    
    const [player] = await db
      .insert(players)
      .values(insertPlayer)
      .returning();
    return player;
  }

  async getPlayer(id: string): Promise<Player | undefined> {
    const { db } = await import("./db");
    const { players } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const [player] = await db.select().from(players).where(eq(players.id, id));
    return player || undefined;
  }

  async getPlayersByRoom(roomId: string): Promise<Player[]> {
    const { db } = await import("./db");
    const { players } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    return await db.select().from(players).where(eq(players.roomId, roomId));
  }

  async updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined> {
    const { db } = await import("./db");
    const { players } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    const [player] = await db
      .update(players)
      .set(updates)
      .where(eq(players.id, id))
      .returning();
    return player || undefined;
  }

  async deletePlayer(id: string): Promise<boolean> {
    const { db } = await import("./db");
    const { players } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    await db.delete(players).where(eq(players.id, id));
    return true;
  }

  async deletePlayersByRoom(roomId: string): Promise<void> {
    const { db } = await import("./db");
    const { players } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    await db.delete(players).where(eq(players.roomId, roomId));
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const { db } = await import("./db");
    const { votes } = await import("@shared/schema");
    
    const [vote] = await db
      .insert(votes)
      .values(insertVote)
      .returning();
    return vote;
  }

  async getVotesByRoom(roomId: string): Promise<Vote[]> {
    const { db } = await import("./db");
    const { votes } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    return await db.select().from(votes).where(eq(votes.roomId, roomId));
  }

  async getVotesByRoomAndRound(roomId: string, round: number): Promise<Vote[]> {
    const { db } = await import("./db");
    const { votes } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    return await db.select().from(votes).where(
      and(eq(votes.roomId, roomId), eq(votes.round, round))
    );
  }

  async deleteVotesByRoom(roomId: string): Promise<void> {
    const { db } = await import("./db");
    const { votes } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    
    await db.delete(votes).where(eq(votes.roomId, roomId));
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
