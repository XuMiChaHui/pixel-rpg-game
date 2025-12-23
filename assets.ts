
import { SpriteKey } from './services/spriteStorage';

/**
 * 【素材讀取設定】
 * 
 * 不需要再將圖片轉成代碼了！
 * 請在你的專案根目錄建立以下資料夾結構：
 * public/
 *   └── sprites/
 *         ├── player.png  (主角)
 *         ├── friend.png  (小林)
 *         └── elder.png   (老爺爺)
 * 
 * 只要圖片存在於該位置，遊戲就會自動讀取。
 */

export const PRELOADED_SPRITES: Record<SpriteKey, string | null> = {
  "player": "/sprites/player.png",
  "friend": "/sprites/friend.png",
  "elder": "/sprites/elder.png",
};

export const PRELOADED_PORTRAITS: Record<string, string | null> = {
  // 如果你有立繪圖片，也可以放在 public/portraits/ 資料夾並在此指定路徑
  "player": null,
  "friend": null,
  "elder": null,
};
