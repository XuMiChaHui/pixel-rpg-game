
import React, { useState, useEffect } from 'react';
import { saveSprite, getAllSprites, SpriteKey, getPortrait, clearAllData, savePortrait, getSpriteSourceType } from '../services/spriteStorage';
import { generateNPCPortrait } from '../services/geminiService';
import { INITIAL_NPCS, INITIAL_PLAYER_PORTRAIT_PROMPT } from '../constants';
import { PRELOADED_PORTRAITS } from '../assets';

interface SpriteSetupScreenProps {
  onComplete: (sprites: Record<SpriteKey, string | null>) => void;
  isOverlay?: boolean;
  onClose?: () => void;
}

const CHARACTERS: { key: SpriteKey; name: string; desc: string }[] = [
  { key: 'player', name: '主角 (Player)', desc: '你的冒險形象' },
  { key: 'friend', name: '小林 (Kobayashi)', desc: '位於屋內的青梅竹馬' },
  { key: 'elder', name: '酒鬼爺爺 (Elder)', desc: '位於森林的劍聖' },
];

const PORTRAIT_CHARACTERS = [
    { 
        id: 'player', 
        name: '主角 (Player)', 
        description: INITIAL_PLAYER_PORTRAIT_PROMPT
    },
    ...INITIAL_NPCS
];

