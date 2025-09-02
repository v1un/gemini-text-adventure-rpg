import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { GameState, Scenario, GeminiResponse, Lore, Quest, Item, Character, Faction, TimelineEvent } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- NEW SCHEMAS FOR GRANULAR LORE GENERATION ---
const timelineEventSchema = {
    type: Type.OBJECT,
    properties: {
        era: { type: Type.STRING, description: "The name of the historical era or event (e.g., 'The Age of Sundering', 'The Silent War')." },
        description: { type: Type.STRING, description: "A 2-3 sentence summary of what happened during this era and its consequences, leading logically to the next era." }
    },
    required: ["era", "description"]
};

const foundationSchema = {
  type: Type.OBJECT,
  properties: {
    worldName: { type: Type.STRING, description: "A unique, evocative name for this fantasy world." },
    coreConcept: { type: Type.STRING, description: "A 1-2 sentence high-concept summary of the world's main theme, derived from the user's inputs." },
    timeline: {
        type: Type.ARRAY,
        description: "A timeline of 3 to 4 key historical eras that define the world's backstory. The events should be chronologically ordered and logically connected, building a coherent history.",
        items: timelineEventSchema
    },
    anomaly: { type: Type.STRING, description: "A concise, one-sentence summary of the single most strange, unique, or unusual rule about this world, synthesized from the user's inputs." }
  },
  required: ["worldName", "coreConcept", "timeline", "anomaly"]
};

const factionsSchema = {
  type: Type.OBJECT,
  properties: {
    factions: {
      type: Type.ARRAY,
      description: "A list of 3 major factions or political powers in the world. These must be directly linked to the world's history and conflict.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The unique name of the faction." },
          description: { type: Type.STRING, description: "A brief, 1-2 sentence description of the faction's public identity and nature." },
          leader: { type: Type.STRING, description: "The name and title of the faction's current leader." },
          headquarters: { type: Type.STRING, description: "The name of the city, fortress, or location that serves as their main base of operations." },
          ideology: { type: Type.STRING, description: "A short summary of the faction's core beliefs, goals, or motivations, tied to the world's core conflict." },
          relationships: { type: Type.STRING, description: "A brief description of their alliance or rivalry status with other potential factions." },
        },
        required: ["name", "description", "leader", "headquarters", "ideology", "relationships"]
      }
    }
  },
  required: ["factions"]
};

const locationsSchema = {
  type: Type.OBJECT,
  properties: {
    locations: {
      type: Type.ARRAY,
      description: "A list of 4 distinct geographical regions or significant locations in the world. Each location must be either a faction headquarters, a racial homeland, or the site of a major event from the world timeline.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The name of the location." },
          description: { type: Type.STRING, description: "A brief, evocative description of this location's environment, its relevance to the timeline, or its connection to a faction." }
        },
        required: ["name", "description"]
      }
    }
  },
  required: ["locations"]
};

const cosmologySchema = {
    type: Type.OBJECT,
    properties: {
        cosmology: {
            type: Type.OBJECT,
            properties: {
                creationMyth: { type: Type.STRING, description: "A 2-3 paragraph myth describing how the world was created, directly inspired by the user-provided 'anomaly'." },
                deities: {
                    type: Type.ARRAY,
                    description: "A pantheon of 2-4 major deities that embody the world's core concepts and conflict.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "The deity's name." },
                            domain: { type: Type.STRING, description: "The deity's primary domain (e.g., 'Knowledge and Shadow', 'War and Sacrifice')." },
                            description: { type: Type.STRING, description: "A brief description of the deity's personality, goals, and relationship to the world's history." },
                        },
                        required: ["name", "domain", "description"]
                    }
                }
            },
             required: ["creationMyth", "deities"]
        }
    },
    required: ["cosmology"]
};

const magicSystemSchema = {
    type: Type.OBJECT,
    properties: {
        magicSystem: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: "An evocative name for the magic system (e.g., 'Chronomancy', 'Soul Weaving')." },
                description: { type: Type.STRING, description: "A paragraph explaining the source and nature of magic in this world, directly linked to the cosmology and deities." },
                rules: {
                    type: Type.ARRAY,
                    description: "A list of 3 fundamental laws or limitations of how magic works.",
                    items: { type: Type.STRING }
                }
            },
            required: ["name", "description", "rules"]
        }
    },
    required: ["magicSystem"]
};

