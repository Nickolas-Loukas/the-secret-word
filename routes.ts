import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertRoomSchema, insertPlayerSchema, insertVoteSchema } from "@shared/schema";
import { getRandomWord } from "./data/words";
import type { WSMessage, PlayerJoinedMessage, PlayerLeftMessage, GameStartedMessage, VotingStartedMessage, VoteSubmittedMessage, GameEndedMessage } from "@shared/schema";

interface ExtendedWebSocket extends WebSocket {
  playerId?: string;
  roomId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // REST API Routes
  app.post("/api/rooms", async (req, res) => {
    try {
      const { hostId } = insertRoomSchema.parse(req.body);
      const room = await storage.createRoom({ hostId });
      res.json(room);
    } catch (error) {
      res.status(400).json({ error: "Invalid room data" });
    }
  });

  app.get("/api/rooms/:code", async (req, res) => {
    try {
      const room = await storage.getRoomByCode(req.params.code);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/players", async (req, res) => {
    try {
      const playerData = insertPlayerSchema.parse(req.body);
      const room = await storage.getRoomById(playerData.roomId!);
      if (!room) {
        return res.status(404).json({ error: "Room not found" });
      }

      const existingPlayers = await storage.getPlayersByRoom(playerData.roomId!);
      if (existingPlayers.length >= 8) {
        return res.status(400).json({ error: "Room is full" });
      }

      const player = await storage.createPlayer(playerData);
      res.json(player);
    } catch (error) {
      res.status(400).json({ error: "Invalid player data" });
    }
  });

  app.get("/api/rooms/:roomId/players", async (req, res) => {
    try {
      const players = await storage.getPlayersByRoom(req.params.roomId);
      res.json(players);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // WebSocket handling
  wss.on('connection', (ws: ExtendedWebSocket) => {
    console.log('New WebSocket connection');

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, message, wss);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Invalid message format' } }));
      }
    });

    ws.on('close', async () => {
      console.log('WebSocket connection closed');
      if (ws.playerId && ws.roomId) {
        await handlePlayerDisconnect(ws, wss);
      }
    });
  });

  async function handleWebSocketMessage(ws: ExtendedWebSocket, message: WSMessage, wss: WebSocketServer) {
    switch (message.type) {
      case 'JOIN_ROOM':
        await handleJoinRoom(ws, message.payload, wss);
        break;
      case 'START_VOTING':
        await handleStartVoting(ws, message.payload, wss);
        break;
      case 'SUBMIT_VOTE':
        await handleSubmitVote(ws, message.payload, wss);
        break;
      case 'START_GAME':
        await handleStartGame(ws, message.payload, wss);
        break;
      case 'AGENT_GUESS':
        await handleAgentGuess(ws, message.payload, wss);
        break;
      default:
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Unknown message type' } }));
    }
  }

