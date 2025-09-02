import React, { useState } from 'react';
import { generateScenario } from '../services/geminiService';
import type { Scenario, Lore } from '../types';
import Spinner from './Spinner';

interface ScenarioGeneratorProps {
  lore: Lore;
  onScenarioCreated: (scenario: Scenario) => void;
}

const ScenarioGenerator: React.FC<ScenarioGeneratorProps> = ({ lore, onScenarioCreated }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);

  // Character creation state
  const [characterName, setCharacterName] = useState('');
  const [characterConcept, setCharacterConcept] = useState('');

  const handleGenerateClick = async () => {
    setIsLoading(true);
    setError(null);
    setScenario(null);
    try {
      const newScenario = await generateScenario(lore, { 
        name: characterName, 
        concept: characterConcept 
      });
      setScenario(newScenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderCharacterCreator = () => (
    <>
      <p className="text-lg text-gray-300 mb-6 max-w-2xl">
        Now, let's create your hero. Define their name and a hint of their past.
      </p>

      <div className="w-full max-w-xl space-y-4 mb-6">
        <div>
            <label htmlFor="char-name" className="block text-left font-bold text-purple-300 mb-1">Name (Optional)</label>
            <input
                id="char-name"
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="Leave blank for a surprise"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isLoading}
            />
        </div>
        <div>
            <label htmlFor="character-concept" className="block text-left font-bold text-purple-300 mb-1">Character Concept (Optional)</label>
            <textarea
                id="character-concept"
                value={characterConcept}
                onChange={(e) => setCharacterConcept(e.target.value)}
                placeholder="e.g., A loyal Royal Guard, a curious mage's apprentice, a grizzled dragon hunter"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isLoading}
                rows={2}
            />
        </div>
      </div>

      <button
        onClick={handleGenerateClick}
        disabled={isLoading}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-xl transition-all duration-300 ease-in-out shadow-lg hover:shadow-purple-500/50"
      >
        {isLoading ? <Spinner /> : 'Generate Character & Quest'}
      </button>
    </>
  );

  const renderScenarioDisplay = () => (
    <div className="mt-8 text-left animate-fade-in w-full">
      <h2 className="text-3xl font-title text-purple-300 mb-4 text-center">A New Legend is Born</h2>
      <div className="grid md:grid-cols-2 gap-6 bg-gray-900/50 p-6 rounded-lg border border-gray-700">
        <div>
          <h3 className="text-xl font-bold text-purple-400 border-b border-purple-800 pb-2 mb-2">Character</h3>
          <p><strong>Name:</strong> {scenario!.character.name}</p>
          <p><strong>Level:</strong> {scenario!.character.level}</p>
          <p className="mt-2 text-gray-400">{scenario!.character.backstory}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                    <p className="font-bold text-lg text-red-400" title="Health">{scenario!.character.health}/{scenario!.character.maxHealth}</p>
                    <p className="text-xs text-gray-400">HEALTH</p>
                </div>
                <div>
                    <p className="font-bold text-lg text-blue-400" title="Mana">{scenario!.character.mana}/{scenario!.character.maxMana}</p>
                    <p className="text-xs text-gray-400">MANA</p>
                </div>
                <div>
                    <p className="font-bold text-lg text-green-400" title="Stamina">{scenario!.character.stamina}/{scenario!.character.maxStamina}</p>
                    <p className="text-xs text-gray-400">STAMINA</p>
                </div>
            </div>
        </div>
        <div>
          <h3 className="text-xl font-bold text-purple-400 border-b border-purple-800 pb-2 mb-2">Starting Point</h3>
          <p><strong>Location:</strong> {scenario!.setting.name}</p>
          <p className="mt-2 text-gray-400">{scenario!.setting.description}</p>
        </div>
        <div className="md:col-span-2">
          <h3 className="text-xl font-bold text-purple-400 border-b border-purple-800 pb-2 mb-2">Your Goal</h3>
          <p className="text-gray-300">{scenario!.goal}</p>
        </div>
        <div className="md:col-span-2">
          <h3 className="text-xl font-bold text-purple-400 border-b border-purple-800 pb-2 mb-2">First Step</h3>
          <p className="text-gray-300">{scenario!.objective}</p>
        </div>
      </div>
      <div className="text-center mt-8">
        <button
          onClick={() => onScenarioCreated(scenario!)}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-all duration-300 ease-in-out shadow-lg hover:shadow-green-500/50"
        >
          Begin Adventure
        </button>
      </div>
    </div>
  );

  return (
    <div className="text-center flex flex-col items-center">
      <div className="mb-6 bg-gray-900/30 p-4 rounded-lg border border-gray-700 w-full max-w-3xl">
          <h2 className="text-xl font-bold text-purple-300">World: {lore.worldName}</h2>
          <p className="text-sm text-gray-400 mt-1 italic">{lore.coreConcept}</p>
      </div>

      {!scenario ? renderCharacterCreator() : renderScenarioDisplay()}

      {error && <p className="text-red-400 mt-4">{error}</p>}
    </div>
  );
};

export default ScenarioGenerator;