
import React, { useRef, useEffect, useState } from 'react';
import { GameState, TileType, NPC } from '../types';
import { SpriteKey } from '../services/spriteStorage';
import { TILE_SIZE, MAPS, MAP_WIDTH, MAP_HEIGHT } from '../constants';

interface GameMapProps {
  gameState: GameState;
  spriteMap: Record<SpriteKey, string | null>;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
    type: 'leaf' | 'sparkle' | 'smoke';
}

// Visual Configuration - DARK FOREST PALETTE
const PALETTE = {
    // Terrain: Darker / Realistic Green
    GRASS_BASE: '#14532d', GRASS_DARK: '#052e16', GRASS_LIGHT: '#166534',
    
    // Water: Deep Blue
    WATER_BASE: '#1e3a8a', WATER_LIGHT: '#3b82f6', WATER_DEEP: '#172554',
    
    // Objects
    SHRINE_RED: '#b91c1c', SHRINE_WOOD: '#450a0a', SHRINE_ROOF: '#262626',
    SHADOW: 'rgba(0,0,0,0.5)',
    
    // House Palette (Cottage)
    ROOF_MAIN: '#7f1d1d', ROOF_LIGHT: '#991b1b', ROOF_SHADOW: '#450a0a',
    WALL_PLASTER: '#e7e5e4', WALL_WOOD: '#451a03',
    WINDOW_GLASS: '#60a5fa', WINDOW_GLOW: '#93c5fd',
    
    // Interior
    FLOOR_WOOD_LIGHT: '#b45309', FLOOR_WOOD_DARK: '#78350f',
    RUG_RED: '#881337', RUG_GOLD: '#d97706',
    BED_SHEET: '#e5e5e5', BED_BLANKET: '#1e40af', BED_WOOD: '#451a03',
    BOOK_RED: '#b91c1c', BOOK_BLUE: '#1d4ed8', BOOK_GREEN: '#15803d',
    // Path
    PATH_STONE_1: '#78716c', PATH_STONE_2: '#57534e', PATH_DIRT: '#5c4033'
};

// Physics Settings - Tuned for smooth animation with 100ms logic tick
const MOVE_SPEED = 4; 

