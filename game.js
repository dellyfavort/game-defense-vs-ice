// ==========================================
// AUDIO ENGINE (WEB AUDIO API)
// ==========================================
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(frequency, type, duration, volume = 0.1) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = type; // 'square', 'sawtooth', 'sine', 'triangle'
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        // Efek fade out volume
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
        console.log('Audio error:', e);
    }
}


// ==========================================
// 1. MANIPULASI DOM
// ==========================================
const scoreDisplay = document.getElementById('score-display');
const waveDisplay = document.getElementById('wave-display');
const hiDisplay = document.getElementById('hi-display');
const livesDisplay = document.getElementById('lives-display');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');

// ==========================================
// 2. VARIABEL GLOBAL, STATE & FSM MUSUH
// ==========================================
const GAME_WIDTH = 500;
const GAME_HEIGHT = 600;

let gameState = 'START'; 
let score = 0;
let lives = 3;
let wave = 1;

// HIGH SCORE DENGAN LOCALSTORAGE
let highScore = parseInt(localStorage.getItem('sentinel_hi')) || 0;

function saveHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('sentinel_hi', highScore.toString());
    }
}

let sentinel;
let iceMonsters = [];
let fireFlares = [];     
let iceProjectiles = []; // Array peluru musuh (Pecahan Es)

const inputState = { left: false, right: false, fire: false };

// --- VARIABEL AI MUSUH ---
const MONSTER_STATES = {
    FORMATION: 'FORMATION',
    DIVE_OUT: 'DIVE_OUT',
    DIVE_ATTACK: 'DIVE_ATTACK',
    RETURNING: 'RETURNING'
};

let formationDirection = 1; // 1 (Kanan), -1 (Kiri)
let formationSpeed = 0.8;   // Kecepatan gerak barisan
let diveTimer = 120;        // Hitung mundur untuk memicu serangan

// ==========================================
// 3. CETAKAN CLASS (BLUEPRINT)
// ==========================================

// --- MARKAS PEMAIN (BASE DEFENDER) ---
class Sentinel {
    constructor() {
        this.width = 60;  // Dilebarkan agar terlihat seperti pangkalan/bunker
        this.height = 24; // Tinggi proporsional
        this.x = GAME_WIDTH / 2 - this.width / 2; 
        this.y = GAME_HEIGHT - 45;
        this.speed = 5; 
        this.cooldown = 0; 
        this.invincible = 0;
    }
    
    update(inputState) {
        if (inputState.left && this.x > 0) this.x -= this.speed;
        if (inputState.right && this.x < GAME_WIDTH - this.width) this.x += this.speed;
        if (this.cooldown > 0) this.cooldown--;
        if (this.invincible > 0) this.invincible--;
    }

    draw(ctx) {
        if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) return;
        
        // 1. Dasar Bunker/Markas Utama (Warna Es Terang)
        ctx.fillStyle = '#bae6fd'; 
        ctx.fillRect(this.x, this.y + 8, this.width, this.height - 8);
        
        // 2. Lapisan Baja Bawah (Warna Biru Metalik)
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(this.x + 5, this.y + 16, this.width - 10, 6);

        // 3. Kubah Meriam Utama di Tengah (Bentuk seperti meriam benteng, bukan lilin)
        ctx.fillStyle = '#fbbf24'; // Kuning Pemanas / Bara Api
        ctx.fillRect(this.x + 22, this.y, 16, 12);
        
        // 4. Laras Meriam (Titik keluar api)
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(this.x + 27, this.y - 4, 6, 6);
    }

    shoot(projectilesArray) {
        if (this.cooldown <= 0) {
            // Peluru keluar pas dari ujung laras meriam tengah
            projectilesArray.push(new FireFlare(this.x + this.width / 2 - 4, this.y - 12));
            playSound(700, 'square', 0.08, 0.05); // Efek suara tembakan api
            this.cooldown = 15; 
        }
    }
}

