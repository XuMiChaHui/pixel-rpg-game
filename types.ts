
export type MapId = 'FOREST' | 'HOUSE';

export interface Position {
  x: number;
  y: number;
}

export enum TileType {
  GRASS = 0,
  TREE = 1,
  WATER = 2,
  PATH = 3,
  STONE = 4,
  FLOWER = 5,
  WALL = 6,
  FLOOR = 7,
  DOOR = 8,
  TABLE = 9,
  SHRINE = 10,
  HOUSE_ROOF_L = 20,
  HOUSE_ROOF_M = 21,
  HOUSE_ROOF_R = 22,
  HOUSE_WALL_L = 23,
  HOUSE_WALL_M = 24,
  HOUSE_WALL_R = 25,
  HOUSE_WINDOW = 26,
  HOUSE_DOOR_CLOSED = 27,
  FENCE_H = 30,
  FENCE_V = 31,
  SIGNPOST = 32,
  LILYPAD = 33,
  REEDS = 34,
  CHIMNEY = 35,
  BED_HEAD = 40,
  BED_FOOT = 41,
  BOOKSHELF = 42,
  RUG_C = 43,
  CABINET = 44,
  POT_PLANT = 45,
  CRYSTAL = 50,
  MAGIC_FLOWER = 51,
}

export interface PlayerStats {
  name: string;
  class: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  maxExp: number;
  gold: number;
  skills: string[];
}

export interface Skill {
    id: string;
    name: string;
    type: 'physical' | 'magic' | 'heal';
    power: number;
    cost: number;
    description: string;
    animation: 'slash' | 'fire' | 'sparkle';
    gestureId?: 'LINE' | 'V_SHAPE' | 'CIRCLE' | 'TRIANGLE'; // 新增手勢識別 ID
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: 'inactive' | 'active' | 'completed';
  targetId?: string;
}

export interface NPC {
  id: string;
  name: string;
  mapId: MapId;
  pos: Position;
  color: string;
  persona: string;
  description: string;
  generatedPortraitUrl?: string;
  hp: number;
  maxHp: number;
  skills: string[];
}

export type GameMode = 'ROAM' | 'CHAT' | 'BATTLE';

export interface GameState {
  gameMode: GameMode;
  currentMap: MapId;
  playerPos: Position;
  playerDir: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'; 
  stepFrame: number;
  activeNpcId: string | null;
  npcs: NPC[];
  playerStats: PlayerStats;
  interactionTarget: null;
  quests: Quest[]; 
  inventory: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}
