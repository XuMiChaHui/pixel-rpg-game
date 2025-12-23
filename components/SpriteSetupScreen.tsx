
import React, { useState, useEffect } from 'react';
// Corrected import: Removed 'isUsingCustomSprite' as it is not exported by '../services/spriteStorage'.
import { saveSprite, getAllSprites, SpriteKey, getPortrait, clearAllData, savePortrait, getSpriteSourceType } from '../services/spriteStorage';
import { generateNPCPortrait } from '../services/geminiService';
import { INITIAL_NPCS } from '../constants';

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
        description: 'Anime boy, red hair, messy energetic hairstyle, young hero, fantasy adventurer clothes, light armor, confident smile, masterpiece, highly detailed, 90s anime style.' 
    },
    ...INITIAL_NPCS
];

const SpriteSetupScreen: React.FC<SpriteSetupScreenProps> = ({ onComplete, isOverlay, onClose }) => {
  const [activeTab, setActiveTab] = useState<'SPRITES' | 'PORTRAITS'>('SPRITES');
  
  // State for images
  const [sprites, setSprites] = useState<Record<SpriteKey, string | null>>(() => getAllSprites());
  const [portraits, setPortraits] = useState<Record<string, string | null>>({});
  
  // Track which items failed to save to localStorage (Memory Only)
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, boolean>>({});

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loaded: Record<string, string | null> = {};
    PORTRAIT_CHARACTERS.forEach(char => {
        if (!portraits[char.id]) {
            loaded[char.id] = getPortrait(char.id);
        } else {
            loaded[char.id] = portraits[char.id];
        }
    });
    setPortraits(prev => ({...prev, ...loaded}));
  }, [refreshKey]);

  const compressImage = (base64Str: string): Promise<string> => {
      return new Promise((resolve) => {
          const img = new Image();
          img.src = base64Str;
          img.onload = () => {
              // Pixel Art shouldn't be too big. 256px is enough for 32px grids (8x8 grid).
              const MAX_SIZE = 512; 
              let width = img.width;
              let height = img.height;
              
              // Maintain aspect ratio
              if (width > height) {
                  if (width > MAX_SIZE) {
                      height *= MAX_SIZE / width;
                      width = MAX_SIZE;
                  }
              } else {
                  if (height > MAX_SIZE) {
                      width *= MAX_SIZE / height;
                      height = MAX_SIZE;
                  }
              }

              const canvas = document.createElement('canvas');
              canvas.width = Math.floor(width);
              canvas.height = Math.floor(height);
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                  // CRITICAL: Disable smoothing to keep pixel art crisp
                  ctx.imageSmoothingEnabled = false;
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  // Export as PNG to keep transparency
                  resolve(canvas.toDataURL('image/png'));
              } else {
                  resolve(base64Str);
              }
          };
          img.onerror = () => resolve(base64Str);
      });
  };

  const handleUpload = async (key: SpriteKey, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      let result = e.target?.result as string;
      if (result) {
        // AUTOMATIC COMPRESSION to save space
        try {
            result = await compressImage(result);
        } catch(e) {
            console.warn("Compression failed, using raw", e);
        }

        const success = saveSprite(key, result);
        setSprites(prev => ({ ...prev, [key]: result }));
        
        if (!success) {
            setUnsavedChanges(prev => ({...prev, [key]: true}));
            // Just a toast/log, don't block user
            console.warn("Storage full - Memory mode active");
        } else {
            setUnsavedChanges(prev => ({...prev, [key]: false}));
        }
        setRefreshKey(prev => prev + 1); 
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStart = () => {
    if (!sprites.player) {
      alert("請至少上傳「主角」的行走圖才能開始遊戲！");
      return;
    }
    // Check if running on memory only
    const memoryMode = Object.values(unsavedChanges).some(v => v);
    if (memoryMode && !isOverlay) {
        if (!confirm("⚠️ 注意：部分圖片未能存入快取 (空間已滿)。\n\n您仍然可以進入遊戲，但請「不要重新整理網頁」，否則圖片會消失。\n\n確定開始嗎？")) {
            return;
        }
    }
    
    onComplete(sprites);
    if (onClose) onClose();
  };

  const handleClearAll = () => {
      if(window.confirm("這將清除所有「瀏覽器暫存」的圖片，並強制重新讀取 'assets.ts' 的檔案路徑。\n\n確定嗎？")) {
          clearAllData();
          setSprites({ player: null, friend: null, elder: null }); 
          setPortraits({});
          setUnsavedChanges({});
          setRefreshKey(prev => prev + 1);
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
              
              if (!success) {
                  setUnsavedChanges(prev => ({...prev, [`portrait_${npcId}`]: true}));
              } else {
                  setUnsavedChanges(prev => ({...prev, [`portrait_${npcId}`]: false}));
              }
          }
      } catch(e) {
          console.error(e);
      } finally {
          setGeneratingId(null);
      }
  };

  const handleExportCode = async () => {
      const currentSprites = sprites; 
      const currentPortraits = portraits;

      const code = `
import { SpriteKey } from './services/spriteStorage';

export const PRELOADED_SPRITES: Record<SpriteKey, string | null> = ${JSON.stringify(currentSprites, null, 2)};

export const PRELOADED_PORTRAITS: Record<string, string | null> = ${JSON.stringify(currentPortraits, null, 2)};
`.trim();

      setGeneratedCode(code);

      try {
          await navigator.clipboard.writeText(code);
          alert("代碼已複製到剪貼簿！請打開 'assets.ts' 並覆蓋內容。");
      } catch (err) {
          const textArea = document.createElement("textarea");
          textArea.value = code;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) alert("代碼已複製到剪貼簿！");
          else alert("自動複製失敗，請手動複製下方文字框。");
      }
  };

  return (
    <div className={`h-screen w-full bg-[#1a1a1a] overflow-y-auto flex flex-col items-center p-6 font-sans text-[#e5e5e5] ${isOverlay ? 'fixed inset-0 z-50 bg-[#1a1a1a]/95 backdrop-blur' : ''}`}>
      <div className="max-w-4xl w-full my-auto flex flex-col items-center py-10">
        
        <div className="flex items-center justify-between w-full mb-6">
            <h1 className="text-3xl font-bold text-[#fbbf24] pixel-font tracking-widest">
            {isOverlay ? '遊戲設定' : '素材管理中心'}
            </h1>
            {isOverlay && onClose && (
                <button onClick={onClose} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold">
                    返回遊戲
                </button>
            )}
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-8">
            <button 
                onClick={() => setActiveTab('SPRITES')}
                className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'SPRITES' ? 'bg-[#fbbf24] text-black scale-105' : 'bg-[#333] text-gray-400'}`}
            >
                行走圖 (Sprites)
            </button>
            <button 
                onClick={() => setActiveTab('PORTRAITS')}
                className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'PORTRAITS' ? 'bg-[#fbbf24] text-black scale-105' : 'bg-[#333] text-gray-400'}`}
            >
                NPC 立繪 (AI Portraits)
            </button>
        </div>

        {Object.values(unsavedChanges).some(v => v) && (
            <div className="w-full bg-yellow-900/50 border border-yellow-500 text-yellow-200 p-3 rounded mb-6 flex items-center gap-2">
                <span>⚠️ 儲存空間已滿，圖片已自動壓縮並載入記憶體。<b>請勿重新整理網頁</b>，否則變更會消失。</span>
            </div>
        )}

        {/* SPRITE SECTION */}
        {activeTab === 'SPRITES' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {CHARACTERS.map((char) => {
                const sourceType = getSpriteSourceType(char.key);
                const isUnsaved = unsavedChanges[char.key];
                
                let borderColor = 'border-[#404040]';
                let label = '預設';
                let labelColor = 'bg-gray-600';

                if (isUnsaved) {
                    borderColor = 'border-yellow-500';
                    label = '記憶體暫存';
                    labelColor = 'bg-yellow-600';
                } else if (sourceType === 'LOCAL_STORAGE') {
                    borderColor = 'border-green-600';
                    label = '瀏覽器快取 (Local)';
                    labelColor = 'bg-green-600';
                } else if (sourceType === 'FILE') {
                    borderColor = 'border-blue-500';
                    label = '本地檔案 (File)';
                    labelColor = 'bg-blue-500';
                }

                let imgSrc = sprites[char.key] || '';
                // Timestamp hack only for FILE types, not Data URIs
                if (sourceType === 'FILE' && imgSrc && !imgSrc.startsWith('data:')) {
                    imgSrc = `${imgSrc}?t=${Date.now()}`; 
                }
                
                return (
                    <div key={char.key} className={`bg-[#262626] border-2 ${borderColor} rounded-xl p-6 flex flex-col items-center shadow-lg relative overflow-hidden group hover:border-[#fbbf24] transition-colors`}>
                    <h3 className="text-xl font-bold text-white mb-1">{char.name}</h3>
                    <p className="text-xs text-gray-500 mb-4">{char.desc}</p>
                    
                    <div className="w-32 h-32 bg-[#111] border border-[#333] mb-4 flex items-center justify-center rounded relative pattern-grid">
                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '8px 8px'}}></div>
                        
                        {sprites[char.key] ? (
                            <div className="relative w-full h-full">
                                <img 
                                    src={imgSrc} 
                                    alt="Preview" 
                                    className="w-full h-full object-contain image-pixelated"
                                    style={{ imageRendering: 'pixelated' }} 
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const errContainer = document.createElement('div');
                                        errContainer.className = "flex flex-col items-center justify-center w-full h-full text-center p-1";
                                        errContainer.innerHTML = `<span class="text-red-500 font-bold text-xs mb-1">❌ 讀取失敗</span>`;
                                        e.currentTarget.parentElement?.appendChild(errContainer);
                                    }}
                                />
                                <div className={`absolute top-0 right-0 ${labelColor} text-white text-[10px] font-bold px-2 py-0.5 rounded-bl shadow`}>
                                    {label}
                                </div>
                            </div>
                        ) : (
                            <span className="text-xs text-gray-600">No Image</span>
                        )}
                    </div>

                    <label className="cursor-pointer bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded text-sm font-bold transition-transform active:scale-95 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        {sourceType !== 'DEFAULT' ? '更換圖片' : '上傳圖片'}
                        <input 
                            type="file" 
                            accept="image/png, image/jpeg" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handleUpload(char.key, e.target.files[0])}
                        />
                    </label>
                    {sourceType === 'FILE' && (
                         <div className="text-[10px] text-gray-500 mt-2 text-center w-full px-2">
                             若檔案存在但讀取失敗<br/>請使用「上傳圖片」
                         </div>
                    )}
                    </div>
                );
            })}
            </div>
        )}

        {/* PORTRAIT SECTION */}
        {activeTab === 'PORTRAITS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                {PORTRAIT_CHARACTERS.map(char => {
                    const hasPortrait = !!portraits[char.id];
                    const isUnsaved = unsavedChanges[`portrait_${char.id}`];
                    
                    return (
                        <div key={char.id} className={`bg-[#262626] border-2 ${isUnsaved ? 'border-yellow-500' : 'border-[#404040]'} rounded-xl p-4 flex gap-4 items-center`}>
                            <div className="w-24 h-32 bg-black/50 border border-white/10 rounded flex-shrink-0 overflow-hidden relative">
                                {hasPortrait ? (
                                    <img src={portraits[char.id]!} className="w-full h-full object-cover" alt="AI Portrait" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs text-center p-1">
                                        尚未生成
                                    </div>
                                )}
                                
                                {isUnsaved ? (
                                    <div className="absolute bottom-0 inset-x-0 bg-yellow-900/90 text-yellow-100 text-[9px] text-center font-bold">記憶體暫存</div>
                                ) : hasPortrait && (
                                    <div className="absolute bottom-0 inset-x-0 bg-green-900/80 text-green-100 text-[9px] text-center font-bold">本地已保存</div>
                                )}
                                
                                {generatingId === char.id && (
                                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-[#fbbf24] text-xs font-bold animate-pulse">繪製中...</div>
                                )}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-[#fbbf24]">{char.name}</h4>
                                <p className="text-xs text-gray-400 line-clamp-2 mb-2">{char.description}</p>
                                <button 
                                    onClick={() => handleRegeneratePortrait(char.id, char.description)}
                                    disabled={!!generatingId}
                                    className={`text-xs px-3 py-1 rounded border ${hasPortrait ? 'border-yellow-600 text-yellow-500 hover:bg-yellow-900/20' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                                >
                                    {hasPortrait ? '重新生成 (Regenerate)' : '生成立繪 (Generate)'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* DEVELOPER TOOLS */}
        <div className="w-full border-t border-[#333] pt-6 flex flex-col items-center">
            <h3 className="text-[#fbbf24] font-bold mb-4 pixel-font">數據修復 (Fix Data)</h3>
            <p className="text-xs text-gray-500 mb-4 text-center max-w-lg leading-relaxed">
                如果圖片顯示不正常，可以嘗試清除快取。如果空間已滿，建議將圖片壓縮或使用匯出功能。
            </p>
            <div className="flex gap-4 mb-4">
                <button 
                    onClick={handleExportCode}
                    className="px-6 py-2 rounded bg-purple-700 hover:bg-purple-600 text-white font-bold transition-colors flex items-center gap-2 shadow-lg"
                >
                    <span className="text-xl">📋</span> 匯出 assets.ts 代碼
                </button>
                <button 
                    onClick={handleClearAll}
                    className="px-6 py-2 rounded border-2 border-red-600 text-red-400 hover:bg-red-900/40 font-bold transition-colors shadow-[0_0_10px_rgba(220,38,38,0.3)] animate-pulse"
                >
                    清除本地快取 (Reset)
                </button>
            </div>
            
            {generatedCode && (
                <div className="w-full animate-in fade-in slide-in-from-bottom-2">
                    <textarea 
                        readOnly
                        value={generatedCode}
                        className="w-full h-32 bg-black border border-gray-600 text-[10px] text-green-400 p-2 font-mono rounded select-all focus:border-yellow-500 outline-none"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                </div>
            )}
        </div>

        {!isOverlay && (
            <div className="mt-8">
                <button 
                    onClick={handleStart}
                    className={`px-12 py-3 rounded bg-[#fbbf24] text-black font-bold text-xl shadow-[0_0_15px_rgba(251,191,36,0.5)] transition-all hover:scale-105 active:scale-95`}
                >
                    進入遊戲 START
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default SpriteSetupScreen;
