import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 6 }).notNull().unique(),
  hostId: varchar("host_id").notNull(),
  isActive: boolean("is_active").default(true),
  secretWord: text("secret_word"),
  secretAgent: varchar("secret_agent"),
  gameState: varchar("game_state").default("lobby"), // lobby, playing, voting, finished
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const players = pgTable("players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  roomId: varchar("room_id").references(() => rooms.id),
  socketId: varchar("socket_id"),
  isConnected: boolean("is_connected").default(true),
  score: integer("score").default(0),
  joinedAt: timestamp("joined_at").default(sql`now()`),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").references(() => rooms.id),
  playerId: varchar("player_id").references(() => players.id),
  suspectId: varchar("suspect_id").references(() => players.id),
  round: integer("round").default(1),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const insertRoomSchema = createInsertSchema(rooms).pick({
  hostId: true,
});

export const insertPlayerSchema = createInsertSchema(players).pick({
  name: true,
  roomId: true,
});

export const insertVoteSchema = createInsertSchema(votes).pick({
  roomId: true,
  playerId: true,
  suspectId: true,
  round: true,
});

export type Room = typeof rooms.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertVote = z.infer<typeof insertVoteSchema>;

// WebSocket message types
export interface WSMessage {
  type: string;
  payload?: any;
}

export interface PlayerJoinedMessage extends WSMessage {
  type: "PLAYER_JOINED";
  payload: {
    player: Player;
    players: Player[];
  };
}

export interface PlayerLeftMessage extends WSMessage {
  type: "PLAYER_LEFT";
  payload: {
    playerId: string;
    players: Player[];
  };
}

export interface GameStartedMessage extends WSMessage {
  type: "GAME_STARTED";
  payload: {
    secretWord: string;
    secretAgent: string;
    isSecretAgent: boolean;
  };
}

export interface VotingStartedMessage extends WSMessage {
  type: "VOTING_STARTED";
  payload: {
    players: Player[];
  };
}

export interface VoteSubmittedMessage extends WSMessage {
  type: "VOTE_SUBMITTED";
  payload: {
    playerId: string;
    suspectId: string;
  };
}

export interface GameEndedMessage extends WSMessage {
  type: "GAME_ENDED";
  payload: {
    secretWord: string;
    secretAgent: string;
    votes: Vote[];
    winner: "agents" | "spy";
    players: Player[];
  };
}