const inhabitantsSchema = {
    type: Type.OBJECT,
    properties: {
        races: {
            type: Type.ARRAY,
            description: "A list of 2-3 sentient, playable races unique to this world. They should be deeply integrated with the world's history and factions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The race's name." },
                    description: { type: Type.STRING, description: "A description of their culture, society, and typical appearance." },
                    abilities: { type: Type.STRING, description: "A brief summary of their innate talents or abilities." }
                },
                required: ["name", "description", "abilities"]
            }
        },
        creatures: {
            type: Type.ARRAY,
            description: "A list of 3-4 non-sentient or monstrous creatures that inhabit the world. Their existence should be explained by the magic system or timeline events.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The creature's name." },
                    description: { type: Type.STRING, description: "A description of the creature's appearance, behavior, and threat level." },
                    habitat: { type: Type.STRING, description: "The geographical regions or locations where this creature is typically found." }
                },
                required: ["name", "description", "habitat"]
            }
        },
        historicalFigures: {
            type: Type.ARRAY,
            description: "A list of 2-3 key historical figures (heroes, villains, monarchs, scholars) who played a pivotal role in the world's timeline. They can be dead or alive.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The figure's name and title." },
                    description: { type: Type.STRING, description: "A brief biography of the figure." },
                    significance: { type: Type.STRING, description: "Their major contribution or impact on the world's history, timeline, or factions." }
                },
                required: ["name", "description", "significance"]
            }
        }
    },
    required: ["races", "creatures", "historicalFigures"]
};

const secretsSchema = {
    type: Type.OBJECT,
    properties: {
        secrets: {
            type: Type.ARRAY,
            description: "A list of 2-3 major 'World Secrets' or unresolved mysteries. These should be potential hooks for a grand adventure, logically tied to unexplained parts of the timeline or the hidden motives of the factions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: "A short, intriguing title for the secret (e.g., 'The Sunken Prophecy')." },
                    description: { type: Type.STRING, description: "A brief, mysterious description of the secret and why it's important." }
                },
                required: ["title", "description"]
            }
        }
    },
    required: ["secrets"]
};

// --- END NEW SCHEMAS ---

const scenarioSchema = {
  type: Type.OBJECT,
  properties: {
    character: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "The character's fantasy name. Use the user's preferred name if provided." },
        backstory: { type: Type.STRING, description: "A brief, 2-3 sentence backstory for the character that fits the world lore and incorporates the player's character concept." },
        health: { type: Type.INTEGER, description: "Character's current health. Set to maxHealth." },
        maxHealth: { type: Type.INTEGER, description: "Character's maximum health. Determine a suitable value between 80 and 120 based on the character concept." },
        mana: { type: Type.INTEGER, description: "Character's current mana. Set to maxMana. Used for spells." },
        maxMana: { type: Type.INTEGER, description: "Character's maximum mana. Determine a suitable value between 30 and 150 based on the character concept." },
        stamina: { type: Type.INTEGER, description: "Character's current stamina. Set to maxStamina. Used for physical feats." },
        maxStamina: { type: Type.INTEGER, description: "Character's maximum stamina. Determine a suitable value between 60 and 120 based on the character concept." },
        level: { type: Type.INTEGER, description: "Character's starting level. Always set to 1." },
        xp: { type: Type.INTEGER, description: "Character's starting experience points. Always set to 0." },
        xpToNextLevel: { type: Type.INTEGER, description: "The experience points needed to reach the next level. Always set to 100 for a new character." },
      },
      required: ["name", "backstory", "health", "maxHealth", "mana", "maxMana", "stamina", "maxStamina", "level", "xp", "xpToNextLevel"],
    },
    setting: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "The name of the starting location or region, consistent with the world lore." },
        description: { type: Type.STRING, description: "A vivid, 2-3 sentence description of the initial setting." },
      },
      required: ["name", "description"],
    },
    goal: { type: Type.STRING, description: "The main long-term objective for the player's adventure, relevant to the world's conflicts or themes." },
    objective: { type: Type.STRING, description: "The first, immediate, and actionable step the character must take to begin their quest towards the main goal. This should be a clear instruction." },
  },
  required: ["character", "setting", "goal", "objective"],
};