// --- PROYEKTIL API (BOLA API/SUAR) ---
class FireFlare {
    constructor(x, y) {
        this.x = x; 
        this.y = y; 
        this.width = 8;   // Dibuat lebih besar agar tidak terlihat sebagai garis tipis
        this.height = 16; 
        this.speed = 7; 
        this.active = true;
    }
    update() {
        this.y -= this.speed;
        if (this.y < 0) this.active = false;
    }
    draw(ctx) {
        // Efek visual proyektil berbentuk suar api
        ctx.fillStyle = '#ef4444'; // Merah luar
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.fillStyle = '#fde047'; // Inti api kuning menyala di tengah
        ctx.fillRect(this.x + 2, this.y + 3, 4, 10);
    }
}

// --- PELURU MUSUH (PECAHAN ES) ---
class IceProjectile {
    constructor(x, y, speed) {
        this.x = x; this.y = y; this.width = 6; this.height = 6;
        this.speed = speed; this.active = true;
    }
    update() {
        this.y += this.speed;
        if (this.y > GAME_HEIGHT) this.active = false;
    }
    draw(ctx) {
        ctx.fillStyle = '#00ffff'; // Warna Cyan Es
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// --- PASUKAN MUSUH (DENGAN FINITE STATE MACHINE) ---
class IceMonster {
    constructor(homeX, homeY, type, row, col) {
        this.homeX = homeX; this.homeY = homeY;
        this.x = homeX; this.y = homeY;
        this.width = 30; this.height = 22;
        this.type = type; this.row = row; this.col = col;
        this.alive = true;
        
        // Property AI
        this.state = MONSTER_STATES.FORMATION;
        this.diveProgress = 0;
        this.startX = 0; this.startY = 0;
        this.hasShot = false;
    }

    update(formDir, formSpeed) {
        if (!this.alive) return;

        // STATE 1: FORMATION (Bergerak bersama barisan)
        if (this.state === MONSTER_STATES.FORMATION) {
            this.homeX += formSpeed * formDir;
            this.x = this.homeX;
            this.y = this.homeY;
        } 
        // STATE 2 & 3: DIVE (Menukik & Menyerang)
        else if (this.state === MONSTER_STATES.DIVE_OUT || this.state === MONSTER_STATES.DIVE_ATTACK) {
            this.updateDive();
        } 
        // STATE 4: RETURNING (Kembali ke formasi)
        else if (this.state === MONSTER_STATES.RETURNING) {
            this.updateReturn();
        }
    }

    updateDive() {
        this.diveProgress += 0.012;

        if (this.state === MONSTER_STATES.DIVE_OUT) {
            // Fase awal: Naik/mundur sedikit dari barisan
            if (this.diveProgress < 0.15) {
                this.y = this.homeY - this.diveProgress * 100;
            } else {
                this.state = MONSTER_STATES.DIVE_ATTACK;
                this.diveProgress = 0;
                this.startX = this.x;
                this.startY = this.y;
                this.hasShot = false;
            }
        } 
        else if (this.state === MONSTER_STATES.DIVE_ATTACK) {
            const t = this.diveProgress;
            
            // Gerakan X: Sinusoidal (Melengkung kiri-kanan)
            const amplitude = 80;
            this.x = this.startX + Math.sin(t * Math.PI * 2) * amplitude * (1 - t);
            
            // Gerakan Y: Percepatan ke bawah (Kuadratik)
            this.y = this.startY + (GAME_HEIGHT + 50 - this.startY) * (t * t);

            // Tembak es saat di pertengahan lintasan (t antara 0.4 dan 0.6)
            if (!this.hasShot && t > 0.4 && t < 0.6) {
                iceProjectiles.push(new IceProjectile(this.x + this.width/2 - 3, this.y + this.height, 5));
                this.hasShot = true;
            }

            // Lewat layar bawah -> kembali ke formasi
            if (this.y > GAME_HEIGHT + 30) {
                this.state = MONSTER_STATES.RETURNING;
                this.x = this.homeX; // Mulai turun lagi dari atas pas di atas koordinat rumahnya
                this.y = -30;
            }
        }
    }

    updateReturn() {
        // Bergerak perlahan menuju koordinat asal (homeX, homeY)
        const dx = this.homeX - this.x;
        const dy = this.homeY - this.y;
        this.x += dx * 0.05;
        this.y += dy * 0.05;

        // Jika sudah dekat, kunci kembali ke state formasi
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
            this.x = this.homeX;
            this.y = this.homeY;
            this.state = MONSTER_STATES.FORMATION;
        }
    }

    draw(ctx) {
        if (!this.alive) return;
        const colors = ['#f8fafc', '#7dd3fc', '#0284c7']; 
        ctx.fillStyle = colors[this.type];
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}


// ==========================================
// 4. SISTEM TABRAKAN & KENDALI MUSUH
// ==========================================
function isColliding(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

function sentinelHit() {
    lives--;
    updateHUD();
    playSound(200, 'triangle', 0.2, 0.15); // Efek suara markas terkena hit
    if (lives <= 0) {
        gameState = 'GAMEOVER';
        saveHighScore();
        playSound(80, 'square', 0.4, 0.15); // Efek suara game over
    } else {
        sentinel.invincible = 120; // Kebal 2 detik
    }
}

function checkCollisions() {
    // 1. Api Pemain vs Monster Es
    for (let i = fireFlares.length - 1; i >= 0; i--) {
        let flare = fireFlares[i];
        for (let j = iceMonsters.length - 1; j >= 0; j--) {
            let monster = iceMonsters[j];
            if (monster.alive && flare.active && isColliding(flare, monster)) {
                monster.alive = false; 
                flare.active = false;  
                score += (monster.state === MONSTER_STATES.FORMATION) ? 50 : 100; // Poin ganda jika ditembak saat terbang
                playSound(150, 'sawtooth', 0.15, 0.1); // Efek suara monster hancur/mencair
                updateHUD();
                break;
            }
        }
    }

    // 2. Markas vs Monster (Tabrakan Fisik) & Peluru Es (Tembakan Musuh)
    if (sentinel.invincible <= 0) {
        // Tertabrak Monster
        for (let monster of iceMonsters) {
            if (monster.alive && isColliding(monster, sentinel)) {
                monster.alive = false; 
                sentinelHit();
                return; // Langsung keluar agar tidak hit dobel
            }
        }
        // Tertembak Es
        for (let proj of iceProjectiles) {
            if (proj.active && isColliding(proj, sentinel)) {
                proj.active = false;
                sentinelHit();
                return;
            }
        }
    }
}

// TRIGGER SERANGAN MUSUH
function triggerMonsterDive() {
    diveTimer--;
    if (diveTimer <= 0) {
        // Cari monster yang masih hidup dan ada di barisan
        const candidates = iceMonsters.filter(m => m.alive && m.state === MONSTER_STATES.FORMATION);
        
        if (candidates.length > 0) {
            const randomMonster = candidates[Math.floor(Math.random() * candidates.length)];
            randomMonster.state = MONSTER_STATES.DIVE_OUT;
            randomMonster.diveProgress = 0;
        }
        
        // Reset timer, makin tinggi Wave makin cepat serangannya
        diveTimer = Math.max(30, 120 - (wave * 10));
    }
}

// CEK GELOMBANG (WAVE) BARU
function checkNextWave() {
    // Jika tidak ada lagi monster yang hidup, naikkan wave
    const allDead = iceMonsters.every(m => !m.alive);
    if (allDead) {
        wave++;
        initMonsters(); // Buat ulang pasukan
        updateHUD();
    }
}


// ==========================================
// 5. HELPER & BACKGROUND
// ==========================================
const snowflakes = [];
function initSnow() {
    for (let i = 0; i < 80; i++) snowflakes.push({ x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT, speed: Math.random() * 1.5 + 0.5, size: Math.random() < 0.3 ? 2 : 1 });
}
function updateSnow() {
    for (let flake of snowflakes) { flake.y += flake.speed; if (flake.y > GAME_HEIGHT) { flake.y = 0; flake.x = Math.random() * GAME_WIDTH; } }
}
function drawSnow() {
    ctx.fillStyle = '#ffffff';
    for (let flake of snowflakes) { ctx.globalAlpha = 0.4 + flake.speed * 0.2; ctx.fillRect(flake.x, flake.y, flake.size, flake.size); }
    ctx.globalAlpha = 1.0; 
}
function updateProjectiles(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
        arr[i].update();
        if (!arr[i].active) arr.splice(i, 1); 
    }
}
function drawProjectiles(arr) {
    for (let p of arr) { if (p.active) p.draw(ctx); }
}


// ==========================================
// 6. INISIALISASI GAME & LOOP UTAMA
// ==========================================
function initMonsters() {
    iceMonsters = [];
    formationDirection = 1;
    // Semakin tinggi wave, formasi gerak makin cepat
    formationSpeed = Math.min(3, 0.8 + (wave * 0.2)); 
    diveTimer = 120;

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
            let type = r === 0 ? 0 : (r < 3 ? 1 : 2);
            iceMonsters.push(new IceMonster(70 + c * 45, 60 + r * 40, type, r, c));
        }
    }
}

