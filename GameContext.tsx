import { createContext, useContext, useState, useEffect } from 'react';

type Language = 'greek' | 'english';
type Theme = 'light' | 'dark';

interface GameContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('greek');
  const [theme, setTheme] = useState<Theme>('dark'); // Default to dark as requested
  const [musicEnabled, setMusicEnabled] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('game-language') as Language;
    const savedTheme = localStorage.getItem('game-theme') as Theme;
    const savedMusic = localStorage.getItem('game-music');

    if (savedLanguage) setLanguage(savedLanguage);
    if (savedTheme) setTheme(savedTheme);
    if (savedMusic !== null) setMusicEnabled(savedMusic === 'true');

    // Apply theme to document on load
    if (savedTheme === 'dark' || (!savedTheme && theme === 'dark')) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('game-language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('game-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('game-music', musicEnabled.toString());
  }, [musicEnabled]);

  return (
    <GameContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        musicEnabled,
        setMusicEnabled,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}