  async function handleJoinRoom(ws: ExtendedWebSocket, payload: { playerId: string, roomId: string }, wss: WebSocketServer) {
    try {
      const player = await storage.getPlayer(payload.playerId);
      const room = await storage.getRoomById(payload.roomId);

      if (!player || !room) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Player or room not found' } }));
        return;
      }

      // Update player with socket info
      await storage.updatePlayer(player.id, { socketId: 'ws-id', isConnected: true });
      
      ws.playerId = player.id;
      ws.roomId = room.id;

      // Get all players in room
      const players = await storage.getPlayersByRoom(room.id);

      // Notify all players in room
      const joinMessage: PlayerJoinedMessage = {
        type: 'PLAYER_JOINED',
        payload: { player, players }
      };

      broadcastToRoom(wss, room.id, joinMessage);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Failed to join room' } }));
    }
  }

  async function handleStartVoting(ws: ExtendedWebSocket, payload: any, wss: WebSocketServer) {
    if (!ws.roomId) return;

    try {
      const room = await storage.getRoomById(ws.roomId);
      if (!room) return;

      // Check if game is in playing state
      if (room.gameState !== 'playing') {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Η ψηφοφορία μπορεί να ξεκινήσει μόνο κατά τη διάρκεια του παιχνιδιού' } }));
        return;
      }

      // Update room state
      await storage.updateRoom(room.id, { gameState: 'voting' });

      const players = await storage.getPlayersByRoom(room.id);

      const votingMessage: VotingStartedMessage = {
        type: 'VOTING_STARTED',
        payload: { players }
      };

      broadcastToRoom(wss, room.id, votingMessage);
    } catch (error) {
      console.error('Error starting voting:', error);
    }
  }

  async function handleSubmitVote(ws: ExtendedWebSocket, payload: { suspectId: string }, wss: WebSocketServer) {
    if (!ws.roomId || !ws.playerId) return;

    try {
      const room = await storage.getRoomById(ws.roomId);
      if (!room || room.gameState !== 'voting') return;

      // Create vote
      await storage.createVote({
        roomId: room.id,
        playerId: ws.playerId,
        suspectId: payload.suspectId,
        round: 1
      });

      // Check if all players have voted
      const players = await storage.getPlayersByRoom(room.id);
      const votes = await storage.getVotesByRoomAndRound(room.id, 1);

      if (votes.length === players.length) {
        // All players voted, end game
        await endGame(room.id, wss);
      } else {
        // Notify vote submitted
        const voteMessage: VoteSubmittedMessage = {
          type: 'VOTE_SUBMITTED',
          payload: { playerId: ws.playerId, suspectId: payload.suspectId }
        };

        broadcastToRoom(wss, room.id, voteMessage);
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
    }
  }

  async function handleStartGame(ws: ExtendedWebSocket, payload: any, wss: WebSocketServer) {
    if (!ws.roomId) return;

    try {
      const room = await storage.getRoomById(ws.roomId);
      if (!room) return;

      const players = await storage.getPlayersByRoom(room.id);
      if (players.length < 3) {
        ws.send(JSON.stringify({ type: 'ERROR', payload: { message: 'Χρειάζονται τουλάχιστον 3 παίκτες για να ξεκινήσει το παιχνίδι' } }));
        return;
      }

      // Select secret word and agent
      const secretWord = getRandomWord();
      const secretAgent = players[Math.floor(Math.random() * players.length)];

      // Update room
      await storage.updateRoom(room.id, {
        gameState: 'playing',
        secretWord,
        secretAgent: secretAgent.id
      });

      // Send role information to each player
      for (const player of players) {
        const ws_player = findWebSocketByPlayerId(wss, player.id);
        if (ws_player && ws_player.readyState === WebSocket.OPEN) {
          const gameMessage: GameStartedMessage = {
            type: 'GAME_STARTED',
            payload: {
              secretWord,
              secretAgent: secretAgent.id,
              isSecretAgent: player.id === secretAgent.id
            }
          };
          ws_player.send(JSON.stringify(gameMessage));
        }
      }
    } catch (error) {
      console.error('Error starting game:', error);
    }
  }

  async function handleAgentGuess(ws: ExtendedWebSocket, payload: { guess: string }, wss: WebSocketServer) {
    if (!ws.roomId || !ws.playerId) return;

    try {
      const room = await storage.getRoomById(ws.roomId);
      if (!room || room.secretAgent !== ws.playerId) return;

      const isCorrect = payload.guess.toLowerCase() === room.secretWord?.toLowerCase();
      
      if (isCorrect) {
        // Secret agent wins
        await storage.updateRoom(room.id, { gameState: 'finished' });
        
        const players = await storage.getPlayersByRoom(room.id);
        const endMessage: GameEndedMessage = {
          type: 'GAME_ENDED',
          payload: {
            secretWord: room.secretWord!,
            secretAgent: room.secretAgent!,
            votes: [],
            winner: 'spy',
            players
          }
        };

        broadcastToRoom(wss, room.id, endMessage);
      } else {
        ws.send(JSON.stringify({ type: 'GUESS_WRONG', payload: { message: 'Λάθος μαντεία!' } }));
      }
    } catch (error) {
      console.error('Error handling agent guess:', error);
    }
  }

  async function handlePlayerDisconnect(ws: ExtendedWebSocket, wss: WebSocketServer) {
    if (!ws.playerId || !ws.roomId) return;

    try {
      await storage.updatePlayer(ws.playerId, { isConnected: false });
      const players = await storage.getPlayersByRoom(ws.roomId);

      const leftMessage: PlayerLeftMessage = {
        type: 'PLAYER_LEFT',
        payload: { playerId: ws.playerId, players }
      };

      broadcastToRoom(wss, ws.roomId, leftMessage);
    } catch (error) {
      console.error('Error handling player disconnect:', error);
    }
  }

  async function endGame(roomId: string, wss: WebSocketServer) {
    try {
      const room = await storage.getRoomById(roomId);
      if (!room) return;

      const players = await storage.getPlayersByRoom(roomId);
      const votes = await storage.getVotesByRoomAndRound(roomId, 1);

      // Count votes against each player
      const voteCount: Record<string, number> = {};
      votes.forEach(vote => {
        voteCount[vote.suspectId!] = (voteCount[vote.suspectId!] || 0) + 1;
      });

      // Find most voted player
      const mostVoted = Object.entries(voteCount).reduce((a, b) => a[1] > b[1] ? a : b);
      const winner = mostVoted[0] === room.secretAgent ? 'agents' : 'spy';

      // Update room state
      await storage.updateRoom(roomId, { gameState: 'finished' });

      const endMessage: GameEndedMessage = {
        type: 'GAME_ENDED',
        payload: {
          secretWord: room.secretWord!,
          secretAgent: room.secretAgent!,
          votes,
          winner,
          players
        }
      };

      broadcastToRoom(wss, roomId, endMessage);
    } catch (error) {
      console.error('Error ending game:', error);
    }
  }

  function broadcastToRoom(wss: WebSocketServer, roomId: string, message: WSMessage) {
    wss.clients.forEach((client: WebSocket) => {
      const extClient = client as ExtendedWebSocket;
      if (extClient.roomId === roomId && extClient.readyState === WebSocket.OPEN) {
        extClient.send(JSON.stringify(message));
      }
    });
  }

  function findWebSocketByPlayerId(wss: WebSocketServer, playerId: string): ExtendedWebSocket | null {
    for (const client of Array.from(wss.clients)) {
      const extClient = client as ExtendedWebSocket;
      if (extClient.playerId === playerId) {
        return extClient;
      }
    }
    return null;
  }

  return httpServer;
}
