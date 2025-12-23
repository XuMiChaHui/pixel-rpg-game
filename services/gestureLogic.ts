
export interface Point { x: number; y: number; }

/**
 * 魔法符文識別邏輯 (核心優化)
 * 支持多筆劃 Flatten 後的點集識別
 */
export const recognizeRuneLocally = (path: Point[]): string => {
    if (path.length < 8) return 'none';

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let totalLen = 0;
    
    path.forEach((p, i) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        if (i > 0) {
            totalLen += Math.sqrt(Math.pow(p.x - path[i-1].x, 2) + Math.pow(p.y - path[i-1].y, 2));
        }
    });

    const width = maxX - minX;
    const height = maxY - minY;
    
    const start = path[0];
    const end = path[path.length - 1];
    const distSE = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    
    // 多筆劃識別中，封閉性的判斷要稍微放寬，因為可能由多筆組成
    const isClosed = distSE < totalLen * 0.4 || distSE < Math.max(width, height) * 0.5;

    let sharpTurns = 0;
    const step = Math.max(1, Math.floor(path.length / 12));
    for (let i = step; i < path.length - step; i += step) {
        const p1 = path[i - step];
        const p2 = path[i];
        const p3 = path[i + step];
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (mag1 < 0.01 || mag2 < 0.01) continue;
        const dot = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
        if (dot < 0.4) sharpTurns++;
    }

    if (isClosed) {
        // 三角形 (Fireball) vs 圓形/十字 (Heal)
        return sharpTurns >= 2 ? 'fireball' : 'heal'; 
    } else {
        const aspectRatio = width / (height || 1);
        
        // 十字特徵 (Heal)：即使不完全閉合，但轉向多且接近正方比例
        if (sharpTurns >= 3 && aspectRatio > 0.6 && aspectRatio < 1.8) {
            return 'heal';
        }

        const midPoint = path[Math.floor(path.length / 2)];
        const endsAvgY = (start.y + end.y) / 2;
        
        // V字 (Braver)
        if (midPoint.y > endsAvgY + height * 0.25 && sharpTurns >= 1) {
            return 'braver';
        }

        // 直線 (Slash)
        if (width > height * 2.2 || height > width * 2.2) {
            return 'slash';
        }
    }

    return 'none';
};