const GameMap: React.FC<GameMapProps> = ({ gameState, spriteMap }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Latest state ref to allow render loop to access fresh data without restarting
  const gameStateRef = useRef(gameState);
  
  // Track map to handle instant teleportation
  const lastMapRef = useRef(gameState.currentMap);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Camera & Visual State
  const cameraRef = useRef({ x: 0, y: 0 });
  const playerVisualRef = useRef({ x: gameState.playerPos.x * TILE_SIZE, y: gameState.playerPos.y * TILE_SIZE });
  const particlesRef = useRef<Particle[]>([]);
  
  // Sprite System
  const [loadedSprites, setLoadedSprites] = useState<Record<string, HTMLImageElement>>({});

  // --- 1. ROBUST IMAGE LOADING & BACKGROUND REMOVAL ---
  useEffect(() => {
    const processSpriteSheet = async (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            // SECURITY FIX: Only use Anonymous CORS for remote HTTP/HTTPS URLs.
            if (src.startsWith('http')) {
                img.crossOrigin = 'Anonymous';
            }
            
            img.src = src;
            
            img.onload = () => {
                // Optimization: Skip processing for simple local paths
                if (src.startsWith('./') || src.startsWith('/')) {
                    resolve(img);
                    return;
                }

                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(img); return; }
                
                try {
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        
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
                        
                        // --- HYBRID ALGORITHM ---
                        const isHSLGreen = (h > 75 && h < 165 && s > 0.15 && l > 0.10);
                        const isRGBGreen = (g > r + 20 && g > b + 20);

                        if (isHSLGreen || isRGBGreen) {
                             data[i + 3] = 0;
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                    const processedImg = new Image();
                    processedImg.src = canvas.toDataURL();
                    processedImg.onload = () => resolve(processedImg);
                } catch (err) {
                    console.warn("Canvas Tainted - using raw image:", err);
                    resolve(img);
                }
            };
            img.onerror = (e) => {
                reject(e);
            };
        });
    };

    const loadAllSprites = async () => {
        const newSprites: Record<string, HTMLImageElement> = {};
        const loadAndAssign = async (key: string, src: string | null) => {
            if (src) {
                try {
                    const img = await processSpriteSheet(src);
                    newSprites[key] = img;
                } catch (e) { 
                    // Silent fail
                }
            }
        };
        await Promise.all([
            loadAndAssign('player', spriteMap.player),
            loadAndAssign('friend', spriteMap.friend),
            loadAndAssign('elder', spriteMap.elder)
        ]);
        setLoadedSprites(newSprites);
    };
    loadAllSprites();
  }, [spriteMap]);

  // --- 2. MAIN RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let animationId: number;
    let frameCount = 0;
    let isRunning = true;

    const render = () => {
        if (!isRunning) return;
        frameCount++;
        
        const currentGameState = gameStateRef.current;
        const mapId = currentGameState.currentMap;

        // --- MAP CHANGE CHECK ---
        if (mapId !== lastMapRef.current) {
            playerVisualRef.current.x = currentGameState.playerPos.x * TILE_SIZE;
            playerVisualRef.current.y = currentGameState.playerPos.y * TILE_SIZE;
            lastMapRef.current = mapId;
            particlesRef.current = [];
        }

        // --- PHYSICS ---
        const targetX = currentGameState.playerPos.x * TILE_SIZE;
        const targetY = currentGameState.playerPos.y * TILE_SIZE;
        const dx = targetX - playerVisualRef.current.x;
        const dy = targetY - playerVisualRef.current.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        let isMoving = false;

        if (dist < MOVE_SPEED) {
            // Snap to target if very close
            playerVisualRef.current.x = targetX;
            playerVisualRef.current.y = targetY;
        } else {
            const angle = Math.atan2(dy, dx);
            playerVisualRef.current.x += Math.cos(angle) * MOVE_SPEED;
            playerVisualRef.current.y += Math.sin(angle) * MOVE_SPEED;
            isMoving = true;
        }

        const gridUnitsX = playerVisualRef.current.x / TILE_SIZE;
        const gridUnitsY = playerVisualRef.current.y / TILE_SIZE;
        const walkParity = Math.floor(gridUnitsX + gridUnitsY + 0.5) % 2;
        let animRow = 2; 
        if (isMoving) animRow = Math.abs(walkParity) === 0 ? 0 : 1;

        // --- CAMERA ---
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        let camX = playerVisualRef.current.x + (TILE_SIZE/2) - (canvasW / 2);
        let camY = playerVisualRef.current.y + (TILE_SIZE/2) - (canvasH / 2);
        camX = Math.max(0, Math.min(camX, (MAP_WIDTH * TILE_SIZE) - canvasW));
        camY = Math.max(0, Math.min(camY, (MAP_HEIGHT * TILE_SIZE) - canvasH));
        const finalCamX = Math.floor(camX);
        const finalCamY = Math.floor(camY);
        cameraRef.current = { x: finalCamX, y: finalCamY };

        // --- DRAWING ---
        ctx.fillStyle = '#0f172a'; // Dark background
        ctx.fillRect(0, 0, canvasW, canvasH);
        
        ctx.save();
        ctx.translate(-finalCamX, -finalCamY);

        const mapData = MAPS[mapId];
        
        if (mapData) {
            // 1. Ground Layer
            for(let y=0; y<MAP_HEIGHT; y++) {
                for(let x=0; x<MAP_WIDTH; x++) {
                    const t = mapData[y][x];
                    
                    // Draw base layer first
                    if (mapId === 'FOREST') {
                        drawTile(ctx, x, y, TileType.GRASS, frameCount, mapId);
                    } else if (mapId === 'HOUSE') {
                         // Interior void check
                        if (t === TileType.FLOOR || t >= 40 || t === 9 || t === 4) {
                             drawTile(ctx, x, y, TileType.FLOOR, frameCount, mapId);
                        }
                    }

                    if (t === TileType.WATER || t === TileType.PATH || t === TileType.RUG_C || t === TileType.LILYPAD) {
                         drawTile(ctx, x, y, t, frameCount, mapId);
                    }
                }
            }

            // 2. Y-Sort Entities
            const entities = [];

            // NPCs
            const mapNpcs = (currentGameState.npcs || []).filter(n => n.mapId === mapId);
            mapNpcs.forEach(npc => {
                entities.push({
                    type: 'npc',
                    y: npc.pos.y * TILE_SIZE,
                    sortY: npc.pos.y * TILE_SIZE + TILE_SIZE,
                    x: npc.pos.x * TILE_SIZE,
                    data: npc
                });
            });

            // Player
            entities.push({
                type: 'player',
                y: playerVisualRef.current.y,
                sortY: playerVisualRef.current.y + TILE_SIZE,
                x: playerVisualRef.current.x,
                animRow: animRow, 
                data: null
            });

            // Objects
            for(let y=0; y<MAP_HEIGHT; y++) {
                for(let x=0; x<MAP_WIDTH; x++) {
                    const t = mapData[y][x];
                    if (t === TileType.TREE || t === TileType.SHRINE || t === TileType.WALL || 
                        t === TileType.DOOR || (t >= 20 && t <= 28) || t >= 30 || t === TileType.FLOWER) {
                        
                        if (t === TileType.RUG_C || t === TileType.LILYPAD) continue;

                        entities.push({
                            type: 'obj',
                            y: y * TILE_SIZE,
                            sortY: (y + 1) * TILE_SIZE, 
                            x: x * TILE_SIZE,
                            tile: t
                        });
                    }
                    
                    if (t === TileType.CHIMNEY && frameCount % 20 === 0) {
                        particlesRef.current.push({
                            x: (x * TILE_SIZE) + 16,
                            y: (y * TILE_SIZE) - 4,
                            vx: (Math.random() - 0.5) * 0.5 + 0.5, 
                            vy: -1 - Math.random(),
                            life: 100,
                            color: `rgba(200,200,200,${0.3 + Math.random()*0.3})`,
                            size: 4 + Math.random() * 4,
                            type: 'smoke'
                        });
                    }
                }
            }

            entities.sort((a, b) => a.sortY - b.sortY);

            // 3. Render Entities
            entities.forEach(ent => {
                if (ent.type === 'obj') {
                    // @ts-ignore
                    drawObject(ctx, ent.x / TILE_SIZE, ent.y / TILE_SIZE, ent.tile, frameCount);
                } else if (ent.type === 'player') {
                    const playerImg = loadedSprites['player'];
                    if (playerImg) {
                        drawCharacter(ctx, playerImg, ent.x, ent.y, currentGameState.playerDir, ent.animRow);
                    } else {
                        ctx.fillStyle = '#3b82f6';
                        ctx.fillRect(ent.x + 8, ent.y + 4, 16, 24);
                    }
                } else if (ent.type === 'npc') {
                    const npcData = ent.data as NPC;
                    const npcImg = loadedSprites[npcData.id];
                    if (npcImg) {
                        drawCharacter(ctx, npcImg, ent.x, ent.y, 'DOWN', 2);
                    } else {
                        drawSimpleNPC(ctx, ent.x, ent.y, npcData);
                    }
                }
            });
        }
        
        // --- PARTICLES ---
        if (mapId === 'FOREST' && Math.random() < 0.05) {
            particlesRef.current.push({
                x: finalCamX + Math.random() * canvasW,
                y: finalCamY + Math.random() * canvasH,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                life: 60,
                color: 'rgba(255,255,255,0.1)', 
                size: 2,
                type: 'sparkle'
            });
        }

        if (isMoving && frameCount % 12 === 0) {
            particlesRef.current.push({
                x: playerVisualRef.current.x + 16, 
                y: playerVisualRef.current.y + 28,
                vx: (Math.random()-0.5), vy: -0.5, life: 8,
                color: 'rgba(255,255,255,0.3)', size: 2,
                type: 'sparkle'
            });
        }
        
        particlesRef.current.forEach(p => {
            if (p.type === 'smoke') {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                ctx.fill();
                p.x += p.vx; p.y += p.vy; 
                p.size += 0.05;
                p.life--;
            } else {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
                p.x += p.vx; p.y += p.vy; p.life--;
            }
        });
        particlesRef.current = particlesRef.current.filter(p => p.life > 0);

        ctx.restore();
        animationId = requestAnimationFrame(render);
    };

    render();
    return () => {
        isRunning = false;
        cancelAnimationFrame(animationId);
    };
  }, [loadedSprites]);

  // --- HELPER DRAW FUNCTIONS ---

  const drawTile = (ctx: CanvasRenderingContext2D, x: number, y: number, type: number, frame: number, mapId: string) => {
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      
      switch(type) {
          case TileType.GRASS:
               if (mapId === 'FOREST') {
                  ctx.fillStyle = PALETTE.GRASS_BASE;
                  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                  // Darker Pattern
                  const noise = (Math.sin(x * 123 + y * 765) + 1) / 2;
                  if (noise > 0.8) {
                      ctx.fillStyle = PALETTE.GRASS_LIGHT;
                      ctx.fillRect(px + 4, py + 4, 3, 3);
                  } else if (noise < 0.2) {
                      ctx.fillStyle = PALETTE.GRASS_DARK;
                      ctx.fillRect(px + 10, py + 20, 4, 4);
                  }
               }
              break;
          case TileType.WATER:
              ctx.fillStyle = PALETTE.WATER_BASE;
              ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
              const wave = Math.sin(frame/20 + x + y) * 2;
              ctx.fillStyle = PALETTE.WATER_LIGHT;
              ctx.fillRect(px + 4, py + 14 + wave, 24, 2);
              break;
          case TileType.LILYPAD:
              ctx.fillStyle = PALETTE.WATER_BASE;
              ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
              ctx.fillStyle = '#064e3b';
              ctx.beginPath();
              ctx.ellipse(px+16, py+18, 10, 8, 0, 0, Math.PI*2);
              ctx.fill();
              ctx.fillStyle = '#10b981';
              ctx.beginPath();
              ctx.arc(px+16, py+18, 3, 0, Math.PI*2);
              ctx.fill();
              break;
          case TileType.PATH:
              ctx.fillStyle = PALETTE.GRASS_BASE;
              ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
              const stones = [
                  {ox: 2, oy: 2, w: 12, h: 10, c: PALETTE.PATH_STONE_1},
                  {ox: 16, oy: 4, w: 14, h: 12, c: PALETTE.PATH_STONE_2},
                  {ox: 4, oy: 14, w: 10, h: 14, c: PALETTE.PATH_STONE_2},
                  {ox: 18, oy: 18, w: 12, h: 12, c: PALETTE.PATH_STONE_1}
              ];
              const variation = ((x * 31 + y * 17) % 3);
              stones.forEach((s, i) => {
                  if (variation === 1 && i === 3) return;
                  ctx.fillStyle = s.c;
                  ctx.beginPath();
                  ctx.roundRect(px + s.ox, py + s.oy, s.w, s.h, 4);
                  ctx.fill();
                  ctx.fillStyle = 'rgba(0,0,0,0.2)';
                  ctx.fillRect(px + s.ox + 2, py + s.oy + 2, 2, 2);
              });
              break;
          case TileType.FLOOR:
              ctx.fillStyle = PALETTE.FLOOR_WOOD_DARK;
              ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
              ctx.fillStyle = PALETTE.FLOOR_WOOD_LIGHT;
              ctx.fillRect(px, py, TILE_SIZE, 6);
              ctx.fillRect(px, py+8, TILE_SIZE, 6);
              ctx.fillRect(px, py+16, TILE_SIZE, 6);
              ctx.fillRect(px, py+24, TILE_SIZE, 6);
              ctx.fillStyle = '#451a03';
              if ((x+y)%2 === 0) {
                  ctx.fillRect(px+2, py+2, 2, 2);
                  ctx.fillRect(px+2, py+10, 2, 2);
              } else {
                  ctx.fillRect(px+30, py+18, 2, 2);
              }
              break;
          case TileType.RUG_C:
               drawTile(ctx, x, y, TileType.FLOOR, frame, mapId);
               ctx.fillStyle = PALETTE.RUG_RED;
               ctx.fillRect(px+2, py+2, TILE_SIZE-4, TILE_SIZE-4);
               ctx.strokeStyle = PALETTE.RUG_GOLD;
               ctx.lineWidth = 2;
               ctx.strokeRect(px+4, py+4, TILE_SIZE-8, TILE_SIZE-8);
               break;
      }
  };

  const drawObject = (ctx: CanvasRenderingContext2D, x: number, y: number, type: number, frame: number) => {
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      
      switch(type) {
        case TileType.BED_HEAD:
             ctx.fillStyle = 'rgba(0,0,0,0.2)';
             ctx.fillRect(px+4, py+28, 24, 4);
             ctx.fillStyle = PALETTE.BED_WOOD;
             ctx.fillRect(px+2, py+6, 28, 26); 
             ctx.fillStyle = '#5c2b0e';
             ctx.fillRect(px+6, py+10, 20, 14);
             ctx.fillStyle = '#a3a3a3';
             ctx.fillRect(px+5, py+20, 22, 10);
             ctx.fillStyle = PALETTE.BED_SHEET;
             ctx.fillRect(px+5, py+18, 22, 10);
             break;
        case TileType.BED_FOOT:
             ctx.fillStyle = 'rgba(0,0,0,0.2)';
             ctx.fillRect(px+4, py+28, 24, 4);
             ctx.fillStyle = '#d4d4d4';
             ctx.fillRect(px+2, py, 28, 26);
             ctx.fillStyle = PALETTE.BED_BLANKET;
             ctx.fillRect(px+2, py+6, 28, 20);
             ctx.fillStyle = '#1e3a8a';
             ctx.fillRect(px+2, py+26, 28, 4);
             ctx.fillRect(px+28, py+6, 2, 24);
             ctx.fillStyle = '#60a5fa';
             ctx.fillRect(px+4, py+6, 24, 2);
             break;
        case TileType.BOOKSHELF:
             ctx.fillStyle = PALETTE.BED_WOOD;
             ctx.fillRect(px+4, py+4, 24, 28);
             ctx.fillStyle = '#451a03';
             ctx.fillRect(px+6, py+12, 20, 2);
             ctx.fillRect(px+6, py+22, 20, 2);
             const colors = [PALETTE.BOOK_RED, PALETTE.BOOK_BLUE, PALETTE.BOOK_GREEN, '#ca8a04'];
             for(let i=0; i<5; i++) {
                 ctx.fillStyle = colors[i%4];
                 ctx.fillRect(px+6+(i*4), py+6, 3, 6);
                 ctx.fillStyle = colors[(i+1)%4];
                 ctx.fillRect(px+6+(i*4), py+16, 3, 6);
             }
             break;
        case TileType.CABINET:
             ctx.fillStyle = PALETTE.BED_WOOD;
             ctx.fillRect(px+6, py+10, 20, 22);
             ctx.fillStyle = '#451a03';
             ctx.fillRect(px+8, py+18, 16, 1);
             ctx.fillStyle = '#fbbf24';
             ctx.fillRect(px+14, py+14, 4, 2);
             break;
        case TileType.POT_PLANT:
             ctx.fillStyle = '#78350f';
             ctx.beginPath();
             ctx.moveTo(px+8, py+30);
             ctx.lineTo(px+24, py+30);
             ctx.lineTo(px+26, py+20);
             ctx.lineTo(px+6, py+20);
             ctx.fill();
             ctx.fillStyle = '#166534';
             ctx.beginPath();
             ctx.ellipse(px+16, py+16, 8, 10, 0, 0, Math.PI*2);
             ctx.fill();
             break;
        case TileType.FENCE_H:
             const drawPostH = (ox: number) => {
                 ctx.fillStyle = 'rgba(0,0,0,0.4)';
                 ctx.fillRect(px+ox+1, py+28, 8, 4);
                 ctx.fillStyle = '#3f2e21'; 
                 ctx.fillRect(px+ox+4, py+4, 4, 28);
                 ctx.fillStyle = '#8b5a2b'; 
                 ctx.fillRect(px+ox, py+4, 5, 28);
                 ctx.fillStyle = '#a67c52';
                 ctx.fillRect(px+ox-1, py+2, 10, 3);
             };
             ctx.fillStyle = '#4a3728';
             ctx.fillRect(px, py+12, 32, 6);
             ctx.fillRect(px, py+22, 32, 6);
             ctx.fillStyle = '#6d523b';
             ctx.fillRect(px, py+12, 32, 2);
             ctx.fillRect(px, py+22, 32, 2);
             drawPostH(2);
             drawPostH(22);
             break;
        case TileType.FENCE_V:
             ctx.fillStyle = '#3f2e21';
             ctx.fillRect(px+10, py+4, 8, 28);
             ctx.fillStyle = '#8b5a2b';
             ctx.fillRect(px+10, py+4, 4, 28);
             ctx.fillStyle = '#a67c52';
             ctx.fillRect(px+9, py+2, 10, 3);
             ctx.fillStyle = '#6d523b';
             ctx.fillRect(px+13, py, 4, 32); 
             break;
        case TileType.SIGNPOST:
             ctx.fillStyle = '#5c4033';
             ctx.fillRect(px+14, py+16, 4, 16);
             ctx.fillStyle = '#d97706';
             ctx.fillRect(px+4, py+8, 24, 12);
             ctx.fillStyle = '#78350f';
             ctx.fillRect(px+6, py+10, 20, 2);
             ctx.fillRect(px+6, py+14, 14, 2);
             break;
        case TileType.REEDS:
             const sway = Math.sin(frame/15) * 2;
             ctx.strokeStyle = '#15803d';
             ctx.lineWidth = 2;
             ctx.beginPath(); ctx.moveTo(px+10, py+32); ctx.lineTo(px+10+sway, py+16); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(px+16, py+32); ctx.lineTo(px+16+sway*0.8, py+10); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(px+22, py+32); ctx.lineTo(px+22+sway*1.2, py+18); ctx.stroke();
             ctx.fillStyle = '#854d0e';
             ctx.fillRect(px+9+sway, py+12, 3, 6);
             ctx.fillRect(px+15+sway*0.8, py+6, 3, 6);
             ctx.fillRect(px+21+sway*1.2, py+14, 3, 6);
             break;
        case TileType.CHIMNEY:
             ctx.fillStyle = PALETTE.ROOF_MAIN;
             ctx.fillRect(px+12, py+8, 10, 24);
             ctx.fillStyle = PALETTE.ROOF_LIGHT;
             ctx.fillRect(px+13, py+8, 8, 24);
             ctx.fillStyle = PALETTE.ROOF_SHADOW;
             ctx.fillRect(px+12, py+14, 10, 1);
             ctx.fillRect(px+12, py+20, 10, 1);
             ctx.fillRect(px+12, py+26, 10, 1);
             ctx.fillStyle = '#1a1a1a';
             ctx.fillRect(px+11, py+6, 12, 3);
             break;
        case TileType.HOUSE_ROOF_L:
                  ctx.fillStyle = PALETTE.ROOF_MAIN;
                  ctx.beginPath();
                  ctx.moveTo(px + TILE_SIZE, py);
                  ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE);
                  ctx.lineTo(px+8, py + TILE_SIZE);
                  ctx.lineTo(px + TILE_SIZE, py + 8);
                  ctx.fill();
                  ctx.fillStyle = PALETTE.ROOF_SHADOW;
                  ctx.fillRect(px+10, py+10, 22, 2);
                  ctx.fillRect(px+16, py+20, 16, 2);
                  break;
              case TileType.HOUSE_ROOF_M:
                  ctx.fillStyle = PALETTE.ROOF_MAIN;
                  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                  ctx.fillStyle = PALETTE.ROOF_SHADOW;
                  ctx.fillRect(px, py+10, TILE_SIZE, 2);
                  ctx.fillRect(px, py+20, TILE_SIZE, 2);
                  ctx.fillRect(px+10, py+10, 2, 10);
                  ctx.fillRect(px+24, py+20, 2, 12);
                  break;
              case TileType.HOUSE_ROOF_R:
                  ctx.fillStyle = PALETTE.ROOF_MAIN;
                  ctx.beginPath();
                  ctx.moveTo(px, py);
                  ctx.lineTo(px, py + TILE_SIZE);
                  ctx.lineTo(px + TILE_SIZE - 8, py + TILE_SIZE);
                  ctx.fill();
                  ctx.fillStyle = PALETTE.ROOF_SHADOW;
                  ctx.fillRect(px, py+10, 22, 2);
                  ctx.fillRect(px, py+20, 16, 2);
                  break;
              case TileType.HOUSE_WALL_L:
              case TileType.HOUSE_WALL_R:
              case TileType.HOUSE_WALL_M:
                  ctx.fillStyle = PALETTE.WALL_PLASTER;
                  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                  ctx.fillStyle = PALETTE.WALL_WOOD;
                  ctx.fillRect(px, py, 4, TILE_SIZE); 
                  ctx.fillRect(px+TILE_SIZE-4, py, 4, TILE_SIZE);
                  if (y % 2 !== 0) ctx.fillRect(px, py, TILE_SIZE, 4);
                  if (y >= 7) {
                      ctx.fillStyle = '#57534e';
                      ctx.fillRect(px, py+24, TILE_SIZE, 8);
                      ctx.fillStyle = '#44403c';
                      ctx.fillRect(px+4, py+24, 1, 8);
                      ctx.fillRect(px+12, py+24, 1, 8);
                      ctx.fillRect(px+20, py+24, 1, 8);
                  }
                  break;
              case TileType.HOUSE_WINDOW:
                  ctx.fillStyle = PALETTE.WALL_PLASTER;
                  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                  ctx.fillStyle = PALETTE.WALL_WOOD;
                  ctx.fillRect(px, py, 4, TILE_SIZE);
                  ctx.fillRect(px+TILE_SIZE-4, py, 4, TILE_SIZE);
                  ctx.fillRect(px, py, TILE_SIZE, 4);
                  ctx.fillStyle = '#451a03';
                  ctx.fillRect(px+6, py+8, 20, 20);
                  ctx.fillStyle = PALETTE.WINDOW_GLASS;
                  ctx.fillRect(px+8, py+10, 16, 16);
                  ctx.fillStyle = '#451a03';
                  ctx.fillRect(px+15, py+10, 2, 16);
                  ctx.fillRect(px+8, py+17, 16, 2);
                  ctx.fillStyle = PALETTE.WINDOW_GLOW;
                  ctx.beginPath();
                  ctx.moveTo(px+18, py+12); ctx.lineTo(px+22, py+12); ctx.lineTo(px+18, py+16);
                  ctx.fill();
                  ctx.fillStyle = '#854d0e';
                  ctx.fillRect(px+6, py+26, 20, 6);
                  ctx.fillStyle = '#ef4444';
                  ctx.fillRect(px+8, py+24, 3, 3);
                  ctx.fillRect(px+14, py+25, 3, 3);
                  ctx.fillRect(px+20, py+24, 3, 3);
                  break;
              case TileType.HOUSE_DOOR_CLOSED:
                  ctx.fillStyle = PALETTE.WALL_PLASTER;
                  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                  ctx.fillStyle = '#57534e';
                  ctx.fillRect(px, py+24, TILE_SIZE, 8);
                  ctx.fillStyle = PALETTE.WALL_WOOD;
                  ctx.fillRect(px, py, 4, TILE_SIZE);
                  ctx.fillRect(px+TILE_SIZE-4, py, 4, TILE_SIZE);
                  ctx.fillRect(px, py, TILE_SIZE, 4);
                  ctx.fillStyle = '#292524';
                  ctx.fillRect(px+6, py+6, 20, 26);
                  ctx.fillStyle = '#5c4033';
                  ctx.fillRect(px+7, py+7, 18, 25);
                  ctx.fillStyle = '#451a03';
                  ctx.fillRect(px+7, py+7, 1, 25);
                  ctx.fillRect(px+12, py+7, 1, 25);
                  ctx.fillRect(px+18, py+7, 1, 25);
                  ctx.fillRect(px+24, py+7, 1, 25);
                  ctx.fillStyle = '#fbbf24';
                  ctx.fillRect(px+21, py+18, 2, 2);
                  break;
        case TileType.TREE:
            ctx.fillStyle = PALETTE.SHADOW;
            ctx.beginPath();
            ctx.ellipse(px + 16, py + 28, 10, 5, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#2e1005'; // Very dark wood
            ctx.fillRect(px + 12, py + 10, 8, 22);
            
            // Original shape, dark tones
            ctx.fillStyle = '#14532d'; // Dark Green
            ctx.beginPath();
            ctx.moveTo(px + 16, py - 10);
            ctx.lineTo(px + 32, py + 16);
            ctx.lineTo(px, py + 16);
            ctx.fill();
            ctx.fillStyle = '#166534'; // Slightly lighter
            ctx.beginPath();
            ctx.moveTo(px + 16, py - 20);
            ctx.lineTo(px + 28, py + 4);
            ctx.lineTo(px + 4, py + 4);
            ctx.fill();
            break;
        case TileType.SHRINE:
            ctx.fillStyle = PALETTE.SHRINE_WOOD;
            ctx.fillRect(px + 4, py + 8, 24, 24);
            ctx.fillStyle = PALETTE.SHRINE_RED;
            ctx.fillRect(px + 2, py + 8, 4, 24);
            ctx.fillRect(px + 26, py + 8, 4, 24);
            ctx.fillStyle = PALETTE.SHRINE_ROOF;
            ctx.beginPath();
            ctx.moveTo(px - 4, py + 8);
            ctx.lineTo(px + 16, py - 8);
            ctx.lineTo(px + 36, py + 8);
            ctx.fill();
            // Glowing Rune
            ctx.fillStyle = '#fca5a5';
            ctx.font = '10px monospace';
            ctx.fillText('Ω', px + 12, py + 24);
            break;
        case TileType.WALL:
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#451a03'; 
            ctx.fillRect(px+2, py+20, 12, 4);
            ctx.fillRect(px+18, py+10, 10, 4);
            break;
        case TileType.DOOR:
            ctx.fillStyle = '#451a03';
            ctx.fillRect(px + 4, py + 2, 24, 30);
            ctx.fillStyle = '#fbbf24'; 
            ctx.fillRect(px + 6, py + 16, 4, 4);
            break;
        case TileType.TABLE:
            ctx.fillStyle = '#5c4033';
            ctx.fillRect(px+2, py+10, 4, 22);
            ctx.fillRect(px+26, py+10, 4, 22);
            ctx.fillStyle = '#a855f7';
            ctx.fillRect(px, py+8, 32, 10);
            ctx.fillStyle = '#9333ea';
            ctx.fillRect(px+2, py+18, 28, 4);
            break;
        case TileType.STONE:
             ctx.fillStyle = '#4a4e69';
             ctx.beginPath();
             ctx.arc(px+16, py+16, 10, 0, Math.PI*2);
             ctx.fill();
             ctx.fillStyle = '#22223b';
             ctx.beginPath();
             ctx.arc(px+12, py+12, 3, 0, Math.PI*2);
             ctx.fill();
             break;
        case TileType.FLOWER:
             ctx.fillStyle = '#166534';
             ctx.fillRect(px+15, py+18, 2, 14);
             ctx.fillStyle = '#f472b6';
             ctx.beginPath();
             ctx.arc(px+16, py+16, 4, 0, Math.PI*2);
             ctx.fill();
             ctx.fillStyle = '#fbcfe8';
             ctx.beginPath();
             ctx.arc(px+16, py+16, 2, 0, Math.PI*2);
             ctx.fill();
             break;
      }
  };

  const drawCharacter = (
      ctx: CanvasRenderingContext2D, 
      img: HTMLImageElement, 
      x: number, 
      y: number, 
      dir: string, 
      animRow: number
  ) => {
      ctx.fillStyle = PALETTE.SHADOW;
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 28, 10, 4, 0, 0, Math.PI*2);
      ctx.fill();

      let colIndex = 0;
      if (dir === 'DOWN') colIndex = 0;
      else if (dir === 'UP') colIndex = 1;
      else if (dir === 'LEFT') colIndex = 3;  
      else if (dir === 'RIGHT') colIndex = 2; 

      const cellW = Math.floor(img.width / 4);
      const cellH = Math.floor(img.height / 3);

      const sx = colIndex * cellW; 
      const sy = animRow * cellH; 
      
      const destW = TILE_SIZE * 2;
      const destH = TILE_SIZE * 2;
      
      const destX = x + (TILE_SIZE - destW) / 2;
      const destY = y + TILE_SIZE - destH; 

      ctx.drawImage(img, sx, sy, cellW, cellH, destX, destY, destW, destH);
  };

  const drawSimpleNPC = (ctx: CanvasRenderingContext2D, x: number, y: number, npc: NPC) => {
      ctx.fillStyle = PALETTE.SHADOW;
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 28, 10, 4, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = npc.color;
      ctx.fillRect(x + 8, y + 6, 16, 22);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 8, y + 6, 16, 22);
      ctx.fillStyle = '#fff';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name, x + 16, y - 4);
  };

  return <canvas ref={canvasRef} width={480} height={320} className="rounded-lg bg-[#222] shadow-2xl pixel-rendering" style={{ width: '100%', maxWidth: '800px', imageRendering: 'pixelated' }} />;
};

export default GameMap;