const objectiveSchema: any = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING, description: "The description of the objective." },
        isCompleted: { type: Type.BOOLEAN, description: "Whether the objective is completed. Should be false for new objectives." },
    },
    required: ['text', 'isCompleted'],
};
objectiveSchema.properties.subObjectives = {
    type: Type.ARRAY,
    description: "Optional list of sub-objectives that must be completed to finish this main objective.",
    items: objectiveSchema
};

const questSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: "A short, evocative title for the quest." },
        description: { type: Type.STRING, description: "A brief summary of the quest's purpose and backstory." },
        status: { type: Type.STRING, description: "The current status of the quest. Must be 'active'." },
        objectives: {
            type: Type.ARRAY,
            items: objectiveSchema,
            description: "A list of concrete steps the player needs to take. Start with at least one objective.",
        },
    },
    required: ['title', 'description', 'status', 'objectives'],
};

const itemEffectSchema = {
    type: Type.OBJECT,
    properties: {
        stat: { type: Type.STRING, description: "The character stat to affect. Must be 'health', 'mana', or 'stamina'." },
        value: { type: Type.INTEGER, description: "The amount to restore (positive value) or drain (negative value)." },
    },
    required: ["stat", "value"],
};

const itemSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The name of the item." },
        description: { type: Type.STRING, description: "A brief, flavorful description of the item." },
        rarity: { type: Type.STRING, description: "The rarity of the item. Must be one of: 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'." },
        type: { type: Type.STRING, description: "The type of item. Must be one of: 'Consumable', 'Quest Item', 'Equipment', 'Tome'." },
        usable: { type: Type.BOOLEAN, description: "True if the item can be actively used by the player from their inventory (e.g., a potion). False for quest items or passive equipment." },
        effects: {
            type: Type.ARRAY,
            description: "A list of effects this item has when used. Leave empty for items with no direct stat effect.",
            items: itemEffectSchema,
        },
    },
    required: ["name", "description", "rarity", "type", "usable", "effects"],
};

const gameStepSchema = {
    type: Type.OBJECT,
    properties: {
        narrative: { type: Type.STRING, description: "A 2-4 paragraph story segment describing the environment, actions, and character thoughts. Do NOT include spoken dialogue here." },
        dialogue: {
          type: Type.ARRAY,
          description: "Optional. A list of direct speech from NPCs. Use this for conversations. Do not include narration.",
          items: {
            type: Type.OBJECT,
            properties: {
              characterName: { type: Type.STRING, description: "The name of the character speaking." },
              text: { type: Type.STRING, description: "The dialogue line, without quotation marks." }
            },
            required: ["characterName", "text"]
          }
        },
        newLocation: { type: Type.STRING, description: "The player's new location. If they haven't moved, repeat the current location." },
        updatedInventory: { type: Type.ARRAY, items: itemSchema, description: "The player's full, updated inventory list as an array of item objects. Add or remove items as needed." },
        newObjective: { type: Type.STRING, description: "The new immediate objective for the MAIN quest. This is a smaller step towards the main goal." },
        newQuest: {
            ...(questSchema as object),
            description: "Optional. If the player's action starts a new SIDE quest, define it here. A quest should have at least one objective. An objective can be broken down into smaller steps using 'subObjectives'."
        },
        questUpdate: {
            type: Type.OBJECT,
            description: "Optional. If an objective or sub-objective of a SIDE quest is completed, specify its details here.",
            properties: {
                questTitle: { type: Type.STRING, description: "The title of the quest being updated." },
                objectiveText: { type: Type.STRING, description: "The exact text of the objective that was just completed." },
                newStatus: { type: Type.STRING, description: "Optional. If the entire quest is now resolved, set its status to 'completed' or 'failed'." },
            },
            required: ['questTitle', 'objectiveText'],
        },
        isGameOver: { type: Type.BOOLEAN, description: "Set to true if the player has won or lost the game." },
        gameOverMessage: { type: Type.STRING, description: "If isGameOver is true, provide a concluding message. Otherwise, leave empty." },
        characterUpdate: {
            type: Type.OBJECT,
            description: "Optional. If the player's stats change (e.g., taking damage, using a spell, gaining XP), update them here. Only include stats that have changed.",
            properties: {
                health: { type: Type.INTEGER, description: "The character's new health value." },
                mana: { type: Type.INTEGER, description: "The character's new mana value." },
                stamina: { type: Type.INTEGER, description: "The character's new stamina value." },
                xpGained: { type: Type.INTEGER, description: "Optional. The amount of experience points the character gains from this action." }
            }
        },
        loreUpdate: {
            type: Type.OBJECT,
            description: "Optional. If a new, significant, named character, location, or piece of information is revealed, propose adding it to the world lore here. Use sparingly for major discoveries.",
            properties: {
                type: { type: Type.STRING, description: "The type of lore. Must be 'location', 'character', or 'knowledge'." },
                name: { type: Type.STRING, description: "The name of the lore item." },
                description: { type: Type.STRING, description: "A concise, 1-2 sentence description." }
            }
        },
        requestImageGeneration: { type: Type.BOOLEAN, description: "Set to true ONLY for visually significant moments like entering a new area, a dramatic action, or a pivotal discovery. Otherwise, set to false." },
    },
    required: ["narrative", "newLocation", "updatedInventory", "newObjective", "isGameOver", "gameOverMessage"],
};

