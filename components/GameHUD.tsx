
import React, { useRef, useState, useEffect } from 'react';
import { GameState } from '../types';
import { getPortrait, getAllSprites } from '../services/spriteStorage';

interface GameHUDProps {
  gameState: GameState;
  onMove: (dx: number, dy: number) => void;
  onInteract: () => void;
  onOpenSettings: () => void;
}

const GameHUD: React.FC<GameHUDProps> = ({ gameState, onMove, onInteract, onOpenSettings }) => {
  const { playerStats, currentMap } = gameState;
  const moveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dPadRef = useRef<HTMLDivElement>(null);
  const [activeDirection, setActiveDirection] = useState<'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isPortraitMode, setIsPortraitMode] = useState(false);

  // Percentage calculations
  const hpPercent = (playerStats.hp / playerStats.maxHp) * 100;

  // Load Avatar
  useEffect(() => {
    const loadAvatar = async () => {
        const portraitSrc = getPortrait('player');
        const spriteSrc = getAllSprites().player;
        
        let finalSrc = null;
        let isPortrait = false;

        if (portraitSrc) {
             finalSrc = portraitSrc;
             isPortrait = true;
        } else if (spriteSrc) {
             finalSrc = spriteSrc;
             isPortrait = false;
        }

        if (finalSrc) {
            const img = new Image();
            if (finalSrc.startsWith('http')) {
                img.crossOrigin = "Anonymous";
            }
            img.src = finalSrc;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                if (isPortrait) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                } else {
                    const cellW = Math.floor(img.width / 4);
                    const cellH = Math.floor(img.height / 3);
                    canvas.width = cellW;
                    canvas.height = cellH;
                    ctx.drawImage(img, 0, cellH * 2, cellW, cellH, 0, 0, cellW, cellH);
                }

                try {
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
                        const rn = r / 255; const gn = g / 255; const bn = b / 255;
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
                        const isHSLGreen = (h > 75 && h < 165 && s > 0.15 && l > 0.10);
                        const isRGBGreen = (g > r + 20 && g > b + 20);
                        if (isHSLGreen || isRGBGreen) data[i + 3] = 0;
                    }
                    ctx.putImageData(imageData, 0, 0);
                    setAvatarUrl(canvas.toDataURL());
                } catch (e) {
                     setAvatarUrl(finalSrc);
                }
                setIsPortraitMode(isPortrait);
            };
        }
    };
    loadAvatar();
  }, [playerStats]);

  const startMoving = (dx: number, dy: number, dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
      if (activeDirection === dir) return;
      setActiveDirection(dir);
      if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
      onMove(dx, dy);
      moveIntervalRef.current = setInterval(() => {
          onMove(dx, dy);
      }, 150);
  };

  const stopMoving = () => {
      setActiveDirection(null);
      if (moveIntervalRef.current) {
          clearInterval(moveIntervalRef.current);
          moveIntervalRef.current = null;
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      e.preventDefault(); 
      if (!dPadRef.current) return;
      const touch = e.touches[0];
      const rect = dPadRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = touch.clientX - centerX;
      const deltaY = touch.clientY - centerY;

      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
          stopMoving();
          return;
      }

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX > 0) startMoving(1, 0, 'RIGHT');
          else startMoving(-1, 0, 'LEFT');
      } else {
          if (deltaY > 0) startMoving(0, 1, 'DOWN');
          else startMoving(0, -1, 'UP');
      }
  };

  useEffect(() => {
      return () => {
          if (moveIntervalRef.current) clearInterval(moveIntervalRef.current);
      };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-2 z-40">
      
      <div className="flex justify-between items-start w-full">
        <div className="relative flex items-center gap-2 pointer-events-auto hover:scale-105 transition-transform">
           <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-[#3b82f6] bg-[#2d2d2d] overflow-hidden shadow-lg relative z-10 flex items-center justify-center">
               {avatarUrl ? (
                   <img src={avatarUrl} alt="Hero" className={`w-full h-full object-cover ${!isPortraitMode ? 'scale-150' : ''}`} style={{ imageRendering: isPortraitMode ? 'auto' : 'pixelated' }} />
               ) : (
                   <div className="text-white text-xs">?</div>
               )}
               <div className="absolute bottom-0 right-0 bg-black text-white text-[10px] px-1 font-bold">{playerStats.level}</div>
           </div>
           <div className="flex flex-col gap-1 mt-2 -ml-4 pl-6 bg-black/70 pr-3 py-1 rounded-r-lg border border-[#1e3a8a] backdrop-blur-sm min-w-[150px]">
               <div className="flex justify-between text-[#60a5fa] text-xs font-bold font-mono uppercase tracking-wide mb-1">
                   <span>{playerStats.name}</span>
               </div>
               <div className="w-full h-3 bg-gray-800 rounded-sm border border-black relative">
                   <div className="h-full bg-gradient-to-r from-red-600 to-red-400" style={{ width: `${hpPercent}%` }}></div>
               </div>
           </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 top-0 hidden md:block">
             <div className="bg-[#4a0404] border-x-4 border-b-4 border-[#d4af37] px-8 py-1 rounded-b-xl shadow-lg flex flex-col items-center">
                 <span className="text-[#fbbf24] text-[10px] uppercase tracking-[0.2em] font-bold">Region</span>
                 <span className="text-white font-bold text-lg text-shadow-md pixel-font">
                    {currentMap === 'FOREST' ? 'Emerald Woods' : 'Home'}
                 </span>
             </div>
        </div>

        <div className="flex flex-col items-end gap-2 pointer-events-auto">
            <button onClick={onOpenSettings} className="w-10 h-10 bg-gray-800 border-2 border-gray-600 rounded flex items-center justify-center hover:bg-gray-700 active:scale-95 shadow-lg mb-2">
                <span className="text-2xl">⚙️</span>
            </button>
            <div className="flex items-center gap-4 bg-black/60 px-3 py-1 rounded-full border border-[#5c4d3c]">
                <div className="flex items-center gap-1">
                    <span className="text-yellow-400">G</span>
                    <span className="text-white text-xs font-mono">{playerStats.gold}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="flex justify-between items-end px-4 pb-8 pointer-events-auto md:hidden">
             <div ref={dPadRef} className="relative w-40 h-40 bg-black/20 rounded-full border-2 border-white/10 backdrop-blur-sm shadow-xl" onTouchStart={handleTouchMove} onTouchMove={handleTouchMove} onTouchEnd={stopMoving}>
                  <div className={`absolute top-2 left-1/2 -translate-x-1/2 text-2xl ${activeDirection === 'UP' ? 'text-yellow-400' : 'text-white/30'}`}>▲</div>
                  <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 text-2xl ${activeDirection === 'DOWN' ? 'text-yellow-400' : 'text-white/30'}`}>▼</div>
                  <div className={`absolute left-2 top-1/2 -translate-y-1/2 text-2xl ${activeDirection === 'LEFT' ? 'text-yellow-400' : 'text-white/30'}`}>◀</div>
                  <div className={`absolute right-2 top-1/2 -translate-y-1/2 text-2xl ${activeDirection === 'RIGHT' ? 'text-yellow-400' : 'text-white/30'}`}>▶</div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/5"></div>
             </div>
             <button className="w-20 h-20 rounded-full bg-yellow-500 border-4 border-yellow-300 shadow-lg active:scale-95 flex items-center justify-center mb-4" onClick={onInteract}>
                 <span className="font-bold text-[#3d2508] text-xl">A</span>
             </button>
      </div>

      <div className="hidden md:flex justify-end items-end px-4 pb-4 w-full pointer-events-none">
          <div className="bg-black/50 p-2 rounded text-white/50 text-xs">WASD to Move | SPACE to Interact</div>
      </div>

    </div>
  );
};

export default GameHUD;