function initGame() {
    sentinel = new Sentinel();
    fireFlares = [];
    iceProjectiles = [];
    score = 0; lives = 3; wave = 1;
    initMonsters();
    updateHUD();
}

function updateHUD() {
    scoreDisplay.textContent = 'SCORE: ' + String(score).padStart(4, '0');
    hiDisplay.textContent = 'HI: ' + String(highScore).padStart(4, '0');
    waveDisplay.textContent = 'WAVE: ' + wave;
    livesDisplay.textContent = '♥ ' + lives;
}

function gameLoop() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    updateSnow(); drawSnow();

    if (gameState === 'PLAYING') {
        
        // --- 1. LOGIKA PEMAIN ---
        sentinel.update(inputState);
        if (inputState.fire) sentinel.shoot(fireFlares);
        
        // --- 2. LOGIKA MUSUH (FORMASI & TRIGGER DIVE) ---
        // Cek benturan formasi dengan dinding layar
        let hitEdge = false;
        for (let m of iceMonsters) {
            if (m.alive && m.state === MONSTER_STATES.FORMATION) {
                if (m.homeX <= 10 || m.homeX + m.width >= GAME_WIDTH - 10) hitEdge = true;
            }
        }
        if (hitEdge) formationDirection *= -1; // Balik arah

        triggerMonsterDive();
        
        // --- 3. UPDATE POSISI SEMUA ---
        iceMonsters.forEach(m => m.update(formationDirection, formationSpeed));
        updateProjectiles(fireFlares);
        updateProjectiles(iceProjectiles);

        // --- 4. CEK TABRAKAN & WAVE ---
        checkCollisions();
        checkNextWave();

        // --- 5. GAMBAR SEMUANYA ---
        sentinel.draw(ctx);
        iceMonsters.forEach(m => m.draw(ctx));
        drawProjectiles(fireFlares);
        drawProjectiles(iceProjectiles);

    } else if (gameState === 'GAMEOVER') {
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 36px Courier New'; ctx.textAlign = 'center';
        ctx.fillText('MARKAS MEMBEKU!', GAME_WIDTH/2, GAME_HEIGHT/2);
    }

    requestAnimationFrame(gameLoop);
}


// ==========================================
// 7. INPUT HANDLING
// ==========================================
startBtn.addEventListener('click', () => { 
    initAudio(); // Inisialisasi audio saat tombol start diklik
    initGame(); 
    gameState = 'PLAYING'; 
    overlay.classList.add('hidden'); 
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputState.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputState.right = true;
    if (e.key === ' ') inputState.fire = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputState.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputState.right = false;
    if (e.key === ' ') inputState.fire = false;
});

function setupTouchButton(id, stateKey) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); inputState[stateKey] = true; btn.classList.add('active'); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); inputState[stateKey] = false; btn.classList.remove('active'); });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); inputState[stateKey] = false; btn.classList.remove('active'); });
}
setupTouchButton('btn-left', 'left'); setupTouchButton('btn-right', 'right'); setupTouchButton('btn-fire', 'fire');

// MULAI
initSnow();
requestAnimationFrame(gameLoop);