// --- NEW INTERACTIVE LORE GENERATION FUNCTIONS ---

export const generateLoreFoundation = async (inputs: { spark: string; conflict: string; anomaly: string } | { detailedPrompt: string }): Promise<Pick<Lore, 'worldName' | 'coreConcept' | 'timeline'> & { anomaly: string }> => {
    let prompt: string;

    if ('detailedPrompt' in inputs) {
        prompt = `You are a world-building expert tasked with creating a unique and logically consistent fantasy world. Generate the foundational elements based on the user's detailed description. Be imaginative and avoid clichés.

User's Detailed Description:
"""
${inputs.detailedPrompt}
"""

Your tasks:
1.  Create a unique, evocative world name.
2.  Write a 1-2 sentence high-concept summary of the world's main theme.
3.  Generate a historical timeline of 3-4 distinct, chronologically ordered eras that build a compelling history.
4.  Identify and summarize the single most strange or unusual rule of this world (the 'anomaly') in one concise sentence.

Output must be a valid JSON object.`;
    } else {
        prompt = `You are a world-building expert tasked with creating a unique and logically consistent fantasy world. Generate the foundational elements based on the user's creative inputs. Avoid clichés. Be imaginative.

User Inputs:
- The Spark (A core idea): "${inputs.spark}"
- The Central Conflict (Two opposing forces): "${inputs.conflict}"
- A Strange Anomaly (An unusual rule about the world): "${inputs.anomaly}"

Your task is to create a world name, a core concept, a historical timeline of 3-4 distinct, chronologically ordered eras, and a concise one-sentence summary of the world's anomaly. Each era must build upon the last, creating a compelling and logical history that reflects the user's inputs. Output must be a valid JSON object.`;
    }


    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: foundationSchema, temperature: 0.9 }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating lore foundation:", error);
        throw new Error("Failed to forge the world's foundation. The cosmic energies are unstable.");
    }
};

