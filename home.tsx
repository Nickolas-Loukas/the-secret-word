import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import type { Room, Player, WSMessage, PlayerJoinedMessage, GameStartedMessage, VotingStartedMessage, GameEndedMessage } from "@shared/schema";
import { Eye, Plus, LogIn, Users, Play, Share, LogOut, Trophy, Home, CheckCircle, Clock } from "lucide-react";

type GameState = "lobby" | "waiting" | "playing" | "voting" | "finished";

interface GameData {
  room: Room | null;
  players: Player[];
  currentPlayer: Player | null;
  secretWord: string | null;
  isSecretAgent: boolean;
  gameResults: any | null;
}

export default function HomePage() {
  const [gameState, setGameState] = useState<GameState>("lobby");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gameData, setGameData] = useState<GameData>({
    room: null,
    players: [],
    currentPlayer: null,
    secretWord: null,
    isSecretAgent: false,
    gameResults: null,
  });
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [agentGuess, setAgentGuess] = useState("");

  const { toast } = useToast();
  const { isConnected, lastMessage, sendMessage } = useWebSocket("/ws");

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      handleWebSocketMessage(lastMessage);
    }
  }, [lastMessage]);

  const handleWebSocketMessage = (message: WSMessage) => {
    switch (message.type) {
      case "PLAYER_JOINED":
        const joinMsg = message as PlayerJoinedMessage;
        setGameData(prev => ({ ...prev, players: joinMsg.payload.players }));
        toast({ title: "Παίκτης συνδέθηκε", description: `${joinMsg.payload.player.name} εισήλθε στο δωμάτιο` });
        break;

      case "PLAYER_LEFT":
        const leftMsg = message as any;
        setGameData(prev => ({ ...prev, players: leftMsg.payload.players }));
        break;

      case "GAME_STARTED":
        const gameMsg = message as GameStartedMessage;
        setGameData(prev => ({
          ...prev,
          secretWord: gameMsg.payload.isSecretAgent ? null : gameMsg.payload.secretWord,
          isSecretAgent: gameMsg.payload.isSecretAgent
        }));
        setGameState("playing");
        toast({ 
          title: gameMsg.payload.isSecretAgent ? "Είστε ο Μυστικός Πράκτορας!" : "Είστε Πιστός Πράκτορας", 
          description: gameMsg.payload.isSecretAgent ? "Προσπαθήστε να μαντέψετε τη λέξη!" : `Η μυστική λέξη είναι: ${gameMsg.payload.secretWord}` 
        });
        break;

      case "VOTING_STARTED":
        const votingMsg = message as VotingStartedMessage;
        setGameState("voting");
        toast({ title: "Ξεκίνησε η ψηφοφορία!", description: "Ψηφίστε ποιος πιστεύετε ότι είναι ο μυστικός πράκτορας" });
        break;

      case "GAME_ENDED":
        const endMsg = message as GameEndedMessage;
        setGameData(prev => ({ ...prev, gameResults: endMsg.payload }));
        setGameState("finished");
        break;

      case "ERROR":
        toast({ 
          title: "Σφάλμα", 
          description: message.payload?.message || "Παρουσιάστηκε σφάλμα",
          variant: "destructive" 
        });
        break;
    }
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast({ title: "Σφάλμα", description: "Παρακαλώ εισάγετε το όνομά σας", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Create room
      const roomResponse = await apiRequest("POST", "/api/rooms", { hostId: "temp-host-id" });
      const room: Room = await roomResponse.json();

      // Create player
      const playerResponse = await apiRequest("POST", "/api/players", { 
        name: playerName, 
        roomId: room.id 
      });
      const player: Player = await playerResponse.json();

      setGameData({ 
        room, 
        players: [player], 
        currentPlayer: player,
        secretWord: null,
        isSecretAgent: false,
        gameResults: null
      });
      setGameState("waiting");

      // Join WebSocket room
      sendMessage({
        type: "JOIN_ROOM",
        payload: { playerId: player.id, roomId: room.id }
      });

      toast({ title: "Επιτυχία!", description: `Δωμάτιο δημιουργήθηκε με κωδικό: ${room.code}` });
    } catch (error) {
      toast({ title: "Σφάλμα", description: "Αποτυχία δημιουργίας δωματίου", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      toast({ title: "Σφάλμα", description: "Παρακαλώ συμπληρώστε όλα τα πεδία", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Get room
      const roomResponse = await apiRequest("GET", `/api/rooms/${roomCode.toUpperCase()}`);
      const room: Room = await roomResponse.json();

      // Create player
      const playerResponse = await apiRequest("POST", "/api/players", { 
        name: playerName, 
        roomId: room.id 
      });
      const player: Player = await playerResponse.json();

      // Get all players
      const playersResponse = await apiRequest("GET", `/api/rooms/${room.id}/players`);
      const players: Player[] = await playersResponse.json();

      setGameData({ 
        room, 
        players, 
        currentPlayer: player,
        secretWord: null,
        isSecretAgent: false,
        gameResults: null
      });
      setGameState("waiting");

      // Join WebSocket room
      sendMessage({
        type: "JOIN_ROOM",
        payload: { playerId: player.id, roomId: room.id }
      });

      toast({ title: "Επιτυχία!", description: `Συνδεθήκατε στο δωμάτιο ${room.code}` });
    } catch (error) {
      toast({ title: "Σφάλμα", description: "Το δωμάτιο δεν βρέθηκε", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const startVoting = () => {
    sendMessage({ type: "START_VOTING" });
  };

  const startGame = () => {
    sendMessage({ type: "START_GAME" });
  };

  const submitVote = () => {
    if (!selectedVote) {
      toast({ title: "Σφάλμα", description: "Παρακαλώ επιλέξτε έναν παίκτη", variant: "destructive" });
      return;
    }
    sendMessage({ 
      type: "SUBMIT_VOTE", 
      payload: { suspectId: selectedVote } 
    });
    toast({ title: "Η ψήφος σας καταχωρήθηκε!", description: "Αναμονή για τους υπόλοιπους παίκτες" });
  };

  const submitAgentGuess = () => {
    if (!agentGuess.trim()) {
      toast({ title: "Σφάλμα", description: "Παρακαλώ εισάγετε τη μαντεία σας", variant: "destructive" });
      return;
    }
    sendMessage({ 
      type: "AGENT_GUESS", 
      payload: { guess: agentGuess } 
    });
  };

  const backToLobby = () => {
    setGameState("lobby");
    setGameData({
      room: null,
      players: [],
      currentPlayer: null,
      secretWord: null,
      isSecretAgent: false,
      gameResults: null,
    });
    setRoomCode("");
    setPlayerName("");
    setSelectedVote(null);
    setAgentGuess("");
  };

  if (gameState === "lobby") {
    return (
      <div className="min-h-screen bg-dark text-white font-inter">
        {/* Navigation */}
        <nav className="bg-surface border-b border-slate-700 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Η Κρυφή Λέξη
              </h1>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Καλώς ήρθατε στο παιχνίδι!
              </h2>
              <p className="text-slate-400 text-lg">Δημιουργήστε ένα δωμάτιο ή εισάγετε κωδικό για να συμμετάσχετε</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Create Room Card */}
              <Card className="game-card rounded-2xl p-8 text-center">
                <CardContent className="p-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-accent to-emerald-400 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                    <Plus className="text-white text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Δημιουργία Δωματίου</h3>
                  <p className="text-slate-400 mb-6">Ξεκινήστε ένα νέο παιχνίδι και προσκαλέστε φίλους</p>
                  <div className="space-y-4">
                    <Input
                      placeholder="Το όνομά σας"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <Button 
                      onClick={createRoom}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-accent to-emerald-400 hover:from-emerald-400 hover:to-accent text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                    >
                      {isLoading ? <LoadingSpinner className="mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                      Δημιουργία Παιχνιδιού
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Join Room Card */}
              <Card className="game-card rounded-2xl p-8 text-center">
                <CardContent className="p-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl mx-auto mb-6 flex items-center justify-center">
                    <LogIn className="text-white text-2xl" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">Συμμετοχή σε Δωμάτιο</h3>
                  <p className="text-slate-400 mb-6">Εισάγετε τον 6ψήφιο κωδικό για να συμμετάσχετε</p>
                  <div className="space-y-4">
                    <Input
                      placeholder="Το όνομά σας"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                    <Input
                      placeholder="Κωδικός Δωματίου (6 ψηφία)"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                      className="bg-slate-700 border-slate-600 text-center text-xl font-mono tracking-widest text-white"
                      maxLength={6}
                    />
                    <Button 
                      onClick={joinRoom}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                    >
                      {isLoading ? <LoadingSpinner className="mr-2" /> : <LogIn className="mr-2 h-4 w-4" />}
                      Είσοδος στο Παιχνίδι
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-surface border-t border-slate-700 py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-slate-400">
              Created by <span className="text-white font-semibold">Nickolas Loukas</span> © 2025
            </p>
            <div className="mt-2 flex justify-center space-x-4 text-sm text-slate-500">
              <span>Λεξικό: 200+ μυστικές λέξεις</span>
              <span>•</span>
              <span>Πραγματικός χρόνος</span>
              <span>•</span>
              <span>Πολλαπλοί παίκτες</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (gameState === "waiting") {
    return (
      <div className="min-h-screen bg-dark text-white font-inter">
        {/* Navigation */}
        <nav className="bg-surface border-b border-slate-700 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Η Κρυφή Λέξη
              </h1>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          {/* Room Info Header */}
          <Card className="game-card rounded-2xl p-6 mb-6">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                    <Users className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Δωμάτιο: <span className="font-mono text-primary">{gameData.room?.code}</span></h3>
                    <p className="text-slate-400">Παίκτες: {gameData.players.length}/8</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button 
                    onClick={startVoting}
                    className="bg-accent hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Έναρξη Ψηφοφορίας
                  </Button>
                  <Button 
                    onClick={startGame}
                    className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Έναρξη Παιχνιδιού
                  </Button>
                  <Button variant="outline" className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl transition-colors">
                    <Share className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={backToLobby}
                    className="bg-danger hover:bg-red-500 text-white px-4 py-3 rounded-xl transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Players Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            {gameData.players.map((player, index) => (
              <Card key={player.id} className="player-card rounded-xl p-4 border border-slate-600">
                <CardContent className="p-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br ${
                      index % 4 === 0 ? 'from-purple-500 to-pink-500' :
                      index % 4 === 1 ? 'from-blue-500 to-cyan-500' :
                      index % 4 === 2 ? 'from-orange-500 to-red-500' :
                      'from-green-500 to-teal-500'
                    }`}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{player.name}</div>
                      <div className="text-sm text-slate-400">Βαθμολογία: {player.score}</div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${player.isConnected ? 'bg-accent' : 'bg-red-500'}`} title={player.isConnected ? "Συνδεδεμένος" : "Αποσυνδεδεμένος"}></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-surface border-t border-slate-700 py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-slate-400">
              Created by <span className="text-white font-semibold">Nickolas Loukas</span> © 2025
            </p>
          </div>
        </footer>
      </div>
    );
  }

  if (gameState === "playing") {
    return (
      <div className="min-h-screen bg-dark text-white font-inter">
        {/* Navigation */}
        <nav className="bg-surface border-b border-slate-700 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Η Κρυφή Λέξη
              </h1>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          <Card className="game-card rounded-2xl p-8 text-center">
            <CardContent className="p-0">
              <h3 className="text-2xl font-bold mb-6">
                {gameData.isSecretAgent ? "Βρείτε την Κρυφή Λέξη!" : "Προστατέψτε την Κρυφή Λέξη!"}
              </h3>
              
              {gameData.isSecretAgent ? (
                <div className="max-w-md mx-auto">
                  <p className="text-slate-400 mb-6">Είστε ο Μυστικός Πράκτορας! Προσπαθήστε να μαντέψετε τη μυστική λέξη.</p>
                  <div className="space-y-4">
                    <Input
                      placeholder="Η μαντεία σας..."
                      value={agentGuess}
                      onChange={(e) => setAgentGuess(e.target.value)}
                      className="bg-slate-700 border-slate-600 text-white text-center text-xl"
                    />
                    <Button 
                      onClick={submitAgentGuess}
                      className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
                    >
                      Υποβολή Μαντείας
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-slate-400 mb-4">Είστε Πιστός Πράκτορας! Η μυστική λέξη είναι:</p>
                  <div className="text-4xl font-bold text-primary mb-6">{gameData.secretWord}</div>
                  <p className="text-slate-400">Προσπαθήστε να δώσετε στοιχεία χωρίς να αποκαλύψετε τη λέξη!</p>
                </div>
              )}

              <Button 
                onClick={startVoting}
                className="mt-8 bg-accent hover:bg-emerald-400 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
              >
                <Play className="mr-2 h-4 w-4" />
                Έναρξη Ψηφοφορίας
              </Button>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="bg-surface border-t border-slate-700 py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-slate-400">
              Created by <span className="text-white font-semibold">Nickolas Loukas</span> © 2025
            </p>
          </div>
        </footer>
      </div>
    );
  }

  if (gameState === "voting") {
    return (
      <div className="min-h-screen bg-dark text-white font-inter">
        {/* Navigation */}
        <nav className="bg-surface border-b border-slate-700 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Η Κρυφή Λέξη
              </h1>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          <Card className="game-card rounded-2xl p-8">
            <CardContent className="p-0">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-4">Ώρα για Ψηφοφορία!</h3>
                <p className="text-slate-400">Ποιος πιστεύετε ότι είναι ο Μυστικός Πράκτορας;</p>
              </div>

              {/* Players Grid for Voting */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
                {gameData.players.filter(p => p.id !== gameData.currentPlayer?.id).map((player, index) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedVote(player.id)}
                    className={`word-cell rounded-xl p-4 text-center cursor-pointer border-2 transition-all ${
                      selectedVote === player.id 
                        ? 'border-accent bg-accent bg-opacity-20' 
                        : 'border-transparent bg-slate-700 hover:bg-slate-600 hover:border-primary'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold bg-gradient-to-br ${
                      index % 4 === 0 ? 'from-purple-500 to-pink-500' :
                      index % 4 === 1 ? 'from-blue-500 to-cyan-500' :
                      index % 4 === 2 ? 'from-orange-500 to-red-500' :
                      'from-green-500 to-teal-500'
                    }`}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-lg font-semibold">{player.name}</div>
                  </button>
                ))}
              </div>

              {/* Voting Actions */}
              <div className="text-center">
                <Button 
                  onClick={submitVote}
                  disabled={!selectedVote}
                  className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300 disabled:opacity-50"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Υποβολή Ψήφου
                </Button>
                
                <div className="mt-6 inline-flex items-center space-x-4 bg-slate-700 rounded-xl px-6 py-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="text-primary h-4 w-4" />
                    <span className="font-semibold">Ψηφοφορία σε εξέλιξη</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="bg-surface border-t border-slate-700 py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-slate-400">
              Created by <span className="text-white font-semibold">Nickolas Loukas</span> © 2025
            </p>
          </div>
        </footer>
      </div>
    );
  }

  if (gameState === "finished") {
    const results = gameData.gameResults;
    const sortedPlayers = [...gameData.players].sort((a, b) => b.score - a.score);

    return (
      <div className="min-h-screen bg-dark text-white font-inter">
        {/* Navigation */}
        <nav className="bg-surface border-b border-slate-700 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Η Κρυφή Λέξη
              </h1>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          <Card className="game-card rounded-2xl p-8 max-w-2xl mx-auto text-center">
            <CardContent className="p-0">
              <div className="w-20 h-20 bg-gradient-to-br from-accent to-emerald-400 rounded-full mx-auto mb-6 flex items-center justify-center">
                <Trophy className="text-white text-3xl" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Τέλος Παιχνιδιού!</h2>
              <p className="text-xl text-slate-300 mb-2">Η κρυφή λέξη ήταν: <span className="text-primary font-bold">{results?.secretWord}</span></p>
              <p className="text-lg text-slate-400 mb-8">
                Κερδίζουν οι: <span className="text-accent font-bold">
                  {results?.winner === 'spy' ? 'Μυστικός Πράκτορας' : 'Πιστοί Πράκτορες'}
                </span>
              </p>
              
              {/* Final Scores */}
              <div className="space-y-3 mb-8">
                {sortedPlayers.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between bg-slate-700 rounded-xl p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-600' : 'bg-slate-600'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-semibold">{player.name}</span>
                      {player.id === results?.secretAgent && (
                        <span className="text-xs bg-red-500 px-2 py-1 rounded">Μυστικός</span>
                      )}
                    </div>
                    <span className={`text-xl font-bold ${index === 0 ? 'text-accent' : ''}`}>
                      {player.score} βαθμοί
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={startGame}
                  className="bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Νέο Παιχνίδι
                </Button>
                <Button 
                  onClick={backToLobby}
                  variant="outline"
                  className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Επιστροφή στο Λόμπι
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="bg-surface border-t border-slate-700 py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className="text-slate-400">
              Created by <span className="text-white font-semibold">Nickolas Loukas</span> © 2025
            </p>
          </div>
        </footer>
      </div>
    );
  }

  return null;
}
