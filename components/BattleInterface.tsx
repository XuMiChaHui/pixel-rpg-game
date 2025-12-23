
import React, { useState, useEffect, useRef } from 'react';
import { NPC, PlayerStats, Skill } from '../types';
import { SKILLS } from '../constants';
import { getPortrait, getAllSprites } from '../services/spriteStorage';
import { recognizeRuneLocally } from '../services/gestureLogic';

interface BattleInterfaceProps {
    player: PlayerStats;
    enemy: NPC;
    cameraStream: MediaStream | null;
    onStartCamera: () => Promise<MediaStream | null>;
    onClose: (result: 'WIN' | 'LOSE' | 'ESCAPE') => void;
}

interface Point { x: number; y: number; }
interface DamagePop { id: number; value: number | string; x: number; y: number; type: 'dmg' | 'heal' | 'msg'; }

const BattleInterface: React.FC<BattleInterfaceProps> = ({ player, enemy, cameraStream, onStartCamera, onClose }) => {
    const [playerHp, setPlayerHp] = useState(500);
    const playerMaxHp = 500;
    const [enemyHp, setEnemyHp] = useState(enemy.maxHp);
    const [isBattleOver, setIsBattleOver] = useState(false);
    const [hasPlayerAttacked, setHasPlayerAttacked] = useState(false);
    
    const [status, setStatus] = useState<'LOADING' | 'READY' | 'TRACKING' | 'ERROR'>('LOADING');
    const [log, setLog] = useState('左手掌清空，食指中指繪製，右手掌釋放！');
    const [handInfo, setHandInfo] = useState<{ side: string, state: string }>({ side: 'NONE', state: 'NONE' });
    const [previewSkillId, setPreviewSkillId] = useState<string>('none');
    
    const [playerAnim, setPlayerAnim] = useState('');
    const [enemyAnim, setEnemyAnim] = useState('');
    const [damagePops, setDamagePops] = useState<DamagePop[]>([]);
    
    // 多筆劃支持：二維數組
    const pathRef = useRef<Point[][]>([]);
    const isDrawingRef = useRef(false);
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const handsRef = useRef<any>(null);
    const lastResultsRef = useRef<any>(null);

    const [enemyImg, setEnemyImg] = useState<string | null>(null);
    const [playerImg, setPlayerImg] = useState<string | null>(null);
    const sprites = getAllSprites();

    const battleState = useRef({
        isActive: true,
        isProcessing: false,
        lastEnemyAttack: Date.now()
    });

    useEffect(() => {
        if (isBattleOver || !hasPlayerAttacked) return; 
        const interval = setInterval(() => {
            const now = Date.now();
            if (now - battleState.current.lastEnemyAttack > 4000) { 
                const moves = enemy.skills;
                executeMove('ENEMY', moves[Math.floor(Math.random() * moves.length)]);
                battleState.current.lastEnemyAttack = now;
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isBattleOver, hasPlayerAttacked, enemy.skills]);

    useEffect(() => {
        const init = async () => {
            let retry = 0;
            while (!(window as any).Hands && retry < 30) {
                await new Promise(r => setTimeout(r, 200));
                retry++;
            }
            if (!(window as any).Hands) { setLog("感應模組載入失敗。"); setStatus('ERROR'); return; }

            try {
                const hands = new (window as any).Hands({
                    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                });
                hands.setOptions({
                    maxNumHands: 2, // 偵測雙手
                    modelComplexity: 1,
                    minDetectionConfidence: 0.6,
                    minTrackingConfidence: 0.6
                });
                hands.onResults((results: any) => {
                    lastResultsRef.current = results;
                    battleState.current.isProcessing = false;
                });
                handsRef.current = hands;
                setStatus('READY');
            } catch (e) { setStatus('ERROR'); }
        };

        init();
        setEnemyImg(getPortrait(enemy.id) || sprites[enemy.id as keyof typeof sprites]);
        setPlayerImg(getPortrait('player') || sprites.player);
        return () => { battleState.current.isActive = false; };
    }, []);

    useEffect(() => {
        if (!cameraStream || !videoRef.current || status !== 'READY') return;
        videoRef.current.srcObject = cameraStream;
        videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setStatus('TRACKING');
            
            const renderLoop = async () => {
                if (!battleState.current.isActive) return;
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const hands = handsRef.current;
                
                if (video && canvas && video.readyState >= 2) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const w = canvas.width; const h = canvas.height;
                        ctx.clearRect(0, 0, w, h);
                        ctx.save();
                        ctx.translate(w, 0); ctx.scale(-1, 1);
                        ctx.globalAlpha = 0.3;
                        ctx.drawImage(video, 0, 0, w, h);
                        ctx.globalAlpha = 1.0;

                        const results = lastResultsRef.current;
                        let anyPointing = false;

                        if (results && results.multiHandLandmarks) {
                            results.multiHandLandmarks.forEach((landmarks: any, index: number) => {
                                const handedness = results.multiHandedness[index].label; // "Left" or "Right"
                                const indexTip = landmarks[8];
                                const indexMid = landmarks[6];
                                const middleTip = landmarks[12];
                                const middleMid = landmarks[10];
                                const ringTip = landmarks[16];
                                const pinkyTip = landmarks[20];

                                // 劍指判定：食指、中指伸直，其餘彎曲
                                const isPointing = indexTip.y < indexMid.y && middleTip.y < middleMid.y && ringTip.y > landmarks[14].y;
                                // 手掌判定
                                const isPalm = indexTip.y < indexMid.y && middleTip.y < middleMid.y && ringTip.y < landmarks[14].y && pinkyTip.y < landmarks[18].y;
                                // 握拳判定
                                const isFist = indexTip.y > indexMid.y && middleTip.y > middleMid.y;

                                const handCol = isPointing ? '#34d399' : (isPalm ? '#ffffff' : (isFist ? '#facc15' : '#f87171'));
                                if ((window as any).drawConnectors) {
                                    (window as any).drawConnectors(ctx, landmarks, (window as any).HAND_CONNECTIONS, { color: handCol, lineWidth: 2 });
                                }

                                // 核心邏輯
                                if (handedness === 'Left' && isPalm) {
                                    handleClear();
                                    setHandInfo({ side: '左手', state: '清空畫布' });
                                } else if (handedness === 'Right' && isPalm && pathRef.current.length > 0) {
                                    handleConfirmCast();
                                    setHandInfo({ side: '右手', state: '施放技能' });
                                } else if (isPointing) {
                                    anyPointing = true;
                                    setHandInfo({ side: handedness === 'Left' ? '左手' : '右手', state: '繪製中' });
                                    
                                    const px = ((indexTip.x + middleTip.x) / 2) * w;
                                    const py = ((indexTip.y + middleTip.y) / 2) * h;

                                    if (!isDrawingRef.current) {
                                        pathRef.current.push([{ x: px, y: py }]);
                                        isDrawingRef.current = true;
                                    } else {
                                        const currentStroke = pathRef.current[pathRef.current.length - 1];
                                        const last = currentStroke[currentStroke.length - 1];
                                        if (!last || Math.sqrt(Math.pow(last.x - px, 2) + Math.pow(last.y - py, 2)) > 5) {
                                            currentStroke.push({ x: px, y: py });
                                        }
                                    }
                                    
                                    // 識別提示
                                    const flattened = pathRef.current.flat();
                                    if (flattened.length > 8) {
                                        setPreviewSkillId(recognizeRuneLocally(flattened));
                                    }
                                } else if (isFist) {
                                    setHandInfo({ side: '雙手', state: '暫停繪製' });
                                    isDrawingRef.current = false; // 斷開筆劃
                                }
                            });
                        }

                        if (!anyPointing) {
                            isDrawingRef.current = false;
                        }

                        // 繪製多筆劃
                        pathRef.current.forEach(stroke => {
                            if (stroke.length < 2) return;
                            ctx.beginPath();
                            ctx.strokeStyle = '#60a5fa'; 
                            ctx.lineWidth = 8;
                            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                            ctx.moveTo(stroke[0].x, stroke[0].y);
                            for (let i = 1; i < stroke.length; i++) {
                                ctx.lineTo(stroke[i].x, stroke[i].y);
                            }
                            ctx.stroke();
                        });
                        ctx.restore();

                        if (hands && !battleState.current.isProcessing) {
                            battleState.current.isProcessing = true;
                            hands.send({ image: video }).catch(() => { battleState.current.isProcessing = false; });
                        }
                    }
                }
                requestAnimationFrame(renderLoop);
            };
            renderLoop();
        };
    }, [cameraStream, status]);

    const handleConfirmCast = async () => {
        const flattened = pathRef.current.flat();
        if (flattened.length < 5 || isBattleOver) return;
        handleClear(); 
        
        const skillId = recognizeRuneLocally(flattened);
        const skill = SKILLS[skillId];
        
        if (skill && player.skills.includes(skill.id)) {
            if (!hasPlayerAttacked) setHasPlayerAttacked(true);
            executeMove('PLAYER', skill.id);
        } else {
            addPop("無效術式", 250, 200, 'msg');
        }
    };

    const handleClear = () => { 
        pathRef.current = []; 
        setPreviewSkillId('none');
        isDrawingRef.current = false;
    };

    const addPop = (val: number | string, x: number, y: number, type: 'dmg' | 'heal' | 'msg') => {
        const id = Date.now();
        setDamagePops(prev => [...prev, { id, value: val, x, y, type }]);
        setTimeout(() => setDamagePops(prev => prev.filter(p => p.id !== id)), 1000);
    };

    const executeMove = (user: 'PLAYER' | 'ENEMY', skillId: string) => {
        if (isBattleOver) return;
        const skill = SKILLS[skillId];
        if (!skill) return;
        const isPlayer = user === 'PLAYER';
        
        if (isPlayer) {
            setPlayerAnim('attack');
            setLog(`【${skill.name}】釋放！`);
            setTimeout(() => {
                let val = skill.power + Math.floor(Math.random() * (skill.power * 0.2));
                if (skill.type === 'heal') {
                    setPlayerHp(h => {
                        const newHp = Math.min(playerMaxHp, h + val);
                        addPop(`+${val}`, 120, 150, 'heal');
                        return newHp;
                    });
                } else {
                    setEnemyHp(h => {
                        const newHp = Math.max(0, h - val);
                        if (newHp <= 0) handleEnd('WIN');
                        return newHp;
                    });
                    setEnemyAnim('shake');
                    addPop(`-${val}`, 380, 150, 'dmg');
                }
                setTimeout(() => { setPlayerAnim(''); setEnemyAnim(''); }, 400);
            }, 200);
        } else {
            setEnemyAnim('attack');
            setTimeout(() => {
                let val = skill.power + Math.floor(Math.random() * 10);
                setPlayerHp(h => {
                    const newHp = Math.max(0, h - val);
                    if (newHp <= 0) handleEnd('LOSE');
                    return newHp;
                });
                setPlayerAnim('shake');
                addPop(`-${val}`, 120, 150, 'dmg');
                setTimeout(() => { setPlayerAnim(''); setEnemyAnim(''); }, 400);
            }, 600);
        }
    };

    const handleEnd = (result: 'WIN' | 'LOSE') => {
        setIsBattleOver(true);
        setLog(result === 'WIN' ? "戰鬥勝利！" : "你倒下了...");
        setTimeout(() => onClose(result), 2000);
    };

    return (
        <div className={`fixed inset-0 z-[100] bg-[#0c0c0c] flex flex-col font-sans overflow-hidden select-none ${playerAnim === 'shake' ? 'animate-shake-screen' : ''}`}>
            <video ref={videoRef} autoPlay playsInline muted className="hidden" />

            <div className="flex justify-between p-4 bg-black/95 border-b border-blue-900/40">
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-end w-56">
                        <span className="text-red-400 font-bold text-xs">{enemy.name}</span>
                        <span className="text-red-500 font-mono text-[10px]">{enemyHp} / {enemy.maxHp}</span>
                    </div>
                    <div className="w-56 h-3 bg-gray-900 rounded-full border border-red-900/40 overflow-hidden">
                        <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${(enemyHp/enemy.maxHp)*100}%` }}></div>
                    </div>
                </div>
                <div className="flex flex-col items-center">
                    <div className="px-4 py-1 rounded-full bg-gray-800 text-cyan-400 text-[10px] font-bold border border-cyan-900/50">
                        {handInfo.side}: {handInfo.state}
                    </div>
                    {previewSkillId !== 'none' && (
                        <div className="mt-1 text-white text-xs font-bold animate-pulse drop-shadow-md">
                            預覽: {SKILLS[previewSkillId]?.name}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex justify-between items-end w-56">
                        <span className="text-blue-400 font-mono text-[10px]">{playerHp} / {playerMaxHp}</span>
                        <span className="text-blue-400 font-bold text-xs">勇者</span>
                    </div>
                    <div className="w-56 h-3 bg-gray-900 rounded-full border border-blue-900/40 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(playerHp/playerMaxHp)*100}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex relative">
                <div className="w-48 bg-black/80 border-r border-blue-900/20 p-4 flex flex-col gap-3">
                    <h3 className="text-blue-400 text-[10px] font-bold border-b border-blue-900/40 pb-2 mb-2 uppercase tracking-widest">指令說明</h3>
                    <div className="text-[10px] text-gray-400 space-y-2">
                        <p><span className="text-white">雙指指尖:</span> 開始繪製</p>
                        <p><span className="text-white">握拳:</span> 中斷不連線</p>
                        <p><span className="text-white">左手掌:</span> 清空畫布</p>
                        <p><span className="text-white">右手掌:</span> 釋放魔法</p>
                    </div>
                    <h3 className="text-blue-400 text-[10px] font-bold border-b border-blue-900/40 pb-2 mt-4 uppercase tracking-widest">符文</h3>
                    {player.skills.map(sid => {
                        const s = SKILLS[sid];
                        const iconMap: any = { 'LINE': '一', 'V_SHAPE': 'V', 'TRIANGLE': '△', 'CIRCLE': '十字' };
                        return (
                            <div key={sid} className={`p-2 rounded border transition-all ${previewSkillId === sid ? 'bg-blue-600 border-white' : 'bg-blue-950/20 border-blue-900/30 opacity-60'}`}>
                                <div className="text-white text-[10px] font-bold">{s.name}</div>
                                <div className="text-[9px] text-cyan-400">{iconMap[s.gestureId || ''] || '?'}</div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex-1 relative flex flex-col items-center justify-center bg-black">
                    <div className="absolute inset-0 flex justify-around items-center opacity-30 pointer-events-none">
                        <img src={playerImg || ''} className={`w-40 h-40 object-contain ${playerAnim === 'shake' ? 'animate-shake' : ''} ${playerAnim === 'attack' ? 'animate-push' : ''}`} style={{ imageRendering: 'pixelated' }} />
                        <img src={enemyImg || ''} className={`w-40 h-40 object-contain ${enemyAnim === 'shake' ? 'animate-shake' : ''}`} style={{ imageRendering: 'pixelated' }} />
                    </div>

                    {damagePops.map(pop => (
                        <div key={pop.id} className={`absolute z-50 font-bold text-6xl animate-float-up ${pop.type === 'heal' ? 'text-green-400' : 'text-white'}`} style={{ left: pop.x, top: pop.y }}>
                            {pop.value}
                        </div>
                    ))}

                    <div className={`relative w-full max-w-[500px] aspect-square rounded-full border-2 border-white/10 ${pathRef.current.length > 0 ? 'bg-blue-900/5 border-blue-500/30' : ''}`}>
                        {!cameraStream && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/95">
                                <button onClick={onStartCamera} className="px-10 py-4 bg-blue-600 text-white font-bold rounded-lg shadow-2xl">啟動視覺陣式</button>
                            </div>
                        )}
                        <canvas ref={canvasRef} width={500} height={500} className="w-full h-full" />
                    </div>
                </div>
            </div>

            <div className="h-10 bg-black border-t border-blue-900/30 p-2 text-center">
                <p className="text-gray-400 text-xs italic">{log}</p>
            </div>

            <style>{`
                @keyframes float-up { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-120px); opacity: 0; } }
                .animate-float-up { animation: float-up 1s ease-out forwards; }
                @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
                .animate-shake { animation: shake 0.1s infinite; }
                @keyframes push { 0% { transform: scale(1); } 50% { transform: scale(1.3) translateX(20px); } 100% { transform: scale(1); } }
                .animate-push { animation: push 0.3s ease-out; }
                @keyframes shake-screen { 0% { transform: translate(0); } 25% { transform: translate(5px, 5px); } 50% { transform: translate(-5px, -5px); } 75% { transform: translate(5px, -5px); } 100% { transform: translate(0); } }
                .animate-shake-screen { animation: shake-screen 0.2s infinite; }
            `}</style>
        </div>
    );
};

export default BattleInterface;