export const generateLoreFactions = async (foundation: Pick<Lore, 'worldName' | 'coreConcept' | 'timeline'>): Promise<Pick<Lore, 'factions'>> => {
    const prompt = `You are a world-building expert. Based on the established world timeline, generate 3 major factions. Each faction's origin, goals, and ideology MUST be a direct and logical consequence of one or more events in the timeline. Ensure their conflicts are rooted in this history. Output must be a valid JSON object.
World Foundation:
- World Name: ${foundation.worldName}
- Core Concept: ${foundation.coreConcept}
- Historical Timeline:
${foundation.timeline.map(e => `  - ${e.era}: ${e.description}`).join('\n')}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: factionsSchema }
        });
        const data = JSON.parse(response.text);
        // Return factions without sigil image URL, which will be generated later
        return { factions: data.factions.map((f: Omit<Faction, 'sigilImageUrl'>) => ({...f, sigilImageUrl: ''})) };
    } catch (error) {
        console.error("Error generating lore factions:", error);
        throw new Error("Failed to raise the factions. The banners are in disarray.");
    }
};

export const generateLoreCosmology = async (foundation: Pick<Lore, 'worldName' | 'coreConcept' | 'timeline'>, anomaly: string): Promise<Pick<Lore, 'cosmology'>> => {
    const prompt = `You are a world-building expert. Based on the world's foundation, generate its cosmology. The creation myth and deities must be a direct explanation or consequence of the world's core 'anomaly'.
World Foundation:
- World Name: ${foundation.worldName}
- Core Concept: ${foundation.coreConcept}
- The Anomaly: "${anomaly}"
- Historical Timeline:
${foundation.timeline.map(e => `  - ${e.era}: ${e.description}`).join('\n')}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: cosmologySchema }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating lore cosmology:", error);
        throw new Error("Failed to chart the heavens. The stars are scattered.");
    }
};

export const generateLoreMagicSystem = async (foundation: Pick<Lore, 'worldName' | 'coreConcept'>, cosmology: Lore['cosmology']): Promise<Pick<Lore, 'magicSystem'>> => {
    const prompt = `You are a world-building expert. Based on the world's cosmology, define its system of magic. The magic system's source, nature, and rules must be a direct consequence of the deities and creation myth.
World Foundation:
- World Name: ${foundation.worldName}
- Core Concept: ${foundation.coreConcept}
Cosmology:
- Creation Myth: ${cosmology.creationMyth}
- Deities: ${cosmology.deities.map(d => `${d.name} (${d.domain})`).join(', ')}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: magicSystemSchema }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating magic system:", error);
        throw new Error("Failed to weave the arcane arts. The ley lines are tangled.");
    }
};

export const generateLoreInhabitants = async (context: Pick<Lore, 'worldName' | 'coreConcept' | 'timeline' | 'factions' | 'cosmology' | 'magicSystem'>): Promise<Pick<Lore, 'races' | 'creatures' | 'historicalFigures'>> => {
    const prompt = `You are a world-building expert. Based on the complete world context provided below, define its primary inhabitants.
- Races MUST be integrated into the factions and history.
- Creatures MUST be a product of the world's magic or history.
- Historical Figures MUST be pivotal characters from the timeline.
World Context:
- World Name: ${context.worldName}
- Core Concept: ${context.coreConcept}
- Timeline: ${context.timeline.map(e => e.era).join(' -> ')}
- Factions: ${context.factions.map(f => f.name).join(', ')}
- Cosmology: The world was created by... ${context.cosmology.creationMyth.substring(0, 100)}... and is ruled by deities like ${context.cosmology.deities[0]?.name}.
- Magic System: Magic in this world is known as ${context.magicSystem.name}.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: inhabitantsSchema }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error generating inhabitants:", error);
        throw new Error("Failed to populate the world. The lands are barren.");
    }
};

export const generateFinalLoreDetails = async (context: Partial<Lore>): Promise<Pick<Lore, 'locations' | 'secrets'>> => {
    const prompt = `You are a world-building expert. Based on all the established lore, generate the final details.
- Locations MUST be faction headquarters, racial homelands, or sites of major historical/magical events.
- Secrets MUST be unresolved questions from the timeline or related to the hidden agendas of factions or deities.
Full World Lore:
- World Name: ${context.worldName}
- Core Concept: ${context.coreConcept}
- Timeline: ${context.timeline?.map(e => e.era).join(' -> ')}
- Factions: ${context.factions?.map(f => f.name).join(', ')}
- Races: ${context.races?.map(r => r.name).join(', ')}
- Historical Figures: ${context.historicalFigures?.map(h => h.name).join(', ')}`;
    try {
        const locationsPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${prompt}\n\nGenerate the geographical locations.`,
            config: { responseMimeType: 'application/json', responseSchema: locationsSchema }
        });
        const secretsPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${prompt}\n\nGenerate the world secrets.`,
            config: { responseMimeType: 'application/json', responseSchema: secretsSchema }
        });

        const [locationsResult, secretsResult] = await Promise.all([locationsPromise, secretsPromise]);
        return {
            locations: JSON.parse(locationsResult.text).locations,
            secrets: JSON.parse(secretsResult.text).secrets,
        };
    } catch (error) {
        console.error("Error generating final lore details:", error);
        throw new Error("Failed to uncover the world's secrets. The maps are unreadable.");
    }
};

