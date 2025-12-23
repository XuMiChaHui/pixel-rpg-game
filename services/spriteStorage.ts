
import { PRELOADED_SPRITES, PRELOADED_PORTRAITS } from '../assets';

export type SpriteKey = 'player' | 'friend' | 'elder';

const STORAGE_PREFIX = 'rpg_sprite_';
const PORTRAIT_PREFIX = 'rpg_portrait_';

/**
 * --- 精美像素人物生成器 (16-bit JRPG Style) ---
 * 生成 4x3 規格的 Sprite Sheet (32x32 per frame)
 * 方向: 0:下, 1:上, 2:右, 3:左
 * 動作: 0:踏步A, 1:踏步B, 2:站立
 */
const generateDetailedSprite = (key: SpriteKey): string => {
    if (typeof document === 'undefined') return '';

    const canvas = document.createElement('canvas');
    const cell = 32;
    canvas.width = cell * 4; 
    canvas.height = cell * 3; 
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 顏色配置
    const colors = {
        player: { main: '#3b82f6', alt: '#1e40af', hair: '#4b2c20', skin: '#ffdbac', eye: '#000' },
        friend: { main: '#ec4899', alt: '#9d174d', hair: '#fbcfe8', skin: '#ffe4e1', eye: '#4a0404' },
        elder:  { main: '#78350f', alt: '#451a03', hair: '#d1d5db', skin: '#e2a76f', eye: '#111' }
    }[key];

    ctx.imageSmoothingEnabled = false;

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            const x = col * cell;
            const y = row * cell;
            const isIdle = row === 2;
            const isStep1 = row === 0;
            const bounce = isIdle ? 0 : -1;

            // 1. 陰影 (柔和橢圓)
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(x + 16, y + 29, 10, 3, 0, 0, Math.PI * 2);
            ctx.fill();

            // 2. 腿部動畫
            ctx.fillStyle = '#333'; // 褲子/靴子顏色
            if (isIdle) {
                ctx.fillRect(x + 10, y + 24, 4, 6); // 左
                ctx.fillRect(x + 18, y + 24, 4, 6); // 右
            } else if (isStep1) {
                ctx.fillRect(x + 8, y + 22, 5, 8);  // 左跨
                ctx.fillRect(x + 19, y + 25, 4, 5);  // 右後
            } else {
                ctx.fillRect(x + 9, y + 25, 4, 5);  // 左後
                ctx.fillRect(x + 19, y + 22, 5, 8); // 右跨
            }

            // 3. 身體與衣服
            ctx.fillStyle = colors.main;
            ctx.fillRect(x + 9, y + 14 + bounce, 14, 11); // 軀幹
            ctx.fillStyle = colors.alt;
            ctx.fillRect(x + 9, y + 22 + bounce, 14, 3);  // 腰帶/下擺
            
            // 手臂擺動
            ctx.fillStyle = colors.skin;
            if (col === 0 || col === 1) { // 正背面
                const armY = y + 15 + bounce + (isStep1 ? 1 : (isIdle ? 0 : -1));
                ctx.fillRect(x + 6, armY, 3, 7); 
                ctx.fillRect(x + 23, armY, 3, 7);
            } else if (col === 2) { // 右側
                ctx.fillRect(x + 18, y + 15 + bounce, 4, 8);
            } else { // 左側
                ctx.fillRect(x + 10, y + 15 + bounce, 4, 8);
            }

            // 4. 頭部
            ctx.fillStyle = colors.skin;
            ctx.fillRect(x + 10, y + 5 + bounce, 12, 10); // 臉部基礎

            // 5. 髮型細節 (根據角色不同)
            ctx.fillStyle = colors.hair;
            if (key === 'player') {
                // 刺蝟頭
                ctx.fillRect(x + 9, y + 2 + bounce, 14, 5); 
                ctx.fillRect(x + 8, y + 4 + bounce, 2, 4);
                ctx.fillRect(x + 22, y + 4 + bounce, 2, 4);
                ctx.fillRect(x + 15, y + 1 + bounce, 2, 2);
            } else if (key === 'friend') {
                // 雙馬尾
                ctx.fillRect(x + 9, y + 3 + bounce, 14, 4);
                ctx.fillRect(x + 7, y + 6 + bounce, 4, 12); // 左馬尾
                ctx.fillRect(x + 21, y + 6 + bounce, 4, 12); // 右馬尾
                ctx.fillStyle = '#fff'; // 髮飾
                ctx.fillRect(x + 8, y + 5 + bounce, 3, 2);
                ctx.fillRect(x + 21, y + 5 + bounce, 3, 2);
            } else {
                // 老兵 (鬍鬚與長髮)
                ctx.fillStyle = '#d1d5db';
                ctx.fillRect(x + 9, y + 4 + bounce, 14, 4); // 頭頂
                if (col !== 1) ctx.fillRect(x + 10, y + 12 + bounce, 12, 4); // 鬍鬚
                ctx.fillStyle = '#4b5563'; // 披風
                ctx.fillRect(x + 7, y + 14 + bounce, 18, 2);
            }

            // 6. 五官
            if (col === 0) { // 向下 (正臉)
                ctx.fillStyle = colors.eye;
                ctx.fillRect(x + 13, y + 9 + bounce, 2, 2);
                ctx.fillRect(x + 17, y + 9 + bounce, 2, 2);
            } else if (col === 2) { // 右側
                ctx.fillStyle = colors.eye;
                ctx.fillRect(x + 19, y + 9 + bounce, 2, 2);
            } else if (col === 3) { // 左側
                ctx.fillStyle = colors.eye;
                ctx.fillRect(x + 11, y + 9 + bounce, 2, 2);
            }
        }
    }
    return canvas.toDataURL();
};

