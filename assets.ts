
import { SpriteKey } from './services/spriteStorage';

/**
 * 【素材自動讀取設定】
 * 
 * 遊戲會優先尋找以下路徑的檔案。
 * 請將你的圖片放在 GitHub 專案的 public 資料夾中：
 * - Walk Sprites: /public/sprites/
 * - AI Portraits: /public/portraits/
 */

export const PRELOADED_SPRITES: Record<SpriteKey, string | null> = {
  "player": "/sprites/player.png",
  "friend": "/sprites/friend.png",
  "elder": "/sprites/elder.png",
};

export const PRELOADED_PORTRAITS: Record<string, string | null> = {
  "player": "/portraits/player.png",
  "friend": "/portraits/friend.png",
  "elder": "/portraits/elder.png",
};
