import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SettingsDialog } from "@/components/ui/settings-dialog";
import { LanguageSelector } from "@/components/ui/language-selector";
import { InstructionsDialog } from "@/components/ui/instructions-dialog";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { useGame } from "@/contexts/GameContext";
import { translations } from "@/translations";
import { apiRequest } from "@/lib/queryClient";
import type { Room, Player, WSMessage, PlayerJoinedMessage, GameStartedMessage, VotingStartedMessage, GameEndedMessage } from "@shared/schema";
import { Eye, Plus, LogIn, Users, Play, Share, LogOut, Trophy, Home, CheckCircle, Volume2, VolumeX } from "lucide-react";

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
  const { language, theme, musicEnabled } = useGame();
  const t = translations[language];

  // Apply theme on load
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
        toast({ title: t.playerJoined, description: `${joinMsg.payload.player.name} ${t.playerEnteredRoom}` });
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
          title: gameMsg.payload.isSecretAgent ? t.youAreSecretAgent : t.youAreFaithfulAgent, 
          description: gameMsg.payload.isSecretAgent ? t.tryToGuess : `${t.secretWordIs} ${gameMsg.payload.secretWord}` 
        });
        break;

      case "VOTING_STARTED":
        const votingMsg = message as VotingStartedMessage;
        setGameState("voting");
        toast({ title: t.votingStarted, description: t.votingDesc });
        break;

      case "GAME_ENDED":
        const endMsg = message as GameEndedMessage;
        setGameData(prev => ({ ...prev, gameResults: endMsg.payload }));
        setGameState("finished");
        break;

      case "ERROR":
        toast({ 
          title: t.error, 
          description: message.payload?.message || "Παρουσιάστηκε σφάλμα",
          variant: "destructive" 
        });
        break;
    }
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      toast({ title: t.error, description: t.enterName, variant: "destructive" });
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

      toast({ title: t.success, description: `${t.roomCreated} ${room.code}` });
    } catch (error) {
      toast({ title: t.error, description: "Αποτυχία δημιουργίας δωματίου", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      toast({ title: t.error, description: t.fillAllFields, variant: "destructive" });
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

      toast({ title: t.success, description: `${t.connectedToRoom} ${room.code}` });
    } catch (error) {
      toast({ title: t.error, description: t.roomNotFound, variant: "destructive" });
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
      toast({ title: t.error, description: t.selectPlayer, variant: "destructive" });
      return;
    }
    sendMessage({ 
      type: "SUBMIT_VOTE", 
      payload: { suspectId: selectedVote } 
    });
    toast({ title: t.voteSubmitted, description: t.waitingForOthers });
  };

  const submitAgentGuess = () => {
    if (!agentGuess.trim()) {
      toast({ title: t.error, description: t.enterGuess, variant: "destructive" });
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
      <div className={`min-h-screen font-inter ${theme === 'dark' ? 'bg-dark text-white' : 'bg-white text-black'}`}>
        {/* Navigation */}
        <nav className={`${theme === 'dark' ? 'bg-surface border-slate-700' : 'bg-gray-100 border-gray-300'} border-b px-4 py-4`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t.title}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <InstructionsDialog />
              <SettingsDialog />
              <LanguageSelector />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h2 className={`text-4xl font-bold mb-4 ${theme === 'dark' ? 'bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent' : 'text-gray-800'}`}>
                {t.welcome}
              </h2>
              <p className={`text-lg ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.subtitle}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Create Room Card */}
              <Card className={`game-card rounded-2xl p-8 text-center ${theme === 'dark' ? '' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-accent to-emerald-400 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                    <Plus className="text-white text-2xl" />
                  </div>
                  <h3 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{t.createRoom}</h3>
                  <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.createRoomDesc}</p>
                  <div className="space-y-4">
                    <Input
                      placeholder={t.yourName}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className={`${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-white border-gray-300 text-black placeholder:text-gray-500'}`}
                    />
                    <Button 
                      onClick={createRoom}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-accent to-emerald-400 hover:from-emerald-400 hover:to-accent text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                    >
                      {isLoading ? <LoadingSpinner className="mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                      {t.createGame}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Join Room Card */}
              <Card className={`game-card rounded-2xl p-8 text-center ${theme === 'dark' ? '' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl mx-auto mb-6 flex items-center justify-center">
                    <LogIn className="text-white text-2xl" />
                  </div>
                  <h3 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{t.joinRoom}</h3>
                  <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.joinRoomDesc}</p>
                  <div className="space-y-4">
                    <Input
                      placeholder={t.yourName}
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className={`${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-white border-gray-300 text-black placeholder:text-gray-500'}`}
                    />
                    <Input
                      placeholder={t.roomCode}
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                      className={`text-center text-xl font-mono tracking-widest ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-white border-gray-300 text-black placeholder:text-gray-500'}`}
                      maxLength={6}
                    />
                    <Button 
                      onClick={joinRoom}
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-primary to-secondary hover:from-secondary hover:to-primary text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                    >
                      {isLoading ? <LoadingSpinner className="mr-2" /> : <LogIn className="mr-2 h-4 w-4" />}
                      {t.enterGame}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className={`${theme === 'dark' ? 'bg-surface border-slate-700' : 'bg-gray-100 border-gray-300'} border-t py-6 mt-auto`}>
          <div className="max-w-6xl mx-auto px-4 text-center">
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>
              {t.createdBy} <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Nickolas Loukas</span> {t.copyright}
            </p>
            <div className={`mt-2 flex justify-center space-x-4 text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
              <span>{t.features.words}</span>
              <span>•</span>
              <span>{t.features.realtime}</span>
              <span>•</span>
              <span>{t.features.multiplayer}</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (gameState === "waiting") {
    return (
      <div className={`min-h-screen font-inter ${theme === 'dark' ? 'bg-dark text-white' : 'bg-white text-black'}`}>
        {/* Navigation */}
        <nav className={`${theme === 'dark' ? 'bg-surface border-slate-700' : 'bg-gray-100 border-gray-300'} border-b px-4 py-4`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t.title}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <InstructionsDialog />
              <SettingsDialog />
              <LanguageSelector />
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
          {/* Room Info Header */}
          <Card className={`game-card rounded-2xl p-6 mb-6 ${theme === 'dark' ? '' : 'bg-white border-gray-200'}`}>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                    <Users className="text-white" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                      {t.room}: <span className="font-mono text-primary">{gameData.room?.code}</span>
                    </h3>
                    <p className={theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}>{t.players}: {gameData.players.length}/8</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Button 
                    onClick={startVoting}
                    disabled={gameData.room?.gameState !== 'playing'}
                    className="bg-accent hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {t.startVoting}
                  </Button>
                  <Button 
                    onClick={startGame}
                    className="bg-primary hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {t.startGame}
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gameData.players.map((player, index) => (
              <Card key={player.id} className={`player-card rounded-xl p-4 ${theme === 'dark' ? '' : 'bg-white border-gray-200'}`}>
                <CardContent className="p-0">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      index % 4 === 0 ? 'bg-primary' : 
                      index % 4 === 1 ? 'bg-accent' : 
                      index % 4 === 2 ? 'bg-secondary' : 'bg-purple-500'
                    }`}>
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{player.name}</p>
                      {player.id === gameData.room?.hostId && (
                        <p className="text-xs text-accent">Host</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (gameState === "playing") {
    return (
      <div className={`min-h-screen font-inter ${theme === 'dark' ? 'bg-dark text-white' : 'bg-white text-black'}`}>
        {/* Navigation */}
        <nav className={`${theme === 'dark' ? 'bg-surface border-slate-700' : 'bg-gray-100 border-gray-300'} border-b px-4 py-4`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t.title}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <InstructionsDialog />
              <SettingsDialog />
              <LanguageSelector />
            </div>
          </div>
        </nav>

        <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
          <div className="text-center mb-8">
            <div className={`inline-block px-6 py-3 rounded-full ${gameData.isSecretAgent ? 'bg-red-600' : 'bg-green-600'} text-white mb-4`}>
              {gameData.isSecretAgent ? t.secretAgent : t.faithfulAgent}
            </div>
            
            {gameData.isSecretAgent ? (
              <div className="space-y-4">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{t.tryToGuess}</h2>
                <div className="max-w-md mx-auto space-y-4">
                  <Input
                    placeholder={t.guess}
                    value={agentGuess}
                    onChange={(e) => setAgentGuess(e.target.value)}
                    className={`text-center text-xl ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-white border-gray-300 text-black placeholder:text-gray-500'}`}
                  />
                  <Button onClick={submitAgentGuess} className="w-full bg-red-600 hover:bg-red-700 text-white">
                    {t.submitGuess}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'} mb-4`}>{t.secretWordIs}</h2>
                <div className="text-4xl font-bold text-accent mb-6 bg-gradient-to-r from-accent to-emerald-400 bg-clip-text text-transparent">
                  {gameData.secretWord}
                </div>
              </div>
            )}
          </div>

          <Card className={`game-card rounded-2xl p-6 ${theme === 'dark' ? '' : 'bg-white border-gray-200'}`}>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  {t.room}: <span className="font-mono text-primary">{gameData.room?.code}</span>
                </h3>
                <Button 
                  onClick={startVoting}
                  className="bg-accent hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {t.startVoting}
                </Button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gameData.players.map((player, index) => (
                  <div key={player.id} className={`player-card rounded-xl p-4 ${theme === 'dark' ? '' : 'bg-gray-50'}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        index % 4 === 0 ? 'bg-primary' : 
                        index % 4 === 1 ? 'bg-accent' : 
                        index % 4 === 2 ? 'bg-secondary' : 'bg-purple-500'
                      }`}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{player.name}</p>
                        {player.id === gameData.currentPlayer?.id && (
                          <p className="text-xs text-accent">You</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (gameState === "voting") {
    return (
      <div className={`min-h-screen font-inter ${theme === 'dark' ? 'bg-dark text-white' : 'bg-white text-black'}`}>
        {/* Navigation */}
        <nav className={`${theme === 'dark' ? 'bg-surface border-slate-700' : 'bg-gray-100 border-gray-300'} border-b px-4 py-4`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t.title}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <InstructionsDialog />
              <SettingsDialog />
              <LanguageSelector />
            </div>
          </div>
        </nav>

        <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
          <div className="text-center mb-8">
            <h2 className={`text-3xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{t.votingStarted}</h2>
            <p className={`text-lg ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.votingDesc}</p>
          </div>

          <Card className={`game-card rounded-2xl p-6 ${theme === 'dark' ? '' : 'bg-white border-gray-200'}`}>
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {gameData.players.filter(p => p.id !== gameData.currentPlayer?.id).map((player, index) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedVote(player.id)}
                    className={`player-card rounded-xl p-4 transition-all duration-200 hover:scale-105 ${
                      selectedVote === player.id 
                        ? 'ring-2 ring-accent bg-accent/10' 
                        : theme === 'dark' ? 'hover:bg-slate-600/50' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                        index % 4 === 0 ? 'bg-primary' : 
                        index % 4 === 1 ? 'bg-accent' : 
                        index % 4 === 2 ? 'bg-secondary' : 'bg-purple-500'
                      }`}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{player.name}</p>
                        {selectedVote === player.id && (
                          <p className="text-xs text-accent">Selected</p>
                        )}
                      </div>
                      {selectedVote === player.id && (
                        <CheckCircle className="h-5 w-5 text-accent" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <Button 
                onClick={submitVote}
                disabled={!selectedVote}
                className="w-full bg-accent hover:bg-emerald-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.submitVote}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (gameState === "finished") {
    const results = gameData.gameResults;
    return (
      <div className={`min-h-screen font-inter ${theme === 'dark' ? 'bg-dark text-white' : 'bg-white text-black'}`}>
        {/* Navigation */}
        <nav className={`${theme === 'dark' ? 'bg-surface border-slate-700' : 'bg-gray-100 border-gray-300'} border-b px-4 py-4`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
                <Eye className="text-white text-lg" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t.title}
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <InstructionsDialog />
              <SettingsDialog />
              <LanguageSelector />
            </div>
          </div>
        </nav>

        <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
          <div className="text-center mb-8">
            <div className={`inline-flex items-center space-x-2 px-6 py-3 rounded-full ${results?.winner === 'spy' ? 'bg-red-600' : 'bg-green-600'} text-white mb-4`}>
              <Trophy className="h-5 w-5" />
              <span className="font-bold">
                {t.winner}: {results?.winner === 'spy' ? t.spy : t.agents}
              </span>
            </div>
          </div>

          <Card className={`game-card rounded-2xl p-6 mb-6 ${theme === 'dark' ? '' : 'bg-white border-gray-200'}`}>
            <CardContent className="p-0">
              <div className="text-center space-y-4">
                <div>
                  <p className={`text-lg ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.secretWordWas}</p>
                  <p className="text-3xl font-bold text-accent">{results?.secretWord}</p>
                </div>
                <div>
                  <p className={`text-lg ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>{t.secretAgentWas}</p>
                  <p className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    {results?.players?.find((p: Player) => p.id === results.secretAgent)?.name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center space-y-4">
            <Button 
              onClick={backToLobby}
              className="bg-primary hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Lobby
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Default loading state
  return (
    <div className={`min-h-screen font-inter ${theme === 'dark' ? 'bg-dark text-white' : 'bg-white text-black'}`}>
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner className="mx-auto mb-4" size="lg" />
          <p className={theme === 'dark' ? 'text-white' : 'text-black'}>{t.loading}</p>
        </div>
      </div>
    </div>
  );
}