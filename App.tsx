import React, { useState } from 'react';
import type { Scenario, Lore } from './types';
import { GamePhase } from './types';
import ScenarioGenerator from './components/ScenarioGenerator';
import GameScreen from './components/GameScreen';
import LoreGenerator from './components/LoreGenerator';

const App: React.FC = () => {
  const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.LORE_CREATION);
  const [lore, setLore] = useState<Lore | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);

  const handleLoreCreated = (newLore: Lore) => {
    setLore(newLore);
    setGamePhase(GamePhase.SCENARIO_CREATION);
  };

  const handleScenarioCreated = (newScenario: Scenario) => {
    setScenario(newScenario);
    setGamePhase(GamePhase.GAMEPLAY);
  };

  const handlePlayAgain = () => {
    setScenario(null);
    setLore(null);
    setGamePhase(GamePhase.LORE_CREATION);
  };

  const renderContent = () => {
    switch (gamePhase) {
      case GamePhase.LORE_CREATION:
        return <LoreGenerator onLoreCreated={handleLoreCreated} />;
      case GamePhase.SCENARIO_CREATION:
        return lore ? <ScenarioGenerator lore={lore} onScenarioCreated={handleScenarioCreated} /> : <LoreGenerator onLoreCreated={handleLoreCreated} />;
      case GamePhase.GAMEPLAY:
        return (scenario && lore) ? <GameScreen lore={lore} scenario={scenario} onPlayAgain={handlePlayAgain} /> : <LoreGenerator onLoreCreated={handleLoreCreated} />;
      default:
        return <div>Error: Unknown game phase.</div>;
    }
  };

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen w-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-title text-purple-400">Gemini's Grimoire</h1>
          <p className="text-gray-400 mt-2">An AI-Powered Text Adventure</p>
        </header>
        <main className="bg-gray-800 bg-opacity-40 border border-purple-800 rounded-lg shadow-2xl shadow-purple-900/20 p-4 md:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
