
import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameMap from './components/GameMap';
import ChatInterface from './components/ChatInterface';
import GameHUD from './components/GameHUD';
import BattleInterface from './components/BattleInterface';
import SpriteSetupScreen from './components/SpriteSetupScreen';
import { SpriteKey, getAllSprites } from './services/spriteStorage';
import { GameState, NPC, TileType, PlayerStats } from './types';
import { 
  MAPS, 
  PORTALS, 
  INITIAL_PLAYER_POS, 
  INITIAL_NPCS,
  INITIAL_QUESTS,
  MAP_WIDTH, 
  MAP_HEIGHT,
} from './constants';

const INITIAL_STATS: PlayerStats = {
    name: '勇者',
    class: '初級魔法劍士',
    level: 5,
    hp: 120,
    maxHp: 150,
    mp: 45,
    maxMp: 50,
    exp: 25,
    maxExp: 100,
    gold: 100,
    skills: ['slash', 'fireball', 'heal', 'braver']
};

const App: React.FC = () => {
  const [spriteMap, setSpriteMap] = useState<Record<SpriteKey, string | null> | null>(() => {
      const saved = getAllSprites();
      return saved.player ? saved : null;
  });
  
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const keysPressed = useRef<Set<string>>(new Set());
  const lastMoveTime = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState>({
    gameMode: 'ROAM',
    currentMap: 'FOREST',
    playerPos: INITIAL_PLAYER_POS,
    playerDir: 'RIGHT',
    stepFrame: 0,
    activeNpcId: null,
    npcs: INITIAL_NPCS,
    interactionTarget: null,
    playerStats: INITIAL_STATS,
    quests: INITIAL_QUESTS,
    inventory: []
  });

  const startGlobalCamera = async () => {
      try {
          // 放寬約束，確保大多數設備能開啟
          const stream = await navigator.mediaDevices.getUserMedia({ 
              video: { 
                  facingMode: 'user',
                  width: { ideal: 640 },
                  height: { ideal: 480 }
              } 
          });
          setCameraStream(stream);
          return stream;
      } catch (err) {
          console.error("Camera access denied", err);
          alert("無法開啟相機，請檢查權限設定。");
          return null;
      }
  };

  const checkCollision = (mapId: string, x: number, y: number): boolean => {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return true;
    const mapData = MAPS[mapId];
    if (!mapData) return true;
    const tile = mapData[y][x];
    if (tile === TileType.TREE || tile === TileType.WATER || tile === TileType.WALL || tile === TileType.TABLE ||
        tile === TileType.HOUSE_WALL_L || tile === TileType.HOUSE_WALL_M || tile === TileType.HOUSE_WALL_R ||
        tile === TileType.HOUSE_WINDOW || tile === TileType.HOUSE_ROOF_L || tile === TileType.HOUSE_ROOF_M ||
        tile === TileType.HOUSE_ROOF_R || tile === TileType.FENCE_H || tile === TileType.FENCE_V ||
        tile === TileType.BED_HEAD || tile === TileType.BED_FOOT || tile === TileType.BOOKSHELF ||
        tile === TileType.CABINET || tile === TileType.POT_PLANT) return true;
    const npc = gameState.npcs?.find(n => n.mapId === mapId && n.pos.x === x && n.pos.y === y);
    if (npc) return true;
    return false;
  };

  const handleMove = useCallback((dx: number, dy: number) => {
    if (gameState.gameMode !== 'ROAM' || isSetupOpen || !spriteMap) return;
    setGameState(prev => {
      const newX = prev.playerPos.x + dx;
      const newY = prev.playerPos.y + dy;
      let newDir = prev.playerDir;
      if (dx > 0) newDir = 'RIGHT'; else if (dx < 0) newDir = 'LEFT'; else if (dy < 0) newDir = 'UP'; else if (dy > 0) newDir = 'DOWN';
      if (checkCollision(prev.currentMap, newX, newY)) return { ...prev, playerDir: newDir as any };
      const portalKey = `${prev.currentMap}-${newX},${newY}`;
      const portal = PORTALS[portalKey];
      if (portal) return { ...prev, currentMap: portal.mapId, playerPos: portal.pos, interactionTarget: null, playerDir: newDir as any };
      let targetId: string | null = null;
      const checkOffsets = [[0,1], [0,-1], [1,0], [-1,0]];
      for (let offset of checkOffsets) {
          const tx = newX + offset[0]; const ty = newY + offset[1];
          const npc = prev.npcs?.find(n => n.mapId === prev.currentMap && n.pos.x === tx && n.pos.y === ty);
          if (npc) { targetId = npc.id; break; }
      }
      return { ...prev, playerPos: { x: newX, y: newY }, playerDir: newDir as any, activeNpcId: targetId };
    });
  }, [gameState.gameMode, isSetupOpen, gameState.currentMap, gameState.npcs, spriteMap]);

  const handleInteraction = useCallback(() => {
    if (gameState.gameMode !== 'ROAM' || isSetupOpen || !spriteMap) return;
    if (gameState.activeNpcId) {
      setGameState(prev => ({ ...prev, gameMode: 'CHAT' }));
      keysPressed.current.clear();
    }
  }, [gameState.activeNpcId, gameState.gameMode, isSetupOpen, spriteMap]);

  const updateNPC = (updated: NPC) => {
      setGameState(prev => ({ ...prev, npcs: prev.npcs.map(n => n.id === updated.id ? updated : n) }));
  };

  const handleBattleStart = () => {
      setGameState(prev => ({ ...prev, gameMode: 'BATTLE' }));
  };

  const handleBattleEnd = (result: 'WIN' | 'LOSE' | 'ESCAPE') => {
      if (result === 'WIN') {
          setGameState(prev => ({ ...prev, gameMode: 'ROAM', playerStats: { ...prev.playerStats, exp: prev.playerStats.exp + 50 } }));
      } else if (result === 'LOSE') {
          setGameState(prev => ({ ...prev, gameMode: 'ROAM', currentMap: 'HOUSE', playerPos: { x: 14, y: 7 }, playerStats: { ...prev.playerStats, hp: prev.playerStats.maxHp } }));
      } else {
          setGameState(prev => ({ ...prev, gameMode: 'ROAM' }));
      }
      keysPressed.current.clear();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState.gameMode !== 'ROAM' || isSetupOpen) return;
        keysPressed.current.add(e.key.toLowerCase());
        if ([' ', 'enter'].includes(e.key.toLowerCase())) handleInteraction();
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [handleInteraction, gameState.gameMode, isSetupOpen]);

  useEffect(() => {
      let animationFrameId: number;
      const loop = (time: number) => {
          if (gameState.gameMode === 'ROAM' && !isSetupOpen && spriteMap) {
              const MOVEMENT_DELAY = 100; 
              if (time - lastMoveTime.current > MOVEMENT_DELAY) {
                  const keys = keysPressed.current;
                  let dx = 0, dy = 0;
                  if (keys.has('w') || keys.has('arrowup')) dy = -1;
                  else if (keys.has('s') || keys.has('arrowdown')) dy = 1;
                  else if (keys.has('a') || keys.has('arrowleft')) dx = -1;
                  else if (keys.has('d') || keys.has('arrowright')) dx = 1;
                  if (dx !== 0 || dy !== 0) { handleMove(dx, dy); lastMoveTime.current = time; }
              }
          }
          animationFrameId = requestAnimationFrame(loop);
      };
      animationFrameId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animationFrameId);
  }, [handleMove, gameState.gameMode, isSetupOpen, spriteMap]);

  const activeNPC = gameState.npcs?.find(n => n.id === gameState.activeNpcId);

  if (!spriteMap) return <SpriteSetupScreen onComplete={setSpriteMap} />;

  return (
    <div className="w-full h-screen bg-[#111] flex items-center justify-center relative overflow-hidden touch-none">
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')]"></div>
      <div className={`relative shadow-2xl transition-transform ${isSetupOpen ? 'blur-sm brightness-50' : ''}`}>
        <GameMap gameState={gameState} spriteMap={spriteMap} />
        {gameState.gameMode === 'ROAM' && activeNPC && !isSetupOpen && (
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[80px] z-10 animate-bounce hidden md:block">
               <div className="bg-black/80 text-yellow-400 border border-yellow-500 px-3 py-1 rounded text-xs font-bold whitespace-nowrap">[空白鍵] 交談</div>
               <div className="w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-yellow-500 border-r-[6px] border-r-transparent mx-auto"></div>
           </div>
        )}
      </div>

      {gameState.gameMode === 'ROAM' && (
        <GameHUD gameState={gameState} onMove={handleMove} onInteract={handleInteraction} onOpenSettings={() => setIsSetupOpen(true)} />
      )}

      {isSetupOpen && (
          <div className="absolute inset-0 z-[60]">
             <SpriteSetupScreen onComplete={(updatedSprites) => setSpriteMap(updatedSprites)} isOverlay={true} onClose={() => { setIsSetupOpen(false); keysPressed.current.clear(); }} />
          </div>
      )}

      {gameState.gameMode === 'CHAT' && activeNPC && (
        <ChatInterface 
            npc={activeNPC} quests={gameState.quests} inventory={gameState.inventory}
            onClose={() => setGameState(prev => ({ ...prev, gameMode: 'ROAM' }))} 
            onUpdateNPC={updateNPC} onStartBattle={handleBattleStart}
        />
      )}

      {gameState.gameMode === 'BATTLE' && activeNPC && (
          <BattleInterface 
             player={gameState.playerStats} enemy={activeNPC}
             cameraStream={cameraStream} onStartCamera={startGlobalCamera}
             onClose={handleBattleEnd}
          />
      )}
    </div>
  );
};

export default App;