export const generateSigilImage = async (factionName: string, factionDescription: string, worldConcept: string): Promise<string> => {
    try {
        const BLANK_CANVAS_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

        const prompt = `You are a logo designer. Create a complete image from scratch on this blank canvas.
Style: Epic fantasy faction sigil. A minimalist, symbolic emblem on a plain, dark background. Vector logo, clean lines, iconic, fantasy, emblem. Do not include any text or words.

**Faction Details for Sigil:**
- Faction Name: "${factionName}"
- Faction Description: "${factionDescription}"
- World Concept: "${worldConcept}"

**Instruction:** Generate a complete, iconic sigil that visually represents the faction based on the details provided. The final image should be a cohesive logo.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: BLANK_CANVAS_BASE64,
                            mimeType: 'image/png',
                        },
                    },
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:image/png;base64,${base64ImageBytes}`;
            }
        }
        
        throw new Error("No image was generated by the API for the sigil.");
    } catch (error) {
        console.error(`Error generating sigil for ${factionName}:`, error);
        return ''; // Return an empty string on failure, the UI can handle this.
    }
};

export const generateScenario = async (lore: Lore, characterPrefs: { name: string; concept: string }): Promise<Scenario> => {
    try {
        const prompt = `You are a creative writer and game master for a text-based RPG. Generate a unique and compelling high-fantasy scenario that takes place within the established world lore provided below.

The character, setting, and goal must all be consistent with this world and the player's preferences.

World Lore:
- World Name: ${lore.worldName}
- Core Concept: ${lore.coreConcept}
- Playable Races: ${lore.races.map(r => r.name).join(', ')}
- Factions: ${lore.factions.map(f => `${f.name}: ${f.description}`).join('; ')}
- Magic System: ${lore.magicSystem.name} - ${lore.magicSystem.description}
- Key Location: ${lore.locations[0]?.name || 'An unknown land'} - ${lore.locations[0]?.description || 'No description available.'}

Player Character Preferences:
- Preferred Name: "${characterPrefs.name || 'Generate a fitting name'}"
- Character Concept: "${characterPrefs.concept || 'None specified'}"

Instructions:
1. **Adhere strictly to the player's provided Character Concept.** Create a 2-3 sentence backstory that integrates this concept into the world lore. If the concept implies a race (e.g. "Dwarven blacksmith"), use the corresponding race from the lore. **Do not alter the character's fundamental role or status** (e.g., if they say "Royal Guard", do not make them an "ex-Royal Guard").
2. If a name is provided, use it. Otherwise, generate a name that fits the world and character concept.
3. Create a main goal and a first objective that are appropriate for this character and the world.
4. Provide the output in a structured JSON format according to the provided schema.
`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: scenarioSchema,
                temperature: 1,
            }
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating scenario:", error);
        throw new Error("Failed to generate a new world. The mages are resting. Please try again.");
    }
};

