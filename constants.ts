
import { TileType, MapId, Position, NPC, Quest, Skill } from './types';

export const TILE_SIZE = 32; 
export const MAP_WIDTH = 30;
export const MAP_HEIGHT = 20;

export const SKILLS: Record<string, Skill> = {
    'slash': { id: 'slash', name: '橫掃斬', type: 'physical', power: 90, cost: 0, description: '快速的橫向斬擊。', animation: 'slash', gestureId: 'LINE' },
    'braver': { id: 'braver', name: '重力斬', type: 'physical', power: 280, cost: 0, description: '勢大力沉的 V 字斬。', animation: 'slash', gestureId: 'V_SHAPE' },
    'fireball': { id: 'fireball', name: '爆裂彈', type: 'magic', power: 200, cost: 0, description: '召喚三角形火球。', animation: 'fire', gestureId: 'TRIANGLE' },
    'heal': { id: 'heal', name: '治癒十字', type: 'heal', power: 150, cost: 0, description: '繪製十字架，引導生命能量。', animation: 'sparkle', gestureId: 'CIRCLE' }, // 內部邏輯將識別 CROSS
    'veteran_strike': { id: 'veteran_strike', name: '老兵劍術', type: 'physical', power: 45, cost: 0, description: '老練的重擊。', animation: 'slash' },
};

const FOREST_MAP: number[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill(TileType.GRASS));

for(let y=0; y<MAP_HEIGHT; y++) {
    for(let x=0; x<MAP_WIDTH; x++) {
        if (x===0 || x===MAP_WIDTH-1 || y===0 || y===MAP_HEIGHT-1) {
            FOREST_MAP[y][x] = TileType.TREE;
        } else {
            const rand = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const val = rand - Math.floor(rand);
            if (val > 0.9) FOREST_MAP[y][x] = TileType.TREE;
            else if (val > 0.88) FOREST_MAP[y][x] = TileType.STONE;
        }
    }
}

for(let y=12; y<16; y++) {
    for(let x=20; x<26; x++) {
        FOREST_MAP[y][x] = TileType.WATER;
        if (Math.random() > 0.7) FOREST_MAP[y][x] = TileType.LILYPAD;
    }
}

const addPath = (x: number, y: number) => {
    if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) FOREST_MAP[y][x] = TileType.PATH;
};
for(let x=0; x<=5; x++) addPath(x, 8);
addPath(5, 9); addPath(6, 10);
for(let x=7; x<=16; x++) addPath(x, 10);
addPath(11, 9); addPath(11, 8); addPath(11, 7); 

const hx = 8, hy = 3; 
for(let y=hy-1; y<=hy+5; y++) {
    for(let x=hx-1; x<=hx+7; x++) {
        if (FOREST_MAP[y][x] !== TileType.PATH) FOREST_MAP[y][x] = TileType.GRASS;
    }
}

FOREST_MAP[hy][hx+1] = TileType.HOUSE_ROOF_L;
FOREST_MAP[hy][hx+2] = TileType.HOUSE_ROOF_M; 
FOREST_MAP[hy][hx+3] = TileType.HOUSE_ROOF_M; 
FOREST_MAP[hy][hx+4] = TileType.HOUSE_ROOF_M; 
FOREST_MAP[hy][hx+5] = TileType.HOUSE_ROOF_R; 
FOREST_MAP[hy-1][hx+2] = TileType.CHIMNEY;
FOREST_MAP[hy+1][hx+0] = TileType.HOUSE_ROOF_L;
FOREST_MAP[hy+1][hx+1] = TileType.HOUSE_ROOF_M;
FOREST_MAP[hy+1][hx+2] = TileType.HOUSE_ROOF_M;
FOREST_MAP[hy+1][hx+3] = TileType.HOUSE_ROOF_M;
FOREST_MAP[hy+1][hx+4] = TileType.HOUSE_ROOF_M;
FOREST_MAP[hy+1][hx+5] = TileType.HOUSE_ROOF_M;
FOREST_MAP[hy+1][hx+6] = TileType.HOUSE_ROOF_R;

