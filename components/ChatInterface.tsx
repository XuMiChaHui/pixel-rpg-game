
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, NPC, Quest } from '../types';
import { sendMessageToNPC, generateNPCPortrait } from '../services/geminiService';
import { getPortrait, savePortrait } from '../services/spriteStorage';

interface ChatInterfaceProps {
  npc: NPC;
  quests: Quest[];
  inventory: string[];
  onClose: () => void;
  onUpdateNPC: (updatedNPC: NPC) => void;
  onStartBattle: () => void; // New Callback
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ npc, quests, inventory, onClose, onUpdateNPC, onStartBattle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const hasTriggeredGen = useRef(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);

  const [displayedText, setDisplayedText] = useState('');
  const [fullTextToDisplay, setFullTextToDisplay] = useState('');

  // Robust Green Screen Removal
  const removeBackgroundSmart = (base64Url: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64Url); return; }
            ctx.drawImage(img, 0, 0);
            
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    
                    // RGB Normalized
                    const rn = r / 255;
                    const gn = g / 255;
                    const bn = b / 255;
                    
                    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
                    let h = 0, s = 0, l = (max + min) / 2;

                    if (max !== min) {
                        const d = max - min;
                        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                        switch (max) {
                            case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
                            case gn: h = (bn - rn) / d + 2; break;
                            case bn: h = (rn - gn) / d + 4; break;
                        }
                        h *= 60;
                    }

                    // Widen Hue range (75-165 covers almost all greens)
                    // Lower saturation (0.15 allows for dull greens)
                    const isHSLGreen = (h > 75 && h < 165 && s > 0.15 && l > 0.10);
                    
                    // Direct RGB Check: Green is significantly higher than Red/Blue
                    const isRGBGreen = (g > r + 20 && g > b + 20);

                    if (isHSLGreen || isRGBGreen) {
                        data[i + 3] = 0; // Transparent
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL());
            } catch (e) {
                // If canvas is tainted (CORS error), return original
                resolve(base64Url);
            }
        };
        img.onerror = () => resolve(base64Url);
        img.src = base64Url;
    });
  };

  useEffect(() => {
    // 1. Check storage first
    const storedPortrait = getPortrait(npc.id);
    
    // 2. Decide source
    const portraitToUse = storedPortrait || npc.generatedPortraitUrl;

    if (portraitToUse) {
        removeBackgroundSmart(portraitToUse).then(setProcessedImage);
    } else {
        setProcessedImage(null);
        
        // 3. Generate if missing
        if (!hasTriggeredGen.current) {
            hasTriggeredGen.current = true;
            setIsGeneratingImage(true);
            generateNPCPortrait(npc.description).then(async (base64Url) => {
                if (base64Url) {
                    savePortrait(npc.id, base64Url); // SAVE PERSISTENTLY
                    onUpdateNPC({ ...npc, generatedPortraitUrl: base64Url });
                }
                setIsGeneratingImage(false);
            }).catch(() => setIsGeneratingImage(false));
        }
    }
  }, [npc.id, npc.generatedPortraitUrl]);

  useEffect(() => {
    // Initial dynamic greeting
    let greeting = '';
    if (npc.id === 'elder') {
        if (inventory.includes('古老酒葫蘆')) greeting = '哦？！那香味... 難道是我的酒？！';
        else greeting = '唉... 沒有酒，這劍也舞不動啊...';
    } else {
        greeting = '今天的天氣真適合冒險呢！';
    }
    setMessages([{ role: 'model', text: greeting }]);
    setFullTextToDisplay(greeting);
  }, [npc.id, inventory]); 

  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    if (!fullTextToDisplay) return;
    const interval = setInterval(() => {
        setDisplayedText((prev) => {
            if (index >= fullTextToDisplay.length) { clearInterval(interval); return prev; }
            const nextChar = fullTextToDisplay.charAt(index);
            index++;
            return prev + nextChar;
        });
    }, 30); 
    return () => clearInterval(interval);
  }, [fullTextToDisplay]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    setFullTextToDisplay('...'); 

    try {
      const responseText = await sendMessageToNPC(inputText, npc.persona, quests, inventory);
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
      setFullTextToDisplay(responseText); 
    } catch (e) {
      setFullTextToDisplay("...");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
    if (e.key === 'Escape') onClose();
    e.stopPropagation();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end p-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full h-full max-w-5xl mx-auto pointer-events-none">
        <div className="absolute bottom-0 left-[-10px] md:left-20 w-[90%] md:w-[60%] h-[100%] z-10 flex items-end justify-start overflow-visible pointer-events-none">
             <div className="relative w-full h-full flex items-end">
                {processedImage ? (
                    <img src={processedImage} alt={npc.name} className="max-h-[85vh] w-auto object-contain animate-in slide-in-from-bottom-10 duration-700 origin-bottom drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
                ) : (
                    <div className="w-full h-2/3 flex items-center justify-center pl-20">
                         {isGeneratingImage && <div className="text-[#fbbf24] font-bold text-xs animate-pulse">繪製中...</div>}
                    </div>
                )}
             </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4 md:bottom-8 md:left-[20%] md:right-[20%] z-20 pointer-events-auto">
            <div className="bg-[#1f1a16]/90 border-[4px] border-[#5e4b35] rounded-lg shadow-xl flex flex-col min-h-[160px] relative">
                <div className="absolute -top-5 left-6 bg-[#d4af37] px-6 py-1 border-2 border-[#5e4b35] shadow-md transform -skew-x-12 z-30">
                     <span className="text-[#1f1a16] font-extrabold text-sm tracking-widest transform skew-x-12 inline-block font-sans whitespace-nowrap">{npc.name}</span>
                </div>
                <button onClick={onClose} className="absolute -top-4 -right-2 w-10 h-10 bg-red-800 hover:bg-red-600 border-2 border-[#ff9999] rounded-full text-white font-bold flex items-center justify-center z-50">X</button>
                <div className="p-6 pt-8 flex-1">
                    <p className="text-[#e2dacd] text-lg font-medium leading-relaxed font-sans">{displayedText}</p>
                </div>
                <div className="bg-[#151210]/95 p-3 border-t border-[#3d3124] flex flex-col sm:flex-row items-center gap-3 rounded-b-lg">
                    <div className="flex-1 w-full flex gap-2">
                        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 bg-[#0a0908] border border-[#3d3124] text-[#e2dacd] px-3 py-2 outline-none focus:border-[#d4af37] font-sans text-base rounded" placeholder="回應..." autoFocus />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={handleSend} disabled={isLoading} className="flex-1 sm:flex-none px-6 py-2 bg-[#d4af37] hover:bg-[#fcd34d] text-[#1f1a16] text-sm font-bold rounded shadow-lg whitespace-nowrap">
                            送出
                        </button>
                        <button onClick={onStartBattle} className="flex-1 sm:flex-none px-4 py-2 bg-red-800 hover:bg-red-600 border border-red-500 text-white text-sm font-bold rounded shadow-lg whitespace-nowrap flex items-center gap-2 justify-center">
                            <span>⚔️</span> 決鬥
                        </button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
export default ChatInterface;
