🛡️ Sentinel Outpost - Base Defense
Sentinel Outpost adalah game arcade bergaya retro berbasis web yang menantang pemain untuk mempertahankan pangkalan dari gelombang serangan monster es di tengah badai salju. Dibangun murni menggunakan HTML5 Canvas, CSS3, dan Vanilla JavaScript tanpa memerlukan pustaka atau framework eksternal.

✨ Fitur Utama
AI Musuh (Finite State Machine): Pasukan monster es memiliki perilaku cerdas yang dinamis (bergerak dalam formasi, menukik/dive attack menyerang markas, dan kembali ke formasi).

Web Audio API Engine: Efek suara sintetis secara real-time (suara tembakan api, pecahan es, hingga alarm kekalahan) tanpa memerlukan file audio eksternal.

Cross-Platform Controls: Mendukung kontrol penuh via Keyboard (A/D/Panah/Spasi untuk PC) maupun Tombol Virtual D-Pad (untuk perangkat mobile / touchscreen).

Collision Detection (AABB): Sistem deteksi benturan kotak akurat antara proyektil, markas, dan musuh.

Local High Score: Fitur penyimpanan rekor skor tertinggi secara otomatis menggunakan localStorage browser.

Animasi Badai Salju: Latar belakang dinamis dengan partikel salju turun untuk memperkuat atmosfer musim dingin.

🛠️ Teknologi yang Digunakan
HTML5 Canvas: Untuk perenderan grafis game 2D berkecepatan 60 FPS menggunakan requestAnimationFrame.

CSS3: Pembuatan tata letak antarmuka modern dengan Flexbox dan penguncian orientasi seluler.

Vanilla JavaScript (ES6+): Implementasi Object-Oriented Programming (OOP) menggunakan Class, Constructor, dan Array of Objects.

#🎮 Cara Memainkan
Buka file index.html melalui browser komputer atau perangkat seluler Anda.

Klik tombol START SURVIVAL untuk memulai permainan dan mengaktifkan mesin audio.

Kontrol PC / Laptop:

Tombol Panah Kiri / A & Panah Kanan / D: Menggeser posisi meriam markas.

Tombol Spasi: Menembakkan proyektil suar api.

Kontrol Mobile / Tablet:

Gunakan tombol virtual panah (◀ / ▶) dan tombol bulat (FIRE) di bagian bawah layar.

Hancurkan semua gelombang monster es sebelum mereka berhasil membekukan markas Anda!

📁 Struktur Folder Proyek
Plaintext
sentinel-outpost/
├── index.html             <-- Struktur utama halaman web
├── style.css              <-- Tata letak dan tema visual
└── game.js                <--Logika game, FSM, Audio, dan Game Loop
