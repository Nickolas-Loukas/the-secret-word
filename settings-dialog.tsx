import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Volume2, VolumeX, Sun, Moon } from "lucide-react";
import { useGame } from "@/contexts/GameContext";
import { translations } from "@/translations";

export function SettingsDialog() {
  const { language, theme, setTheme, musicEnabled, setMusicEnabled } = useGame();
  const t = translations[language];

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    // Apply theme to document
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className="bg-slate-700/50 dark:bg-slate-700/50 hover:bg-slate-600/50 dark:hover:bg-slate-600/50 border-slate-600 dark:border-slate-600 text-white"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 dark:bg-slate-800 border-slate-600 dark:border-slate-600 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">{t.settings}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          {/* Music Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {musicEnabled ? (
                <Volume2 className="h-5 w-5 text-accent" />
              ) : (
                <VolumeX className="h-5 w-5 text-slate-400" />
              )}
              <Label htmlFor="music" className="text-white">{t.music}</Label>
            </div>
            <Switch
              id="music"
              checked={musicEnabled}
              onCheckedChange={setMusicEnabled}
            />
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {theme === 'dark' ? (
                <Moon className="h-5 w-5 text-primary" />
              ) : (
                <Sun className="h-5 w-5 text-yellow-500" />
              )}
              <Label htmlFor="theme" className="text-white">{t.theme}</Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="bg-slate-700/50 dark:bg-slate-700/50 border-slate-600 dark:border-slate-600 text-white hover:bg-slate-600/50 dark:hover:bg-slate-600/50"
            >
              {theme === 'dark' ? t.lightTheme : t.darkTheme}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}