const SpriteSetupScreen: React.FC<SpriteSetupScreenProps> = ({ onComplete, isOverlay, onClose }) => {
  const [activeTab, setActiveTab] = useState<'SPRITES' | 'PORTRAITS'>('SPRITES');
  const [sprites, setSprites] = useState<Record<SpriteKey, string | null>>(() => getAllSprites());
  const [portraits, setPortraits] = useState<Record<string, string | null>>({});
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, boolean>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loaded: Record<string, string | null> = {};
    PORTRAIT_CHARACTERS.forEach(char => {
        const stored = getPortrait(char.id);
        const preloaded = PRELOADED_PORTRAITS[char.id];
        loaded[char.id] = stored || preloaded || null;
    });
    setPortraits(loaded);
  }, [refreshKey]);

  const compressImage = (base64Str: string): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.src = base64Str;
          img.onload = () => {
              const MAX_SIZE = 512; 
              let width = img.width, height = img.height;
              if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
              else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
              const canvas = document.createElement('canvas');
              canvas.width = Math.floor(width); canvas.height = Math.floor(height);
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.imageSmoothingEnabled = false;
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  resolve(canvas.toDataURL('image/png'));
              } else resolve(base64Str);
          };
          img.onerror = () => resolve(base64Str);
      });
  };

  const handleUpload = async (key: SpriteKey, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      let result = e.target?.result as string;
      if (result) {
        try { result = await compressImage(result); } catch(e) {}
        const success = saveSprite(key, result);
        setSprites(prev => ({ ...prev, [key]: result }));
        setUnsavedChanges(prev => ({...prev, [key]: !success}));
        setRefreshKey(prev => prev + 1); 
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStart = () => {
    if (!sprites.player) { alert("請至少上傳「主角」的行走圖才能開始遊戲！"); return; }
    onComplete(sprites);
    if (onClose) onClose();
  };

  const handleClearAll = () => {
      if(window.confirm("這將清除所有「瀏覽器暫存」的圖片，並強制重新讀取 'assets.ts' 的檔案路徑。\n\n確定嗎？")) {
          clearAllData();
          window.location.reload(); 
      }
  }

  const handleRegeneratePortrait = async (npcId: string, desc: string) => {
      setGeneratingId(npcId);
      try {
          const newImage = await generateNPCPortrait(desc);
          if (newImage) {
              const success = savePortrait(npcId, newImage);
              setPortraits(prev => ({...prev, [npcId]: newImage}));
              setUnsavedChanges(prev => ({...prev, [`portrait_${npcId}`]: !success}));
          }
      } catch(e) {} finally { setGeneratingId(null); }
  };

  const handleExportCode = () => {
      const code = `
import { SpriteKey } from './services/spriteStorage';
export const PRELOADED_SPRITES: Record<SpriteKey, string | null> = ${JSON.stringify(sprites, null, 2)};
export const PRELOADED_PORTRAITS: Record<string, string | null> = ${JSON.stringify(portraits, null, 2)};
`.trim();
      setGeneratedCode(code);
      navigator.clipboard.writeText(code).then(() => alert("代碼已複製！")).catch(() => alert("複製失敗，請手動複製。"));
  };

  return (
    <div className={`h-screen w-full bg-[#1a1a1a] overflow-y-auto flex flex-col items-center p-6 font-sans text-[#e5e5e5] ${isOverlay ? 'fixed inset-0 z-50 bg-[#1a1a1a]/95 backdrop-blur' : ''}`}>
      <div className="max-w-4xl w-full my-auto flex flex-col items-center py-10">
        <div className="flex items-center justify-between w-full mb-6">
            <h1 className="text-3xl font-bold text-[#fbbf24] pixel-font tracking-widest">{isOverlay ? '遊戲設定' : '素材管理中心'}</h1>
            {isOverlay && onClose && <button onClick={onClose} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold">返回遊戲</button>}
        </div>

        <div className="flex gap-4 mb-8">
            <button onClick={() => setActiveTab('SPRITES')} className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'SPRITES' ? 'bg-[#fbbf24] text-black scale-105' : 'bg-[#333] text-gray-400'}`}>行走圖 (Sprites)</button>
            <button onClick={() => setActiveTab('PORTRAITS')} className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'PORTRAITS' ? 'bg-[#fbbf24] text-black scale-105' : 'bg-[#333] text-gray-400'}`}>人物立繪 (Portraits)</button>
        </div>

        {activeTab === 'SPRITES' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 w-full">
            {CHARACTERS.map((char) => {
                const sourceType = getSpriteSourceType(char.key);
                const isUnsaved = unsavedChanges[char.key];
                let borderColor = 'border-[#404040]', label = '預設', labelColor = 'bg-gray-600';
                if (isUnsaved) { borderColor = 'border-yellow-500'; label = '記憶體暫存'; labelColor = 'bg-yellow-600'; }
                else if (sourceType === 'LOCAL_STORAGE') { borderColor = 'border-green-600'; label = '快取已保存'; labelColor = 'bg-green-600'; }
                else if (sourceType === 'FILE') { borderColor = 'border-blue-500'; label = '本地檔案'; labelColor = 'bg-blue-500'; }

                return (
                    <div key={char.key} className={`bg-[#262626] border-2 ${borderColor} rounded-xl p-6 flex flex-col items-center shadow-lg relative group hover:border-[#fbbf24] transition-colors`}>
                    <h3 className="text-xl font-bold text-white mb-1">{char.name}</h3>
                    <div className="w-32 h-32 bg-[#111] mb-4 flex items-center justify-center rounded relative border border-[#333]">
                        {sprites[char.key] ? (
                            <div className="relative w-full h-full">
                                <img src={sprites[char.key]!} className="w-full h-full object-contain image-pixelated" style={{ imageRendering: 'pixelated' }} />
                                <div className={`absolute top-0 right-0 ${labelColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-bl`}>{label}</div>
                            </div>
                        ) : <span className="text-xs text-gray-600">無圖片</span>}
                    </div>
                    <label className="cursor-pointer bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded text-sm font-bold active:scale-95">更換圖片<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(char.key, e.target.files[0])}/></label>
                    </div>
                );
            })}
            </div>
        )}

        {activeTab === 'PORTRAITS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 w-full">
                {PORTRAIT_CHARACTERS.map(char => {
                    const hasPortrait = !!portraits[char.id];
                    const isFile = portraits[char.id]?.startsWith('/');
                    return (
                        <div key={char.id} className="bg-[#262626] border-2 border-[#404040] rounded-xl p-4 flex gap-4 items-center">
                            <div className="w-24 h-32 bg-black/50 border border-white/10 rounded overflow-hidden relative">
                                {hasPortrait ? <img src={portraits[char.id]!} className="w-full h-full object-cover" /> : <div className="text-gray-600 text-xs p-2">尚未生成</div>}
                                {isFile && <div className="absolute bottom-0 inset-x-0 bg-blue-600 text-white text-[9px] text-center font-bold">本地檔案</div>}
                                {generatingId === char.id && <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-[#fbbf24] text-xs font-bold animate-pulse">繪製中...</div>}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-[#fbbf24]">{char.name}</h4>
                                <button onClick={() => handleRegeneratePortrait(char.id, char.description)} disabled={!!generatingId} className="mt-2 text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50">
                                    {hasPortrait ? '重新生成 (AI)' : '生成立繪 (AI)'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        <div className="w-full border-t border-[#333] pt-6 flex flex-col items-center">
            <div className="flex gap-4 mb-4">
                <button onClick={handleExportCode} className="px-6 py-2 rounded bg-purple-700 text-white font-bold">匯出代碼</button>
                <button onClick={handleClearAll} className="px-6 py-2 rounded border-2 border-red-600 text-red-400 font-bold">重置快取</button>
            </div>
            {generatedCode && <textarea readOnly value={generatedCode} className="w-full h-24 bg-black border border-gray-600 text-[10px] text-green-400 p-2 font-mono rounded" />}
        </div>

        {!isOverlay && <button onClick={handleStart} className="mt-8 px-12 py-3 rounded bg-[#fbbf24] text-black font-bold text-xl shadow-[0_0_15px_rgba(251,191,36,0.5)] active:scale-95">進入遊戲 START</button>}
      </div>
    </div>
  );
};

export default SpriteSetupScreen;
