import React, { useState, useEffect, useRef } from 'react';
import type { Scenario, GameState, StoryEntry, Lore, GeminiResponse, Character, Item, ItemRarity, Faction, Objective } from '../types';
import { getNextStepStream, generateImage } from '../services/geminiService';
import Spinner from './Spinner';

interface GameScreenProps {
  lore: Lore;
  scenario: Scenario;
  onPlayAgain: () => void;
}

type Tab = 'Story' | 'Character' | 'Journal' | 'World';

const rarityColorClasses: Record<ItemRarity, string> = {
    Common: 'text-gray-400',
    Uncommon: 'text-white',
    Rare: 'text-blue-400',
    Epic: 'text-purple-400',
    Legendary: 'text-yellow-400',
};

// Component for rendering text with interactive tooltips for lore keywords
const InteractiveText: React.FC<{
    text: string;
    lore: Lore;
    onShowTooltip: (content: React.ReactNode, e: React.MouseEvent) => void;
    onHideTooltip: () => void;
}> = ({ text, lore, onShowTooltip, onHideTooltip }) => {
    const keywords = [
        ...lore.locations.map(l => ({ name: l.name, description: l.description, type: 'Location', color: 'text-green-400' })),
        ...lore.characters.map(c => ({ name: c.name, description: c.description, type: 'Character', color: 'text-yellow-400' })),
        ...lore.factions.map(f => ({ name: f.name, description: f.description, type: 'Faction', color: 'text-purple-400' })),
        ...lore.races.map(r => ({ name: r.name, description: r.description, type: 'Race', color: 'text-orange-400' })),
        ...lore.creatures.map(c => ({ name: c.name, description: c.description, type: 'Creature', color: 'text-red-400' })),
        ...lore.historicalFigures.map(h => ({ name: h.name, description: h.description, type: 'Historical Figure', color: 'text-cyan-400' })),
    ];

    if (!keywords.length || !text) {
        return <p className="whitespace-pre-wrap inline">{text}</p>;
    }
    
    // Sort keywords by length descending to match longer names first (e.g., "The Dark Forest" before "Dark")
    keywords.sort((a, b) => b.name.length - a.name.length);

    const regex = new RegExp(`\\b(${keywords.map(k => k.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`, 'gi');
    const parts = text.split(regex);

    return (
        <p className="whitespace-pre-wrap inline">
            {parts.map((part, index) => {
                const lowerCasePart = part.toLowerCase();
                const keyword = keywords.find(k => k.name.toLowerCase() === lowerCasePart);

                if (keyword) {
                     const tooltipContent = (
                        <div className="w-72">
                            <div className="flex justify-between items-baseline border-b border-gray-700 pb-1 mb-2">
                                <h5 className={`font-bold ${keyword.color}`}>{keyword.name}</h5>
                                <span className="text-xs text-gray-500">{keyword.type}</span>
                            </div>
                            <p className="text-sm text-gray-400 italic">{keyword.description}</p>
                        </div>
                    );
                    return (
                        <span
                            key={index}
                            className={`${keyword.color} font-bold cursor-pointer`}
                            onMouseMove={(e) => onShowTooltip(tooltipContent, e)}
                            onMouseLeave={onHideTooltip}
                        >
                            {part}
                        </span>
                    );
                }
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </p>
    );
};


const GameScreen: React.FC<GameScreenProps> = ({ lore, scenario, onPlayAgain }) => {
  const [gameState, setGameState] = useState<GameState>({
    lore: lore,
    scenario: scenario,
    currentLocation: scenario.setting.name,
    inventory: [],
    storyLog: [{ type: 'narrator', text: scenario.setting.description }],
    objective: scenario.objective,
    quests: [],
    isGameOver: false,
    gameOverMessage: '',
  });

  const [playerInput, setPlayerInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [proposedUpdate, setProposedUpdate] = useState<GeminiResponse['loreUpdate'] | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Story');
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [xpGainAnnouncements, setXpGainAnnouncements] = useState<{ id: number; amount: number }[]>([]);
  const [questNotifications, setQuestNotifications] = useState<{ id: number; text: string; type: 'new' | 'update' }[]>([]);
  const [tooltipData, setTooltipData] = useState<{ content: React.ReactNode; x: number; y: number } | null>(null);
  
  const storyLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'Story' && storyLogRef.current) {
      storyLogRef.current.scrollTop = storyLogRef.current.scrollHeight;
    }
  }, [gameState.storyLog, proposedUpdate, activeTab]);
  
  useEffect(() => {
    const generateInitialImage = async () => {
        if (!scenario.setting.description) return;
        
        const placeholderEntry: StoryEntry = { type: 'narrator', text: '', imageIsLoading: true };
        setGameState(prev => ({ ...prev, storyLog: [...prev.storyLog, placeholderEntry] }));

        try {
            const imageUrl = await generateImage(scenario.setting.description, scenario.character, scenario.setting.name, lore);
            setGameState(prev => ({
                ...prev,
                storyLog: prev.storyLog.map(entry => 
                    entry.imageIsLoading ? { ...entry, imageIsLoading: false, imageUrl } : entry
                )
            }));
        } catch (err) {
            console.error("Failed to generate initial image:", err);
            setGameState(prev => ({
                ...prev,
                storyLog: prev.storyLog.filter(entry => !entry.imageIsLoading)
            }));
        }
    };
    generateInitialImage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, lore]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayerInput(e.target.value);
  };
  
  const handleAcceptUpdate = () => {
    if (!proposedUpdate) return;
    
    setGameState(prev => {
        const newLore = {...prev.lore};
        switch(proposedUpdate.type) {
            case 'location':
                if (!newLore.locations.some(l => l.name === proposedUpdate.name)) {
                  newLore.locations = [...newLore.locations, { name: proposedUpdate.name, description: proposedUpdate.description }];
                }
                break;
            case 'character':
                 if (!newLore.characters.some(c => c.name === proposedUpdate.name)) {
                    newLore.characters = [...newLore.characters, { name: proposedUpdate.name, description: proposedUpdate.description }];
                 }
                break;
            case 'knowledge':
                const newKnowledge = `${proposedUpdate.name}: ${proposedUpdate.description}`;
                if (!newLore.knowledge.includes(newKnowledge)) {
                    newLore.knowledge = [...newLore.knowledge, newKnowledge];
                }
                break;
        }
        return { ...prev, lore: newLore };
    });

    setProposedUpdate(null);
  };

  const handleRejectUpdate = () => {
    setProposedUpdate(null);
  };

  const executeAction = async (action: string) => {
    if (!action.trim() || isLoading || gameState.isGameOver || proposedUpdate || isLevelingUp) return;

    const newPlayerEntry: StoryEntry = { type: 'player', text: action };
    
    const narratorEntryIndex = gameState.storyLog.length + 1;
    setGameState(prev => ({
      ...prev,
      storyLog: [...prev.storyLog, newPlayerEntry, { type: 'narrator', text: '' }]
    }));
    setPlayerInput('');
    setIsLoading(true);

    let accumulatedJson = '';
    try {
      const stream = await getNextStepStream({ ...gameState, storyLog: [...gameState.storyLog, newPlayerEntry] }, newPlayerEntry.text);

      for await (const chunk of stream) {
        accumulatedJson += chunk.text;
        const narrativeMatch = accumulatedJson.match(/"narrative"\s*:\s*"((?:\\.|[^"\\])*)"/);
        if (narrativeMatch && narrativeMatch[1]) {
          try {
            const narrativeText = JSON.parse(`"${narrativeMatch[1]}"`);
            setGameState(prev => {
              const updatedLog = [...prev.storyLog];
              if (updatedLog[narratorEntryIndex]) {
                 updatedLog[narratorEntryIndex] = { ...updatedLog[narratorEntryIndex], text: narrativeText };
              }
              return { ...prev, storyLog: updatedLog };
            });
          } catch (e) {
              // Ignore parse errors on incomplete stream
          }
        }
      }

      const response: GeminiResponse = JSON.parse(accumulatedJson);

      const showQuestNotification = (text: string, type: 'new' | 'update') => {
        const newNotification = { id: Date.now(), text, type };
        setQuestNotifications(notifications => [...notifications, newNotification]);
        setTimeout(() => {
            setQuestNotifications(notifications => notifications.filter(n => n.id !== newNotification.id));
        }, 4000);
      };

      if (response.newQuest) {
          showQuestNotification(`New Quest: ${response.newQuest.title}`, 'new');
      }
      if (response.questUpdate) {
          showQuestNotification(`Quest Updated: ${response.questUpdate.questTitle}`, 'update');
      }

      setGameState(prev => {
        const finalLog = [...prev.storyLog];
        finalLog[narratorEntryIndex] = { type: 'narrator', text: response.narrative };
        
        if (response.dialogue) {
            response.dialogue.forEach(d => {
                finalLog.push({ type: 'narrator', text: d.text, characterName: d.characterName });
            });
        }

        let updatedQuests = prev.quests;
        if (response.newQuest) {
            updatedQuests = [...updatedQuests, response.newQuest];
        }
        if (response.questUpdate) {
            const { questTitle, objectiveText, newStatus } = response.questUpdate;

            const updateObjectivesRecursively = (objectives: Objective[], text: string): Objective[] => {
                return objectives.map(o => {
                    if (o.text === text) {
                        return { ...o, isCompleted: true };
                    }
                    if (o.subObjectives) {
                        const newSubObjectives = updateObjectivesRecursively(o.subObjectives, text);
                        // A sub-objective might have been updated. Check if the parent is now complete.
                        // This check is important: it only marks the parent complete IF a change happened below.
                        const wasChanged = JSON.stringify(newSubObjectives) !== JSON.stringify(o.subObjectives);
                        if (wasChanged) {
                            const allSubsComplete = newSubObjectives.every(sub => sub.isCompleted);
                            return { ...o, subObjectives: newSubObjectives, isCompleted: allSubsComplete };
                        }
                    }
                    return o;
                });
            };
        
            const areAllObjectivesComplete = (objectives: Objective[]): boolean => {
                return objectives.every(obj => obj.isCompleted && (!obj.subObjectives || areAllObjectivesComplete(obj.subObjectives)));
            };

            updatedQuests = updatedQuests.map(q => {
                if (q.title === questTitle) {
                    const updatedObjectives = updateObjectivesRecursively(q.objectives, objectiveText);
                    const allComplete = areAllObjectivesComplete(updatedObjectives);
                    const finalStatus = newStatus ? newStatus : (allComplete ? 'completed' : q.status);
                    return { ...q, objectives: updatedObjectives, status: finalStatus };
                }
                return q;
            });
        }

        const updatedCharacter = { ...prev.scenario.character };
        if (response.characterUpdate) {
          if (response.characterUpdate.health !== undefined) updatedCharacter.health = response.characterUpdate.health;
          if (response.characterUpdate.mana !== undefined) updatedCharacter.mana = response.characterUpdate.mana;
          if (response.characterUpdate.stamina !== undefined) updatedCharacter.stamina = response.characterUpdate.stamina;
        }

        if (response.characterUpdate?.xpGained) {
            const xpGained = response.characterUpdate.xpGained;
            const newXp = updatedCharacter.xp + xpGained;
            
            const newAnnouncement = { id: Date.now(), amount: xpGained };
            setXpGainAnnouncements(announcements => [...announcements, newAnnouncement]);
            setTimeout(() => {
                setXpGainAnnouncements(announcements => announcements.filter(a => a.id !== newAnnouncement.id));
            }, 2000);

            if (newXp >= updatedCharacter.xpToNextLevel) {
                setIsLevelingUp(true);
            }
            updatedCharacter.xp = newXp;
        }

        return {
          ...prev,
          storyLog: finalLog,
          currentLocation: response.newLocation,
          inventory: response.updatedInventory,
          objective: response.newObjective,
          quests: updatedQuests,
          isGameOver: response.isGameOver,
          gameOverMessage: response.gameOverMessage,
          scenario: { ...prev.scenario, character: updatedCharacter },
        };
      });
      
      if (response.loreUpdate) {
        setProposedUpdate(response.loreUpdate);
      }

      if (response.requestImageGeneration && !response.isGameOver) {
        const placeholderEntry: StoryEntry = { type: 'narrator', text: '', imageIsLoading: true };
        setGameState(prev => ({ ...prev, storyLog: [...prev.storyLog, placeholderEntry] }));
        
        generateImage(response.narrative, gameState.scenario.character, response.newLocation, gameState.lore)
          .then(imageUrl => {
            setGameState(prev => ({
              ...prev,
              storyLog: prev.storyLog.map(entry => entry.imageIsLoading ? { ...entry, imageIsLoading: false, imageUrl } : entry)
            }));
          })
          .catch(imgErr => {
            console.error("Failed to generate scene image:", imgErr);
            setGameState(prev => ({ ...prev, storyLog: prev.storyLog.filter(entry => !entry.imageIsLoading) }));
          });
      }

    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'An unknown error occurred.';
      setGameState(prev => {
        const updatedLog = [...prev.storyLog];
        if(updatedLog[narratorEntryIndex]) {
            updatedLog[narratorEntryIndex] = { type: 'narrator', text: errorText };
        }
        return { ...prev, storyLog: updatedLog };
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeAction(playerInput);
  };

  const handleUseItem = (item: Item) => {
    if (!item.usable || isLoading || gameState.isGameOver || proposedUpdate || isLevelingUp) return;
    executeAction(`use "${item.name}"`);
  };

  const handleLevelUpConfirm = (statIncreases: { maxHealth: number; maxMana: number; maxStamina: number }) => {
    setGameState(prev => {
        const char = prev.scenario.character;
        const newMaxHealth = char.maxHealth + statIncreases.maxHealth;
        const newMaxMana = char.maxMana + statIncreases.maxMana;
        const newMaxStamina = char.maxStamina + statIncreases.maxStamina;

        const updatedCharacter: Character = {
            ...char,
            level: char.level + 1,
            xp: char.xp - char.xpToNextLevel,
            xpToNextLevel: Math.floor(char.xpToNextLevel * 1.5),
            maxHealth: newMaxHealth,
            maxMana: newMaxMana,
            maxStamina: newMaxStamina,
            health: newMaxHealth, // Restore to new max
            mana: newMaxMana,
            stamina: newMaxStamina,
        };
        
        return {
            ...prev,
            scenario: { ...prev.scenario, character: updatedCharacter }
        };
    });
    setIsLevelingUp(false);
  };

  const handleShowTooltip = (content: React.ReactNode, e: React.MouseEvent) => {
    setTooltipData({ content, x: e.clientX, y: e.clientY });
  };
  
  const handleHideTooltip = () => {
      setTooltipData(null);
  };

  const TabButton: React.FC<{ label: Tab }> = ({ label }) => (
    <button
      onClick={() => setActiveTab(label)}
      className={`px-4 py-2 text-lg font-title transition-colors duration-200 focus:outline-none ${
        activeTab === label
          ? 'text-purple-300 border-b-2 border-purple-400'
          : 'text-gray-500 hover:text-purple-400'
      }`}
    >
      {label}
    </button>
  );

  const StatBar: React.FC<{ label: string; value: number; maxValue: number; colorClass: string; }> = ({ label, value, maxValue, colorClass }) => {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <h4 className="font-bold text-base text-purple-300">{label}</h4>
                <span className="text-sm font-semibold text-gray-300">{value} / {maxValue}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className={`${colorClass} h-2.5 rounded-full transition-all duration-500 ease-in-out`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
  };
  
  const XpBar: React.FC<{ xp: number; xpToNextLevel: number; level: number;}> = ({ xp, xpToNextLevel, level }) => {
    const percentage = xpToNextLevel > 0 ? (xp / xpToNextLevel) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <h4 className="font-bold text-base text-purple-300">Level {level}</h4>
                <span className="text-sm font-semibold text-gray-300">{xp} / {xpToNextLevel} XP</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div className="bg-yellow-400 h-2.5 rounded-full transition-all duration-500 ease-in-out" style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
  };

  const LevelUpModal: React.FC<{
    character: Character;
    onConfirm: (statIncreases: { maxHealth: number; maxMana: number; maxStamina: number }) => void;
  }> = ({ character, onConfirm }) => {
      const [points, setPoints] = useState(10);
      const [healthInc, setHealthInc] = useState(0);
      const [manaInc, setManaInc] = useState(0);
      const [staminaInc, setStaminaInc] = useState(0);

      const handleIncrease = (stat: 'health' | 'mana' | 'stamina') => {
          if (points > 0) {
              setPoints(p => p - 1);
              if (stat === 'health') setHealthInc(v => v + 5);
              if (stat === 'mana') setManaInc(v => v + 5);
              if (stat === 'stamina') setStaminaInc(v => v + 5);
          }
      };

      const handleConfirm = () => {
          onConfirm({ maxHealth: healthInc, maxMana: manaInc, maxStamina: staminaInc });
      };

      return (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in">
              <div className="bg-gray-800 border-2 border-yellow-400 rounded-lg p-6 md:p-8 shadow-2xl shadow-yellow-500/20 text-center max-w-lg w-full m-4">
                  <h2 className="text-4xl font-title text-yellow-300">Level Up!</h2>
                  <p className="text-gray-300 mt-2">Congratulations, {character.name}! You have reached Level {character.level + 1}.</p>
                  <p className="font-bold text-xl text-white my-4">You have <span className="text-yellow-400">{points}</span> points to spend.</p>

                  <div className="space-y-4 text-left">
                      <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                          <div>
                              <p className="font-bold text-lg text-red-400">Max Health</p>
                              <p className="text-sm text-gray-400">{character.maxHealth} <span className="text-green-400 font-semibold">{healthInc > 0 && `+ ${healthInc}`}</span></p>
                          </div>
                          <button onClick={() => handleIncrease('health')} disabled={points === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold w-8 h-8 rounded-full text-xl transition-all duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center">+</button>
                      </div>
                       <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                          <div>
                              <p className="font-bold text-lg text-blue-400">Max Mana</p>
                              <p className="text-sm text-gray-400">{character.maxMana} <span className="text-green-400 font-semibold">{manaInc > 0 && `+ ${manaInc}`}</span></p>
                          </div>
                          <button onClick={() => handleIncrease('mana')} disabled={points === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold w-8 h-8 rounded-full text-xl transition-all duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center">+</button>
                      </div>
                       <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg">
                          <div>
                              <p className="font-bold text-lg text-green-400">Max Stamina</p>
                              <p className="text-sm text-gray-400">{character.maxStamina} <span className="text-green-400 font-semibold">{staminaInc > 0 && `+ ${staminaInc}`}</span></p>
                          </div>
                          <button onClick={() => handleIncrease('stamina')} disabled={points === 0} className="bg-green-600 hover:bg-green-700 text-white font-bold w-8 h-8 rounded-full text-xl transition-all duration-300 ease-in-out disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center">+</button>
                      </div>
                  </div>

                  <button onClick={handleConfirm} disabled={points > 0} className="mt-8 w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-gray-900 font-bold py-3 px-8 rounded-lg text-xl transition-all duration-300 ease-in-out">
                      {points > 0 ? `Confirm (${points} points remaining)` : 'Confirm'}
                  </button>
              </div>
          </div>
      );
  };

  const renderStoryTab = () => (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      <div className="flex-grow md:w-2/3 flex flex-col bg-gray-900/50 p-4 rounded-lg border border-gray-700">
        <div ref={storyLogRef} className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
          {gameState.storyLog.map((entry, index) => (
             <div key={index} className="mb-4 animate-fade-in">
                {entry.text && (
                  <>
                    {entry.type === 'player' ? (
                      <div className="text-cyan-300">
                        <span className="font-bold mr-2">&gt;</span>
                        <p className="whitespace-pre-wrap inline">{entry.text}</p>
                      </div>
                    ) : entry.characterName ? (
                      <div className="text-yellow-200 italic my-2 p-2 bg-yellow-900/20 border-l-4 border-yellow-500">
                        <strong className="text-yellow-400 not-italic mr-2">{entry.characterName}:</strong>
                        <span className="whitespace-pre-wrap inline">"<InteractiveText text={entry.text} lore={gameState.lore} onShowTooltip={handleShowTooltip} onHideTooltip={handleHideTooltip} />"</span>
                      </div>
                    ) : (
                      <div className="text-gray-300">
                        <InteractiveText text={entry.text} lore={gameState.lore} onShowTooltip={handleShowTooltip} onHideTooltip={handleHideTooltip} />
                      </div>
                    )}
                  </>
                )}
              {entry.imageIsLoading && (
                  <div className="flex items-center justify-center my-4 p-4 bg-gray-950 rounded-lg border border-gray-700">
                      <Spinner />
                      <p className="text-gray-400 text-sm ml-3">Conjuring a vision...</p>
                  </div>
              )}
              {entry.imageUrl && (
                  <div className="my-4">
                      <img src={entry.imageUrl} alt="A high-fantasy scene based on the story." className="w-full max-w-lg mx-auto h-auto object-cover rounded-lg border-2 border-purple-800/50" />
                  </div>
              )}
            </div>
          ))}
          {gameState.isGameOver && (
              <div className="my-4 p-4 border-2 border-yellow-400 bg-yellow-900/50 rounded-lg text-center animate-fade-in">
                  <p className="text-yellow-200 text-lg font-bold">{gameState.gameOverMessage}</p>
                  <button onClick={onPlayAgain} className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition-colors">
                      Play Again
                  </button>
              </div>
          )}
        </div>
        
        {proposedUpdate && !isLoading && (
            <div className="my-2 p-3 border-2 border-green-500 bg-green-900/50 rounded-lg text-center animate-fade-in">
                <h4 className="font-bold text-green-300">New Discovery!</h4>
                <p className="text-sm text-gray-300 my-1">
                    <span className="capitalize font-semibold">{proposedUpdate.type}:</span> {proposedUpdate.name} - <span className="italic">"{proposedUpdate.description}"</span>
                </p>
                <div className="mt-2">
                    <button onClick={handleAcceptUpdate} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm mr-2 transition-colors">
                        Add to Lore
                    </button>
                    <button onClick={handleRejectUpdate} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded text-sm transition-colors">
                        Ignore
                    </button>
                </div>
            </div>
        )}

        <div className="mt-auto pt-4 border-t border-gray-700">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center bg-gray-900 rounded-lg">
                <span className="text-cyan-300 text-2xl pl-3">&gt;</span>
                <input
                    type="text"
                    value={playerInput}
                    onChange={handleInputChange}
                    placeholder={isLevelingUp ? "Level up your character!" : gameState.isGameOver ? "The story has ended." : proposedUpdate ? "Respond to the discovery..." : "What do you do next?"}
                    disabled={isLoading || gameState.isGameOver || isLevelingUp}
                    className="w-full bg-transparent p-3 text-gray-200 placeholder-gray-500 focus:outline-none"
                    aria-label="Player action input"
                />
                 {isLoading && <div className="p-2"><Spinner /></div>}
            </div>
          </form>
        </div>
      </div>

      <div className="md:w-1/3 bg-gray-900/50 p-6 rounded-lg border border-gray-700 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        <div>
            <h3 className="text-2xl font-title text-purple-400 mb-2">{scenario.character.name}</h3>
            <p className="text-gray-400">Level {gameState.scenario.character.level}</p>
        </div>
        <div className="space-y-3">
            <StatBar label="Health" value={gameState.scenario.character.health} maxValue={gameState.scenario.character.maxHealth} colorClass="bg-red-500" />
            <StatBar label="Mana" value={gameState.scenario.character.mana} maxValue={gameState.scenario.character.maxMana} colorClass="bg-blue-500" />
            <StatBar label="Stamina" value={gameState.scenario.character.stamina} maxValue={gameState.scenario.character.maxStamina} colorClass="bg-green-500" />
        </div>
        <div className="border-t border-gray-700 pt-4">
            <XpBar xp={gameState.scenario.character.xp} xpToNextLevel={gameState.scenario.character.xpToNextLevel} level={gameState.scenario.character.level} />
        </div>
        <div className="border-t border-gray-700 pt-4">
            <h4 className="font-bold text-lg text-purple-300 mb-2">Location</h4>
            <p>{gameState.currentLocation}</p>
        </div>
        <div className="border-t border-gray-700 pt-4">
            <h4 className="font-bold text-lg text-purple-300 mb-2">Objective</h4>
            <p className="text-gray-400">{gameState.objective}</p>
        </div>
        <div className="border-t border-gray-700 pt-4">
            <h4 className="font-bold text-lg text-purple-300 mb-2">Inventory</h4>
            {gameState.inventory.length > 0 ? (
                 <ul className="space-y-2">
                    {gameState.inventory.map((item, i) => (
                        <li key={i} className="group relative flex justify-between items-center text-gray-300">
                            <span className={rarityColorClasses[item.rarity]}>{item.name}</span>
                            {item.usable && (
                                <button 
                                    onClick={() => handleUseItem(item)}
                                    disabled={isLoading || gameState.isGameOver || isLevelingUp}
                                    className="text-xs bg-purple-800 hover:bg-purple-700 text-purple-200 px-2 py-1 rounded disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                                >
                                    Use
                                </button>
                            )}
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-950 border border-purple-800 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                <div className="flex justify-between items-baseline border-b border-gray-700 pb-1 mb-2">
                                    <h5 className={`font-bold ${rarityColorClasses[item.rarity]}`}>{item.name}</h5>
                                    <span className="text-xs text-gray-500">{item.rarity}</span>
                                </div>
                                <p className="text-sm text-gray-400 italic mb-2">{item.description}</p>
                                {item.effects.length > 0 && (
                                    <div>
                                        {item.effects.map((effect, idx) => (
                                            <p key={idx} className="text-sm text-green-400">
                                                {`Restores ${effect.value} ${effect.stat}`}
                                            </p>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-600 mt-2">{item.type}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-gray-500 italic">Your pockets are empty.</p>
            )}
        </div>
      </div>
    </div>
  );

  const renderCharacterTab = () => (
    <div className="p-4 md:p-6 bg-gray-900/50 rounded-lg border border-gray-700 h-full overflow-y-auto custom-scrollbar animate-fade-in">
        <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8 p-4 bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border-2 border-purple-800 shadow-lg shadow-purple-900/20">
                <h2 className="text-4xl md:text-5xl font-title text-purple-300 tracking-wider">{scenario.character.name}</h2>
                <p className="text-xl text-purple-400 mt-2 font-semibold">Level {gameState.scenario.character.level}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatBar label="Health" value={gameState.scenario.character.health} maxValue={gameState.scenario.character.maxHealth} colorClass="bg-red-500" />
                <StatBar label="Mana" value={gameState.scenario.character.mana} maxValue={gameState.scenario.character.maxMana} colorClass="bg-blue-500" />
                <StatBar label="Stamina" value={gameState.scenario.character.stamina} maxValue={gameState.scenario.character.maxStamina} colorClass="bg-green-500" />
            </div>
            
             <div className="mb-8">
                <XpBar xp={gameState.scenario.character.xp} xpToNextLevel={gameState.scenario.character.xpToNextLevel} level={gameState.scenario.character.level} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-gray-800/60 p-5 rounded-lg border border-gray-700">
                        <h3 className="text-xl font-bold text-purple-400 font-title border-b-2 border-purple-800/50 pb-2 mb-3">Backstory</h3>
                        <p className="text-gray-300 italic leading-relaxed text-opacity-90">{scenario.character.backstory}</p>
                    </div>
                    <div className="bg-gray-800/60 p-5 rounded-lg border border-gray-700">
                        <h3 className="text-xl font-bold text-purple-400 font-title border-b-2 border-purple-800/50 pb-2 mb-3">Main Goal</h3>
                        <p className="text-gray-200 leading-relaxed">{scenario.goal}</p>
                    </div>
                    <div className="bg-gray-800/60 p-5 rounded-lg border border-gray-700">
                        <h3 className="text-xl font-bold text-purple-400 font-title border-b-2 border-purple-800/50 pb-2 mb-3">Current Objective</h3>
                        <p className="text-gray-300 leading-relaxed">{gameState.objective}</p>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="bg-gray-800/60 p-5 rounded-lg border border-gray-700 sticky top-4">
                        <h3 className="text-xl font-bold text-purple-400 font-title border-b-2 border-purple-800/50 pb-2 mb-4">Inventory</h3>
                        {gameState.inventory.length > 0 ? (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                                {gameState.inventory.map((item, i) => (
                                    <li key={i} className="group relative bg-gray-900/70 border border-gray-700 rounded-md px-3 py-2 hover:bg-purple-900/50 hover:border-purple-700 transition-all duration-200 flex justify-between items-center">
                                        <span className={rarityColorClasses[item.rarity]}>{item.name}</span>
                                        {item.usable && (
                                            <button 
                                                onClick={() => handleUseItem(item)}
                                                disabled={isLoading || gameState.isGameOver || isLevelingUp}
                                                className="text-xs bg-purple-800 hover:bg-purple-700 text-purple-200 px-2 py-1 rounded disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Use
                                            </button>
                                        )}
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-950 border border-purple-800 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                                            <div className="flex justify-between items-baseline border-b border-gray-700 pb-1 mb-2">
                                                <h5 className={`font-bold ${rarityColorClasses[item.rarity]}`}>{item.name}</h5>
                                                <span className="text-xs text-gray-500">{item.rarity}</span>
                                            </div>
                                            <p className="text-sm text-gray-400 italic mb-2">{item.description}</p>
                                            {item.effects.length > 0 && (
                                                <div>
                                                    {item.effects.map((effect, idx) => (
                                                        <p key={idx} className="text-sm text-green-400">
                                                            {`Restores ${effect.value} ${effect.stat}`}
                                                        </p>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-600 mt-2">{item.type}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-gray-500 italic">Your pockets are empty.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const renderJournalTab = () => {
    const ObjectiveList: React.FC<{ objectives: Objective[]; isSubList?: boolean }> = ({ objectives, isSubList = false }) => (
        <ul className={`space-y-2 ${isSubList ? 'pl-5 border-l-2 border-gray-700 ml-4 pt-2' : ''}`}>
            {objectives.map((obj, i) => (
                <li key={i}>
                    <div className={`flex items-start ${obj.isCompleted ? 'text-gray-500' : 'text-gray-300'}`}>
                        <span className={`mr-3 mt-1 ${obj.isCompleted ? 'text-green-400' : 'text-gray-500'}`}>
                            {obj.isCompleted ? '✓' : '○'}
                        </span>
                        <p className={obj.isCompleted ? 'line-through' : ''}>{obj.text}</p>
                    </div>
                    {obj.subObjectives && obj.subObjectives.length > 0 && (
                        <ObjectiveList objectives={obj.subObjectives} isSubList={true} />
                    )}
                </li>
            ))}
        </ul>
    );

    return (
        <div className="p-4 md:p-6 bg-gray-900/50 rounded-lg border border-gray-700 h-full overflow-y-auto custom-scrollbar animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Main Quest */}
                <div className="bg-gray-800/60 p-5 rounded-lg border-2 border-purple-700 shadow-lg shadow-purple-900/20">
                    <h2 className="text-2xl font-title text-purple-300 tracking-wider">Main Quest</h2>
                    <h3 className="text-xl text-purple-400 mt-2 font-semibold">{scenario.goal}</h3>
                    <div className="mt-4 border-t border-purple-800/50 pt-4">
                        <h4 className="font-bold text-lg text-gray-200 mb-2">Current Objective</h4>
                        <div className="flex items-start">
                            <span className="text-cyan-400 mr-3 mt-1">&#9672;</span>
                            <p className="text-gray-300 leading-relaxed">{gameState.objective}</p>
                        </div>
                    </div>
                </div>

                {/* Side Quests */}
                <div>
                    <h2 className="text-2xl font-title text-purple-300 tracking-wider mb-4">Side Quests</h2>
                    {gameState.quests.length > 0 ? (
                        <div className="space-y-4">
                            {gameState.quests.map((quest, index) => (
                                <details key={index} className="bg-gray-800/40 p-4 rounded-lg border border-gray-700 transition-all duration-300 open:bg-gray-800/70" open>
                                    <summary className="font-bold text-lg text-purple-400 cursor-pointer list-none flex justify-between items-center">
                                        <span>{quest.title}</span>
                                        <span className={`text-xs font-mono px-2 py-1 rounded-full ${
                                            quest.status === 'active' ? 'bg-blue-900 text-blue-300' :
                                            quest.status === 'completed' ? 'bg-green-900 text-green-300' :
                                            'bg-red-900 text-red-300'
                                        }`}>
                                            {quest.status}
                                        </span>
                                    </summary>
                                    <p className="text-gray-400 mt-2 mb-4 italic">{quest.description}</p>
                                    <div className="border-t border-gray-600 pt-3">
                                        <ObjectiveList objectives={quest.objectives} />
                                    </div>
                                </details>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6 bg-gray-800/40 rounded-lg border border-dashed border-gray-700">
                            <p className="text-gray-500 italic">No active side quests.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


  const renderWorldTab = () => {
    const { lore: worldLore } = gameState;
    
    return (
     <div className="p-6 bg-gray-900/50 rounded-lg border border-gray-700 h-full overflow-y-auto custom-scrollbar animate-fade-in">
        <h2 className="text-3xl font-title text-purple-300 mb-2 text-center">The Chronicles of {worldLore.worldName}</h2>
        <p className="text-center text-gray-400 mb-6 italic">{worldLore.coreConcept}</p>

        <div className="space-y-4 max-w-5xl mx-auto">
            <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors" open>
                <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">World Timeline</summary>
                <div className="mt-4 border-l-2 border-purple-800 pl-4 space-y-4">
                    {worldLore.timeline.map((event, index) => (
                        <div key={index} className="relative">
                            <span className="absolute -left-[27px] top-1 h-4 w-4 rounded-full bg-purple-400 ring-4 ring-gray-800"></span>
                            <h4 className="font-semibold text-gray-200 text-lg">{event.era}</h4>
                            <p className="text-gray-400">{event.description}</p>
                        </div>
                    ))}
                </div>
            </details>

            <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors" open>
                <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">Cosmology</summary>
                <div className="mt-3 pl-2">
                    <h4 className="text-lg font-semibold text-purple-300">Creation Myth</h4>
                    <p className="text-gray-300 mt-1 mb-4 italic">{worldLore.cosmology.creationMyth}</p>
                    <h4 className="text-lg font-semibold text-purple-300">Deities</h4>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {worldLore.cosmology.deities.map(deity => (
                            <div key={deity.name} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                <h5 className="font-bold text-gray-200">{deity.name}</h5>
                                <p className="text-sm text-purple-400 mb-1">{deity.domain}</p>
                                <p className="text-sm text-gray-400">{deity.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </details>

            <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors" open>
              <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">Magic System: {worldLore.magicSystem.name}</summary>
              <div className="mt-3 pl-2">
                <p className="text-gray-300 italic mb-4">{worldLore.magicSystem.description}</p>
                 <h4 className="text-lg font-semibold text-purple-300">Fundamental Rules</h4>
                <ul className="list-disc list-inside mt-2 space-y-2 text-gray-400">
                    {worldLore.magicSystem.rules.map((rule, i) => <li key={i}>{rule}</li>)}
                </ul>
              </div>
            </details>

            <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors" open>
                <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">Inhabitants of {worldLore.worldName}</summary>
                <div className="mt-3 pl-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                         <h4 className="text-lg font-semibold text-purple-300 mb-2">Races</h4>
                         <div className="space-y-3">
                            {worldLore.races.map(race => (
                                <div key={race.name}>
                                    <h5 className="font-bold text-gray-200">{race.name}</h5>
                                    <p className="text-sm text-gray-400 mb-1">{race.description}</p>
                                    <p className="text-sm"><strong className="text-purple-400">Abilities:</strong> <span className="text-gray-400">{race.abilities}</span></p>
                                </div>
                            ))}
                         </div>
                    </div>
                     <div>
                         <h4 className="text-lg font-semibold text-purple-300 mb-2">Creatures</h4>
                         <div className="space-y-3">
                            {worldLore.creatures.map(creature => (
                                <div key={creature.name}>
                                    <h5 className="font-bold text-gray-200">{creature.name}</h5>
                                    <p className="text-sm text-gray-400 mb-1">{creature.description}</p>
                                    <p className="text-sm"><strong className="text-purple-400">Habitat:</strong> <span className="text-gray-400">{creature.habitat}</span></p>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            </details>

            <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors">
              <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">Key Factions</summary>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    {worldLore.factions.map((faction) => (
                        <div key={faction.name} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 h-full flex flex-col">
                            <div className="flex items-start gap-4 mb-3">
                            {faction.sigilImageUrl ? (
                                <img src={faction.sigilImageUrl} alt={`${faction.name} Sigil`} className="w-20 h-20 rounded-md border-2 border-purple-800 bg-gray-900 object-cover" />
                            ) : (
                                <div className="w-20 h-20 rounded-md border-2 border-gray-700 bg-gray-900 flex items-center justify-center">
                                <p className="text-xs text-gray-500 text-center">No Sigil</p>
                                </div>
                            )}
                            <div>
                                <h4 className="text-lg font-bold text-purple-400">{faction.name}</h4>
                                <p className="text-sm text-gray-400">Leader: {faction.leader}</p>
                            </div>
                            </div>
                            <p className="text-sm text-gray-300 mb-2"><strong className="font-semibold text-gray-200">Ideology:</strong> {faction.ideology}</p>
                            <p className="text-sm text-gray-400 flex-grow"><strong className="font-semibold text-gray-300">Relationships:</strong> {faction.relationships}</p>
                            <p className="text-sm text-gray-400 mt-auto pt-2 border-t border-gray-700/50"><strong className="font-semibold text-gray-300">HQ:</strong> {faction.headquarters}</p>
                        </div>
                    ))}
                </div>
            </details>

            <div className="border-t-2 border-purple-800/50 my-6"></div>
            <h3 className="text-2xl font-title text-purple-300 tracking-wider text-center">Your Discoveries</h3>
             <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors" open>
              <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">Known Locations</summary>
               <ul className="list-disc list-inside mt-2 space-y-2">
                {gameState.lore.locations.map((l, i) => <li key={i}><strong className="text-gray-200">{l.name}:</strong> <span className="text-gray-400">{l.description}</span></li>)}
               </ul>
            </details>
             <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors" open>
              <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">Known Characters</summary>
                {gameState.lore.characters.length > 0 ? (
                    <ul className="list-disc list-inside mt-2 space-y-2">
                        {gameState.lore.characters.map((c, i) => <li key={i}><strong className="text-gray-200">{c.name}:</strong> <span className="text-gray-400">{c.description}</span></li>)}
                    </ul>
                ) : <p className="text-gray-500 italic mt-2">You haven't met anyone of note.</p>}
            </details>
             <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors" open>
              <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">World Knowledge</summary>
                 {gameState.lore.knowledge.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
                        {gameState.lore.knowledge.map((k, i) => <li key={i}>{k}</li>)}
                    </ul>
                 ): <p className="text-gray-500 italic mt-2">Your knowledge of this world is limited.</p>}
             </details>
        </div>
     </div>
    );
  };

  return (
    <div className="flex flex-col h-[75vh] relative">
      {tooltipData && (
        <div
          className="fixed p-3 bg-gray-950 border border-purple-800 rounded-lg shadow-xl z-50 pointer-events-none max-w-sm"
          style={{
            top: tooltipData.y,
            left: tooltipData.x,
            transform: `translate(${tooltipData.x > window.innerWidth / 2 ? 'calc(-100% - 15px)' : '15px'}, ${tooltipData.y > window.innerHeight / 2 ? 'calc(-100% - 15px)' : '15px'})`
          }}
        >
          {tooltipData.content}
        </div>
      )}
      {isLevelingUp && <LevelUpModal character={gameState.scenario.character} onConfirm={handleLevelUpConfirm} />}
      
      {xpGainAnnouncements.map(xp => (
        <div 
          key={xp.id} 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl font-bold text-yellow-300 animate-float-up pointer-events-none" 
          style={{ zIndex: 100, textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
            +{xp.amount} XP
        </div>
      ))}
       {questNotifications.map(qn => (
        <div
          key={qn.id}
          className={`absolute top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-white font-bold text-lg shadow-2xl animate-fade-in-out z-50
            ${qn.type === 'new' ? 'bg-blue-600 border-blue-400' : 'bg-green-600 border-green-400'} border-2`}
          style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
        >
            {qn.text}
        </div>
      ))}
      
      <div className="flex border-b border-purple-800 mb-4">
        <TabButton label="Story" />
        <TabButton label="Character" />
        <TabButton label="Journal" />
        <TabButton label="World" />
      </div>
      
      <div className="flex-grow min-h-0">
        {activeTab === 'Story' && renderStoryTab()}
        {activeTab === 'Character' && renderCharacterTab()}
        {activeTab === 'Journal' && renderJournalTab()}
        {activeTab === 'World' && renderWorldTab()}
      </div>

      <style>{`
          .custom-scrollbar::-webkit-scrollbar {
              width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
              background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #4c1d95;
              border-radius: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #5b21b6;
          }
          @keyframes fade-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
              animation: fade-in 0.5s ease-out forwards;
          }
          @keyframes float-up {
              from { opacity: 1; transform: translateY(0px) scale(1); }
              to { opacity: 0; transform: translateY(-60px) scale(1.5); }
          }
          .animate-float-up {
              animation: float-up 2s ease-out forwards;
          }
          @keyframes fade-in-out {
            0% { opacity: 0; transform: translateY(-20px) translateX(-50%); }
            20% { opacity: 1; transform: translateY(0) translateX(-50%); }
            80% { opacity: 1; transform: translateY(0) translateX(-50%); }
            100% { opacity: 0; transform: translateY(20px) translateX(-50%); }
          }
          .animate-fade-in-out {
            animation: fade-in-out 4s ease-in-out forwards;
          }
      `}</style>
    </div>
  );
};

export default GameScreen;