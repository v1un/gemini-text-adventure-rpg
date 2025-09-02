import React, { useState, useEffect } from 'react';
import { 
    generateLoreFoundation, 
    generateLoreFactions, 
    generateSigilImage,
    generateLoreCosmology,
    generateLoreMagicSystem,
    generateLoreInhabitants,
    generateFinalLoreDetails,
} from '../services/geminiService';
import type { Lore, Faction } from '../types';
import Spinner from './Spinner';

interface LoreGeneratorProps {
  onLoreCreated: (lore: Lore) => void;
}

type GenerationStep = 'inputs' | 'foundation_review' | 'factions_review' | 'systems_review' | 'inhabitants_review' | 'finalizing' | 'complete';
type InputMode = 'simple' | 'detailed';

const LoreGenerator: React.FC<LoreGeneratorProps> = ({ onLoreCreated }) => {
  const [step, setStep] = useState<GenerationStep>('inputs');
  const [loreBuilder, setLoreBuilder] = useState<Partial<Lore>>({});
  const [finalLore, setFinalLore] = useState<Lore | null>(null);
  
  // User Inputs
  const [inputMode, setInputMode] = useState<InputMode>('simple');
  const [spark, setSpark] = useState('');
  const [conflict, setConflict] = useState('');
  const [anomaly, setAnomaly] = useState('');
  const [detailedPrompt, setDetailedPrompt] = useState('');
  const [generatedAnomaly, setGeneratedAnomaly] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');

  const handleStartWeaving = async () => {
    const isSimple = inputMode === 'simple';
    if ((isSimple && (!spark.trim() || !conflict.trim() || !anomaly.trim())) || (!isSimple && !detailedPrompt.trim())) {
      setError("Please fill out all creative prompts to begin.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setProgressMessage('Forging the world\'s foundation...');
    try {
      const genInputs = isSimple 
          ? { spark, conflict, anomaly } 
          : { detailedPrompt };
      const { anomaly: newAnomaly, ...foundation } = await generateLoreFoundation(genInputs);
      
      setLoreBuilder(foundation);
      setGeneratedAnomaly(newAnomaly);
      setStep('foundation_review');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setProgressMessage('');
    }
  };
  
  const handleRerollFoundation = async () => {
     setError(null);
     setIsLoading(true);
     setProgressMessage('Re-forging the foundation...');
     try {
       const isSimple = inputMode === 'simple';
       const genInputs = isSimple 
          ? { spark, conflict, anomaly } 
          : { detailedPrompt };
       const { anomaly: newAnomaly, ...foundation } = await generateLoreFoundation(genInputs);
       
       setLoreBuilder(foundation);
       setGeneratedAnomaly(newAnomaly);
     } catch (err) {
       setError(err instanceof Error ? err.message : 'An unknown error occurred.');
     } finally {
       setIsLoading(false);
       setProgressMessage('');
     }
  };

  const handleAcceptFoundation = async () => {
    setIsLoading(true);
    setError(null);
    setProgressMessage('Raising the world\'s factions...');
    try {
      const { factions: baseFactions } = await generateLoreFactions(loreBuilder as Pick<Lore, 'worldName' | 'coreConcept' | 'timeline'>);
      
      setLoreBuilder(prev => ({ ...prev, factions: baseFactions }));
      setStep('factions_review');
      
      const factionsWithSigils = [...baseFactions];
      for (let i = 0; i < factionsWithSigils.length; i++) {
        const faction = factionsWithSigils[i];
        setProgressMessage(`Carving sigil for "${faction.name}"...`);
        try {
            const sigilImageUrl = await generateSigilImage(faction.name, faction.description, loreBuilder.coreConcept!);
            const updatedFaction = { ...faction, sigilImageUrl };
            
            setLoreBuilder(prev => {
                const updatedFactions = prev.factions?.map(f => f.name === updatedFaction.name ? updatedFaction : f) ?? [];
                return { ...prev, factions: updatedFactions };
            });
            factionsWithSigils[i] = updatedFaction;
        } catch (sigilError) {
             console.error(`Error generating sigil for ${faction.name}:`, sigilError);
             setError(`Could not generate a sigil for ${faction.name}. Continuing...`);
        }
      }

    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setStep('foundation_review'); // Revert on failure
    } finally {
        setIsLoading(false);
        setProgressMessage('');
    }
  };

  const handleAcceptFactions = async () => {
    setIsLoading(true);
    setError(null);
    try {
        setProgressMessage('Charting the heavens...');
        const cosmology = await generateLoreCosmology(
            loreBuilder as Pick<Lore, 'worldName' | 'coreConcept' | 'timeline'>, 
            generatedAnomaly
        );
        
        setProgressMessage('Weaving the arcane arts...');
        const magicSystem = await generateLoreMagicSystem(loreBuilder as Pick<Lore, 'worldName' | 'coreConcept'>, cosmology.cosmology);

        setLoreBuilder(prev => ({ ...prev, ...cosmology, ...magicSystem }));
        setStep('systems_review');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setStep('factions_review');
    } finally {
        setIsLoading(false);
        setProgressMessage('');
    }
  };

  const handleAcceptSystems = async () => {
    setIsLoading(true);
    setError(null);
    try {
        setProgressMessage('Populating the world...');
        const inhabitants = await generateLoreInhabitants(loreBuilder as Pick<Lore, 'worldName' | 'coreConcept' | 'timeline' | 'factions' | 'cosmology' | 'magicSystem'>);
        setLoreBuilder(prev => ({ ...prev, ...inhabitants }));
        setStep('inhabitants_review');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setStep('systems_review');
    } finally {
        setIsLoading(false);
        setProgressMessage('');
    }
  };

  const handleFinalizeWorld = async () => {
    setIsLoading(true);
    setError(null);
    setProgressMessage('Uncovering final secrets...');
    setStep('finalizing');

    try {
        const finalDetails = await generateFinalLoreDetails(loreBuilder);
        
        const completeLore = {
            ...loreBuilder,
            ...finalDetails,
            characters: [], // Initialize runtime discoveries
            knowledge: [],
        } as Lore;

        setFinalLore(completeLore);
        setStep('complete');

    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        setStep('inhabitants_review'); // Go back a step on error
    } finally {
        setIsLoading(false);
        setProgressMessage('');
    }
  };

  const FactionCard: React.FC<{ faction: Faction }> = ({ faction }) => (
    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 h-full flex flex-col">
      <div className="flex items-start gap-4 mb-3">
        {faction.sigilImageUrl ? (
          <img src={faction.sigilImageUrl} alt={`${faction.name} Sigil`} className="w-20 h-20 rounded-md border-2 border-purple-800 bg-gray-900 object-cover transition-opacity duration-500" />
        ) : (
          <div className="w-20 h-20 rounded-md border-2 border-gray-700 bg-gray-900 flex items-center justify-center">
            {isLoading && step === 'factions_review' ? <Spinner /> : <p className="text-xs text-gray-500 text-center">No Sigil</p>}
          </div>
        )}
        <div>
          <h4 className="text-lg font-bold text-purple-400">{faction.name}</h4>
          <p className="text-sm text-gray-400">Leader: {faction.leader}</p>
        </div>
      </div>
      <p className="text-sm text-gray-300 mb-2 flex-grow"><strong className="font-semibold text-gray-200">Ideology:</strong> {faction.ideology}</p>
      <p className="text-sm text-gray-400 mt-auto"><strong className="font-semibold text-gray-300">HQ:</strong> {faction.headquarters}</p>
    </div>
  );

  const renderInputs = () => (
    <>
      <h2 className="text-3xl font-title text-purple-300 mb-4">World Anvil</h2>
      <p className="text-lg text-gray-300 mb-6 max-w-2xl">
        Forge a unique world. Provide three creative sparks for a guided creation, or a detailed prompt for full control.
      </p>

      <div className="flex justify-center mb-6 border border-gray-700 rounded-lg p-1 bg-gray-900 w-full max-w-sm">
          <button onClick={() => setInputMode('simple')} className={`w-1/2 py-2 rounded-md transition-colors font-semibold ${inputMode === 'simple' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:bg-gray-800'}`}>
              Simple Prompts
          </button>
          <button onClick={() => setInputMode('detailed')} className={`w-1/2 py-2 rounded-md transition-colors font-semibold ${inputMode === 'detailed' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:bg-gray-800'}`}>
              Detailed Prompt
          </button>
      </div>

      <div className="w-full max-w-xl space-y-4">
        {inputMode === 'simple' ? (
            <>
                <div>
                  <label htmlFor="spark" className="block text-left font-bold text-purple-300 mb-1">The Spark *</label>
                  <input id="spark" type="text" value={spark} onChange={(e) => setSpark(e.target.value)} placeholder="e.g., A city built on the back of a sleeping god" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" disabled={isLoading} />
                </div>
                <div>
                  <label htmlFor="conflict" className="block text-left font-bold text-purple-300 mb-1">The Core Conflict *</label>
                  <input id="conflict" type="text" value={conflict} onChange={(e) => setConflict(e.target.value)} placeholder="e.g., Ancient Magic vs. Nascent Technology" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" disabled={isLoading} />
                </div>
                <div>
                  <label htmlFor="anomaly" className="block text-left font-bold text-purple-300 mb-1">A Strange Anomaly *</label>
                  <input id="anomaly" type="text" value={anomaly} onChange={(e) => setAnomaly(e.target.value)} placeholder="e.g., Memories can be physically traded" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" disabled={isLoading} />
                </div>
            </>
        ) : (
            <div>
                 <label htmlFor="detailed-prompt" className="block text-left font-bold text-purple-300 mb-1">Detailed World Prompt *</label>
                 <textarea 
                    id="detailed-prompt"
                    value={detailedPrompt}
                    onChange={e => setDetailedPrompt(e.target.value)}
                    placeholder="Describe the world you want to create. Include its history, key factions, magic systems, unique rules, and overall mood..."
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 h-40"
                    disabled={isLoading}
                 />
            </div>
        )}
        <div className="pt-2">
          <button onClick={handleStartWeaving} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg text-lg transition-all duration-300 ease-in-out shadow-lg hover:shadow-purple-500/50 flex items-center justify-center gap-4">
            {isLoading ? <><Spinner /> {progressMessage || 'Starting...'}</> : 'Start Weaving'}
          </button>
        </div>
      </div>
    </>
  );

  const renderFoundationReview = () => (
    <div className="w-full max-w-3xl animate-fade-in">
        <h2 className="text-3xl font-title text-purple-300 mb-4 text-center">The Foundation</h2>
        <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 space-y-4">
            <div>
                <h3 className="text-xl font-bold text-purple-400">World Name</h3>
                <p className="text-gray-200 text-lg">{loreBuilder.worldName}</p>
            </div>
            <div>
                <h3 className="text-xl font-bold text-purple-400">Core Concept</h3>
                <p className="text-gray-300 italic">{loreBuilder.coreConcept}</p>
            </div>
             <div>
                <h3 className="text-xl font-bold text-purple-400">The Anomaly</h3>
                <p className="text-gray-300 italic">{generatedAnomaly}</p>
            </div>
            <div>
                <h3 className="text-xl font-bold text-purple-400">Timeline of Ages</h3>
                <div className="mt-2 border-l-2 border-purple-800 pl-4 space-y-4">
                    {loreBuilder.timeline?.map((event, index) => (
                        <div key={index} className="relative">
                            <span className="absolute -left-[27px] top-1 h-4 w-4 rounded-full bg-purple-400 ring-4 ring-gray-800"></span>
                            <h4 className="font-semibold text-gray-200 text-lg">{event.era}</h4>
                            <p className="text-gray-400">{event.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        <div className="flex justify-center items-center gap-4 mt-6">
             <button onClick={handleRerollFoundation} disabled={isLoading} className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-colors">
                {isLoading ? <Spinner/> : 'Reroll'}
            </button>
            <button onClick={handleAcceptFoundation} disabled={isLoading} className="bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
                {isLoading ? <><Spinner/> {progressMessage || 'Accepting...'}</> : 'Accept & Continue'}
            </button>
        </div>
    </div>
  );

  const renderFactionsReview = () => (
     <div className="w-full max-w-4xl animate-fade-in">
        <h2 className="text-3xl font-title text-purple-300 mb-4 text-center">The Powers That Be</h2>
         {isLoading && progressMessage && <p className="text-center text-purple-300 mb-4">{progressMessage}</p>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {loreBuilder.factions?.map(faction => <FactionCard key={faction.name} faction={faction} />)}
        </div>
        <div className="text-center mt-6">
             <button onClick={handleAcceptFactions} disabled={isLoading || (loreBuilder.factions?.some(f => !f.sigilImageUrl) ?? true)} className="bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
                {isLoading ? <><Spinner/> {progressMessage}</> : 'Accept & Continue'}
            </button>
        </div>
    </div>
  );

  const renderSystemsReview = () => (
    <div className="w-full max-w-4xl animate-fade-in">
      <h2 className="text-3xl font-title text-purple-300 mb-4 text-center">Cosmology & Magic</h2>
      <div className="bg-gray-900/50 p-6 rounded-lg border border-gray-700 space-y-6">
          <div>
              <h3 className="text-xl font-bold text-purple-400">Cosmology</h3>
              <p className="text-gray-300 mt-2 italic">{loreBuilder.cosmology?.creationMyth}</p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {loreBuilder.cosmology?.deities.map(d => (
                    <div key={d.name} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                        <h4 className="font-bold text-gray-200">{d.name}</h4>
                        <p className="text-sm text-purple-400 mb-1">{d.domain}</p>
                        <p className="text-sm text-gray-400">{d.description}</p>
                    </div>
                ))}
              </div>
          </div>
          <div className="border-t border-gray-700 pt-6">
              <h3 className="text-xl font-bold text-purple-400">Magic System: {loreBuilder.magicSystem?.name}</h3>
              <p className="text-gray-300 mt-2 italic">{loreBuilder.magicSystem?.description}</p>
              <ul className="list-disc list-inside mt-2 space-y-2 text-gray-400">
                  {loreBuilder.magicSystem?.rules.map((rule, i) => <li key={i}>{rule}</li>)}
              </ul>
          </div>
      </div>
      <div className="text-center mt-6">
          <button onClick={handleAcceptSystems} disabled={isLoading} className="bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
              {isLoading ? <Spinner/> : 'Accept & Continue'}
          </button>
      </div>
    </div>
  );

  const renderInhabitantsReview = () => (
    <div className="w-full max-w-5xl animate-fade-in">
        <h2 className="text-3xl font-title text-purple-300 mb-4 text-center">The Inhabitants</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-xl font-bold text-purple-400 mb-3">Races</h3>
                    <div className="space-y-4">
                        {loreBuilder.races?.map(r => (
                            <div key={r.name}>
                                <h4 className="font-bold text-gray-200">{r.name}</h4>
                                <p className="text-sm text-gray-400 mb-1">{r.description}</p>
                                <p className="text-sm"><strong className="text-purple-400">Abilities:</strong> {r.abilities}</p>
                            </div>
                        ))}
                    </div>
                </div>
                 <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="text-xl font-bold text-purple-400 mb-3">Creatures</h3>
                    <div className="space-y-4">
                        {loreBuilder.creatures?.map(c => (
                            <div key={c.name}>
                                <h4 className="font-bold text-gray-200">{c.name}</h4>
                                <p className="text-sm text-gray-400 mb-1">{c.description}</p>
                                <p className="text-sm"><strong className="text-purple-400">Habitat:</strong> {c.habitat}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="lg:col-span-1 bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                 <h3 className="text-xl font-bold text-purple-400 mb-3">Historical Figures</h3>
                 <div className="space-y-4">
                    {loreBuilder.historicalFigures?.map(h => (
                        <div key={h.name}>
                            <h4 className="font-bold text-gray-200">{h.name}</h4>
                            <p className="text-sm text-gray-400 mb-1">{h.description}</p>
                            <p className="text-sm text-purple-400 italic">{h.significance}</p>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
         <div className="text-center mt-6">
            <button onClick={handleFinalizeWorld} disabled={isLoading} className="bg-green-600 hover:bg-green-700 disabled:bg-green-900 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors">
                {isLoading ? <><Spinner/> {progressMessage}</> : 'Accept & Finalize World'}
            </button>
        </div>
    </div>
  );

  const renderLoreDisplay = () => (
    <div className="w-full animate-fade-in">
        <h2 className="text-3xl font-title text-purple-300 mb-2 text-center">The Chronicles of {finalLore!.worldName}</h2>
        <p className="text-center text-gray-400 mb-6 italic">{finalLore!.coreConcept}</p>
        <div className="space-y-6 bg-gray-900/50 p-6 rounded-lg border border-gray-700 max-w-5xl mx-auto">
             <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors" open>
                <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">World Timeline</summary>
                <div className="mt-4 border-l-2 border-purple-800 pl-4 space-y-4">
                    {finalLore!.timeline.map((event, index) => (
                        <div key={index} className="relative">
                            <span className="absolute -left-[27px] top-1 h-4 w-4 rounded-full bg-purple-400 ring-4 ring-gray-800"></span>
                            <h4 className="font-semibold text-gray-200 text-lg">{event.era}</h4>
                            <p className="text-gray-400">{event.description}</p>
                        </div>
                    ))}
                </div>
            </details>
             <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors">
                <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">Key Factions</summary>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {finalLore!.factions.map((faction) => (
                        <FactionCard key={faction.name} faction={faction} />
                    ))}
                </div>
            </details>
            <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors">
                <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">Notable Locations</summary>
                <ul className="list-disc list-inside mt-2 space-y-2">
                    {finalLore!.locations.map((l) => <li key={l.name}><strong className="text-gray-200">{l.name}:</strong> <span className="text-gray-400">{l.description}</span></li>)}
                </ul>
            </details>
            <details className="p-3 rounded-lg border border-gray-800 bg-gray-900/30 open:bg-gray-900/50 transition-colors">
                <summary className="text-xl font-bold text-purple-400 cursor-pointer list-none">World Secrets</summary>
                 <ul className="list-disc list-inside mt-2 space-y-2">
                    {finalLore!.secrets.map((s) => <li key={s.title}><strong className="text-gray-200">{s.title}:</strong> <span className="text-gray-400 italic">{s.description}</span></li>)}
                </ul>
            </details>
        </div>
        <div className="text-center mt-8">
            <button onClick={() => onLoreCreated(finalLore!)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition-all duration-300 ease-in-out shadow-lg hover:shadow-green-500/50">
              Use this Lore & Create Character
            </button>
        </div>
    </div>
  );

  const renderContent = () => {
      if (isLoading && step === 'finalizing') {
        return (
            <div className="flex flex-col items-center justify-center text-center animate-fade-in">
                <Spinner />
                <h2 className="text-2xl font-title text-purple-300 mt-4">{progressMessage || "Finalizing World..."}</h2>
                <p className="text-gray-400">This may take a moment.</p>
            </div>
        );
      }
      
      switch(step) {
          case 'inputs': return renderInputs();
          case 'foundation_review': return renderFoundationReview();
          case 'factions_review': return renderFactionsReview();
          case 'systems_review': return renderSystemsReview();
          case 'inhabitants_review': return renderInhabitantsReview();
          case 'complete': return finalLore ? renderLoreDisplay() : <p>Error rendering lore.</p>;
          default: return renderInputs();
      }
  };

  return (
    <div className="text-center flex flex-col items-center animate-fade-in w-full">
      {renderContent()}
      {error && <p className="text-red-400 mt-4">{error}</p>}
    </div>
  );
};

export default LoreGenerator;