FOREST_MAP[hy+2][hx+1] = TileType.HOUSE_WALL_L;
FOREST_MAP[hy+2][hx+2] = TileType.HOUSE_WALL_M;
FOREST_MAP[hy+2][hx+3] = TileType.HOUSE_WINDOW;
FOREST_MAP[hy+2][hx+4] = TileType.HOUSE_WALL_M;
FOREST_MAP[hy+2][hx+5] = TileType.HOUSE_WALL_R;
FOREST_MAP[hy+3][hx+1] = TileType.HOUSE_WALL_L;
FOREST_MAP[hy+3][hx+2] = TileType.HOUSE_WINDOW;
FOREST_MAP[hy+3][hx+3] = TileType.HOUSE_WALL_M;
FOREST_MAP[hy+3][hx+4] = TileType.HOUSE_WINDOW;
FOREST_MAP[hy+3][hx+5] = TileType.HOUSE_WALL_R;
FOREST_MAP[hy+4][hx+1] = TileType.HOUSE_WALL_L;
FOREST_MAP[hy+4][hx+2] = TileType.HOUSE_WALL_M;
FOREST_MAP[hy+4][hx+3] = TileType.HOUSE_DOOR_CLOSED;
FOREST_MAP[hy+4][hx+4] = TileType.HOUSE_WALL_M;
FOREST_MAP[hy+4][hx+5] = TileType.HOUSE_WALL_R;

FOREST_MAP[hy+5][hx-1] = TileType.FENCE_V;
FOREST_MAP[hy+5][hx+0] = TileType.FENCE_H;
FOREST_MAP[hy+5][hx+1] = TileType.FENCE_H;
FOREST_MAP[hy+5][hx+2] = TileType.FENCE_H;
FOREST_MAP[hy+5][hx+4] = TileType.FENCE_H;
FOREST_MAP[hy+5][hx+5] = TileType.FENCE_H;
FOREST_MAP[hy+5][hx+6] = TileType.FENCE_V;
FOREST_MAP[9][8] = TileType.SIGNPOST;
FOREST_MAP[15][4] = TileType.SHRINE;

const HOUSE_MAP: number[][] = Array(MAP_HEIGHT).fill(0).map(() => Array(MAP_WIDTH).fill(0));
const rx = 10, ry = 5, rw = 12, rh = 8;
for(let y=ry; y<ry+rh; y++) {
    for(let x=rx; x<rx+rw; x++) {
        if (y===ry || y===ry+rh-1 || x===rx || x===rx+rw-1) HOUSE_MAP[y][x] = TileType.WALL; 
        else HOUSE_MAP[y][x] = TileType.FLOOR; 
    }
}
HOUSE_MAP[ry+rh-1][rx+5] = TileType.DOOR;
HOUSE_MAP[ry+1][rx+1] = TileType.BED_HEAD; 
HOUSE_MAP[ry+2][rx+1] = TileType.BED_FOOT;
HOUSE_MAP[ry+1][rx+2] = TileType.CABINET;
HOUSE_MAP[ry+1][rx+4] = TileType.BOOKSHELF;
HOUSE_MAP[ry+1][rx+5] = TileType.BOOKSHELF;
HOUSE_MAP[ry+3][rx+7] = TileType.RUG_C; 
HOUSE_MAP[ry+1][rx+rw-2] = TileType.POT_PLANT;
HOUSE_MAP[ry+rh-2][rx+1] = TileType.POT_PLANT;
HOUSE_MAP[ry+3][rx+8] = TileType.TABLE;

export const MAPS: Record<MapId, number[][]> = { 'FOREST': FOREST_MAP, 'HOUSE': HOUSE_MAP };
export const PORTALS: { [key: string]: { mapId: MapId, pos: Position } } = {
  'FOREST-11,7': { mapId: 'HOUSE', pos: { x: 15, y: 11 } }, 
  'HOUSE-15,12': { mapId: 'FOREST', pos: { x: 11, y: 8 } }, 
};

export const INITIAL_PLAYER_POS = { x: 2, y: 8 };

export const INITIAL_NPCS: NPC[] = [
  {
    id: 'elder',
    name: '張先生',
    mapId: 'FOREST',
    pos: { x: 15, y: 8 }, 
    color: '#78350f', 
    description: 'A retired veteran soldier, grey hair, brown veteran cloak.',
    persona: `你是「張先生」，退休斥候。你在森林守護村莊。`,
    hp: 2500, maxHp: 2500, skills: ['veteran_strike']
  },
  {
    id: 'friend',
    name: '小林',
    mapId: 'HOUSE',
    pos: { x: 16, y: 7 }, 
    color: '#ec4899', 
    description: 'A cute girl with pink twin-tails.',
    persona: `你是「小林」，主角的青梅竹馬。`,
    hp: 500, maxHp: 500, skills: ['heal']
  }
];

export const INITIAL_QUESTS: Quest[] = [
    { id: 'find_compass', title: '老兵的遺物', description: '幫張先生找回遺物。', status: 'active', targetId: 'elder' }
];
