import { Button } from "@/components/ui/button";
import { useGame } from "@/contexts/GameContext";

export function LanguageSelector() {
  const { language, setLanguage } = useGame();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setLanguage(language === 'greek' ? 'english' : 'greek')}
      className="bg-slate-700/50 dark:bg-slate-700/50 hover:bg-slate-600/50 dark:hover:bg-slate-600/50 border-slate-600 dark:border-slate-600 text-white"
      title={language === 'greek' ? 'Switch to English' : 'Αλλαγή σε Ελληνικά'}
    >
      {language === 'greek' ? '🇺🇸' : '🇬🇷'}
    </Button>
  );
}