let defaultsCache: Record<SpriteKey, string> | null = null;

const getDefaults = (): Record<SpriteKey, string> => {
    if (defaultsCache) return defaultsCache;
    defaultsCache = {
        player: generateDetailedSprite('player'),
        friend: generateDetailedSprite('friend'),
        elder:  generateDetailedSprite('elder'),
    };
    return defaultsCache;
};

// --- Storage & Helpers (保留原始邏輯) ---

export const saveSprite = (key: SpriteKey, base64Data: string): boolean => {
  try { localStorage.setItem(`${STORAGE_PREFIX}${key}`, base64Data); return true; } 
  catch (e) { return false; }
};

export const getSprite = (key: SpriteKey): string | null => {
  try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (stored && stored.startsWith('data:') && stored !== '[object Object]') return stored;
  } catch(e) {}
  if (PRELOADED_SPRITES[key]) return PRELOADED_SPRITES[key];
  return getDefaults()[key];
};

export const getAllSprites = (): Record<SpriteKey, string | null> => ({
  player: getSprite('player'),
  friend: getSprite('friend'),
  elder: getSprite('elder'),
});

export const getSpriteSourceType = (key: SpriteKey): 'LOCAL_STORAGE' | 'FILE' | 'DEFAULT' => {
    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (stored && stored !== '[object Object]') return 'LOCAL_STORAGE';
    } catch(e) {}
    if (PRELOADED_SPRITES[key]) return 'FILE';
    return 'DEFAULT';
};

export const savePortrait = (npcId: string, base64Data: string): boolean => {
    try { localStorage.setItem(`${PORTRAIT_PREFIX}${npcId}`, base64Data); return true; } 
    catch (e) { return false; }
}

export const getPortrait = (npcId: string): string | null => {
    try {
        const stored = localStorage.getItem(`${PORTRAIT_PREFIX}${npcId}`);
        if (stored && stored.startsWith('data:') && stored !== '[object Object]') return stored;
    } catch(e) {}
    if (PRELOADED_PORTRAITS[npcId]) return PRELOADED_PORTRAITS[npcId];
    return null;
}

export const clearAllData = () => {
    try {
        localStorage.removeItem(`${STORAGE_PREFIX}player`);
        localStorage.removeItem(`${STORAGE_PREFIX}friend`);
        localStorage.removeItem(`${STORAGE_PREFIX}elder`);
        Object.keys(localStorage).forEach(key => { if (key.startsWith(PORTRAIT_PREFIX)) localStorage.removeItem(key); });
    } catch(e) {}
};