export const getNextStepStream = async (gameState: GameState, playerAction: string) => {
    const { lore, scenario, currentLocation, inventory, objective, storyLog, quests } = gameState;
    const { character } = scenario;

    const prompt = `
You are the game master for a text-based RPG. Continue the story based on the player's action. The output must be a valid JSON object.

World Context (This is established fact):
- World Name: ${lore.worldName}
- Core Concept: ${lore.coreConcept}
- Factions: ${lore.factions.map(f => f.name).join(', ')}
- Key Historical Figures: ${lore.historicalFigures.map(h => h.name).join(', ')}
- Races: ${lore.races.map(r => r.name).join(', ')}
- Known Locations: ${lore.locations.map(l => l.name).join(', ') || 'None'}
- Known Characters: ${lore.characters.map(c => c.name).join(', ') || 'None'}
- Known Facts: ${lore.knowledge.join('; ') || 'None'}

Current State:
- Character: ${character.name}, a Level ${character.level} adventurer. ${character.backstory}
- Stats: Health ${character.health}/${character.maxHealth}, Mana ${character.mana}/${character.maxMana}, Stamina ${character.stamina}/${character.maxStamina}
- Experience: ${character.xp}/${character.xpToNextLevel} XP
- Setting: ${scenario.setting.name}.
- Main Goal: ${scenario.goal}
- Current Main Objective: ${objective}
- Active Side Quests: ${quests.filter(q => q.status === 'active').map(q => q.title).join(', ') || 'None'}
- Current Location: ${currentLocation}
- Inventory: [${inventory.map(item => item.name).join(', ')}]
- Recent Events:
${storyLog.slice(-4).map(entry => `${entry.type === 'player' ? '> ' : ''}${entry.text}`).join('\n')}

Player Action: "${playerAction}"

Your tasks:
1. Write a compelling, descriptive narrative in the 'narrative' field. This should describe the scene, character actions, and internal thoughts. DO NOT include spoken words in quotes here.
2. **For all direct speech from NPCs, you MUST use the 'dialogue' array.** Each object in the array should contain the character's name and what they said (without quotes).
3. If the player's action is to 'use' an item (e.g., 'use "health potion"'), apply its effects. For consumables, remove the item from the inventory. Narrate the action and its result. Use 'characterUpdate' to reflect stat changes.
4. Update the 'newObjective' field with the next step for the **main quest**. If the objective hasn't changed, repeat the current one.
5. **Side Quests:**
   - If the player's action logically starts a new side quest, define it in the 'newQuest' field. An objective can be broken down into sub-objectives.
   - If the player's action completes an objective or sub-objective for an existing side quest, report it in the 'questUpdate' field using the exact text of the completed objective.
6. Update the game state (location, inventory, character stats). When adding items, ensure they are complete item objects following the schema. A character dies if health reaches 0.
7. Award experience points (XP) for overcoming challenges or completing objectives using 'xpGained'.
8. Determine if the game is over (player achieved the goal or died).
9. **Lore Discovery:** If the narrative introduces a new, significant, named character or a distinct new location, propose it as a lore update using the 'loreUpdate' field.
10. **Image Generation:** Set 'requestImageGeneration' to true ONLY if the current narrative describes a visually significant event, such as entering a new and distinct area, a dramatic action sequence, or a pivotal plot moment. For simple movements, inventory management, or minor dialogue, keep it false.

Provide your response ONLY in the specified JSON format.
    `;

    try {
        const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: gameStepSchema,
                temperature: 0.8,
            }
        });
        return response;
    } catch(error) {
        console.error("Error getting next game step stream:", error);
        throw new Error("The world seems to be frozen in time. Please try your action again.");
    }
}

export const generateImage = async (
    narrative: string,
    character: Character,
    locationName: string,
    lore: Lore
): Promise<string> => {
    try {
        // A base64 encoded 1x1 transparent PNG. This acts as a blank canvas.
        const BLANK_CANVAS_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

        const generationPrompt = `
You are an expert digital artist. Create a complete scene from scratch on this blank canvas.

**Style:** Digital painting, epic high-fantasy, vibrant but atmospheric lighting, detailed.

**World Context:**
- Genre/Tone: ${lore.coreConcept}.
- World Name: ${lore.worldName}.

**Location:** The scene is set in/at ${locationName}.

**Character to include:**
- Name: ${character.name}.
- Description: ${character.backstory}.

**Scene to create:**
- Narrative Moment: "${narrative}"

**Instruction:** Generate a complete, detailed digital painting that depicts the character within the location, performing the actions or experiencing the moment described in the narrative. The final image should be a cohesive and visually stunning piece of art.
`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: BLANK_CANVAS_BASE64,
                            mimeType: 'image/png',
                        },
                    },
                    { text: generationPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:image/png;base64,${base64ImageBytes}`;
            }
        }
        
        throw new Error("No image was generated by the model.");

    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to conjure a vision of the scene. The aether is cloudy.");
    }
};