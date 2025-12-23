
import { GoogleGenAI, Chat, GenerateContentResponse, Type } from "@google/genai";
import { Quest } from '../types';
import { recognizeRuneLocally, Point } from './gestureLogic';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;
let currentPersona: string = '';

export const initChatSession = (systemInstruction: string): Chat => {
  if (!chatSession || currentPersona !== systemInstruction) {
    chatSession = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: systemInstruction,
        temperature: 1.0, 
      },
    });
    currentPersona = systemInstruction;
  }
  return chatSession;
};

export const sendMessageToNPC = async (
    message: string, 
    basePersona: string,
    quests: Quest[],
    inventory: string[]
): Promise<string> => {
  const activeQuests = quests.filter(q => q.status === 'active').map(q => q.title).join(', ');
  const completedQuests = quests.filter(q => q.status === 'completed').map(q => q.title).join(', ');
  const inventoryStr = inventory.length > 0 ? inventory.join(', ') : '無';

  const dynamicContext = `
    [當前遊戲狀態]
    玩家任務: ${activeQuests} | 已完成: ${completedQuests} | 背包: ${inventoryStr}
    請保持角色設定回答。
  `;

  const chat = initChatSession(basePersona + dynamicContext);
  try {
    const result: GenerateContentResponse = await chat.sendMessage({ message });
    return result.text || "...";
  } catch (error) {
    return "（靈魂連結受到干擾...）";
  }
};

/**
 * 現在使用本地幾何邏輯識別手勢，實現零延遲
 */
export const recognizeMagicRune = async (path: Point[]): Promise<string> => {
    // 雖然是同步邏輯，但為了保持接口一致性使用 async
    return recognizeRuneLocally(path);
}

export const generateNPCPortrait = async (description: string): Promise<string | null> => {
    try {
        const prompt = `Japanese RPG style character portrait. Description: ${description}. SOLID BRIGHT GREEN BACKGROUND.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
        });
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (error) { return null; }
}
