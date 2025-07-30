import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle } from "lucide-react";
import { useGame } from "@/contexts/GameContext";
import { translations } from "@/translations";

export function InstructionsDialog() {
  const { language } = useGame();
  const t = translations[language];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="icon"
          className="bg-slate-700/50 dark:bg-slate-700/50 hover:bg-slate-600/50 dark:hover:bg-slate-600/50 border-slate-600 dark:border-slate-600 text-white"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-800 dark:bg-slate-800 border-slate-600 dark:border-slate-600 text-white max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">{t.instructions.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            <div>
              <h3 className="text-lg font-semibold text-accent mb-2">{t.instructions.objective}</h3>
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                {t.instructions.objectiveDesc}
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-primary mb-2">{t.instructions.players}</h3>
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                {t.instructions.playersDesc}
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-secondary mb-2">{t.instructions.gameFlow}</h3>
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">
                {t.instructions.gameFlowDesc}
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}