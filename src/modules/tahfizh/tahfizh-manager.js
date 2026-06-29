// File: tahfizh-manager.js
// Manager khusus untuk mengontrol Modul Tahfizh (Setor.in) khusus peran Musyrif

document.addEventListener('DOMContentLoaded', () => {
    // Pastikan template fragment dan modul terpasang di window
    window.initTahfizhTab = initTahfizhTab;
});

// Konfigurasi Tahfizh (Sama seperti Setor.in config.js)
const TahfizhConfig = {
    scriptURL: 'https://script.google.com/macros/s/AKfycbyl2FCcGUtolkJIDsoiTYFKeKp8IQwHT0V3z8n1pOHH9CLiyvYZTBaimrojILJM_A-HLg/exec',
    musyrifSortOrder: ['Andi Aqillah Fadia Haswat', 'Abdullah', 'Muhammad Zhafir Setiaji'],
    deadlineJuz30Score: new Date('2026-01-03T23:59:59'),
    deadlineTahfizhTuntas: new Date('2026-06-27T12:30:00'),
    rules: {
        halfJuzKeyPattern: 'juz{juz}_setengah',
        halfJuzPages: 9,
        halfJuzOptions: [30, 29, 28],
        scoreMutqinJuz: 30,
        tuntasRequiredMutqinJuz: [29, 30],
        progressFocusJuz: [30, 29],
        targetTracking: [
            { id: 'mutqin-30', type: 'mutqin-juz', juz: 30, label: 'Mutqin Juz 30' },
            { id: 'mutqin-29', type: 'mutqin-juz', juz: 29, label: 'Mutqin Juz 29' },
            { id: 'half-juz-30', type: 'half-juz', juz: 30 },
            { id: 'half-juz-29', type: 'half-juz', juz: 29 },
            { id: 'half-juz-28', type: 'half-juz', juz: 28 }
        ],
        raporFocusJuz: [30, 29, 28, 1],
        hiddenZiyadahBaseJuz: ['30', '29'],
        labels: {
            tuntas: 'Tuntas',
            belum: 'Belum',
            proses: 'Proses',
            bolehPulang: 'Boleh Pulang',
            belumBolehPulang: 'Belum Boleh Pulang',
            halfJuz: 'Setengah Juz {juz}',
            perpulangan: 'Perpulangan'
        }
    },
    perpulanganPeriods: [
        { name: 'Perpulangan', deadline: new Date('2026-06-27T12:30:00'), required: [29, 30], type: 'mutqin' }
    ],
    scoringTiers: [
        { score: 80, required: ["An-Naba", "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infithor', 'Al-Muthoffifin', 'Al-Insyiqaq', 'Al-Buruj', 'Ath-Thariq'] },
        { score: 76, required: ["An-Naba", "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infithor', 'Al-Muthoffifin', 'Al-Insyiqaq', 'Al-Buruj'] },
        { score: 72, required: ["An-Naba", "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infithor', 'Al-Muthoffifin', 'Al-Insyiqaq'] },
        { score: 64, required: ["An-Naba", "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infithor', 'Al-Muthoffifin'] },
        { score: 52, required: ["An-Naba", "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infithor'] },
        { score: 44, required: ["An-Naba", "An-Nazi'at", 'Abasa', 'At-Takwir'] },
        { score: 36, required: ["An-Naba", "An-Nazi'at", 'Abasa'] },
        { score: 24, required: ["An-Naba", "An-Nazi'at"] },
        { score: 12, required: ['An-Naba'] }
    ],
    hafalanData: null // Akan diisi oleh referensi dari server
};
TahfizhConfig.dummyModeKey = 'tahfizh_dummy_mode';

function applyTahfizhRuntimeConfig() {
    const runtimeConfig = window.APP_TAHFIZH_CONFIG || {};
    if (runtimeConfig.deadlineJuz30Score) {
        TahfizhConfig.deadlineJuz30Score = new Date(runtimeConfig.deadlineJuz30Score);
    }
    if (runtimeConfig.deadlineTahfizhTuntas) {
        TahfizhConfig.deadlineTahfizhTuntas = new Date(runtimeConfig.deadlineTahfizhTuntas);
    }
    if (Array.isArray(runtimeConfig.perpulanganPeriods)) {
        TahfizhConfig.perpulanganPeriods = runtimeConfig.perpulanganPeriods.map(period => ({
            ...period,
            deadline: new Date(period.deadline),
        }));
    }
}

function isTahfizhDummyModeAllowed() {
    return Boolean(window.APP_TAHFIZH_CONFIG?.allowDummyMode)
        || localStorage.getItem('DEBUG_LOGS') === 'true'
        || location.search.includes('debug=true');
}

function getTahfizhRules() {
    return TahfizhConfig.rules || {};
}

function getTahfizhLabels() {
    return getTahfizhRules().labels || {};
}

function getHalfJuzKey(juz) {
    return (getTahfizhRules().halfJuzKeyPattern || 'juz{juz}_setengah').replace('{juz}', String(juz));
}

function getHalfJuzPages() {
    return Number(getTahfizhRules().halfJuzPages) || 0;
}

function getTuntasRequiredMutqinJuz() {
    return getTahfizhRules().tuntasRequiredMutqinJuz || [];
}

function getHalfJuzNumber(juz) {
    const pattern = getTahfizhRules().halfJuzKeyPattern || 'juz{juz}_setengah';
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{juz\\}', '(\\d+)');
    const match = String(juz).match(new RegExp(`^${escaped}$`));
    return match ? Number(match[1]) : null;
}

function isHalfJuz(juz) {
    return getHalfJuzNumber(juz) !== null;
}

function hasMutqinJuz(santri, juz) {
    return santri.mutqinJuz.has(Number(juz));
}

function isTahfizhTuntas(santri) {
    return getTuntasRequiredMutqinJuz().every(juz => hasMutqinJuz(santri, juz));
}

function getTahfizhJuzLabel(juz) {
    const halfJuzNumber = getHalfJuzNumber(juz);
    if (halfJuzNumber !== null) {
        return (getTahfizhLabels().halfJuz || 'Setengah Juz {juz}').replace('{juz}', String(halfJuzNumber));
    }
    return `Juz ${juz}`;
}

function getMutqinRequirementLabel(juz) {
    return `Mutqin ${getTahfizhJuzLabel(juz)}`;
}

function getTahfizhTargetDefinitions() {
    const targets = getTahfizhRules().targetTracking || [];
    return targets.map((target, index) => ({
        ...target,
        id: target.id || `${target.type || 'target'}-${target.juz || target.minValue || index}`,
        label: target.label || (target.labelKey ? getTahfizhLabels()[target.labelKey] : null) || (target.type === 'half-juz' ? getTahfizhJuzLabel(getHalfJuzKey(target.juz)) : getTahfizhJuzLabel(target.juz))
    }));
}

function isTahfizhTargetMet(santri, target) {
    if (!target) return false;
    if (target.type === 'mutqin-juz') return hasMutqinJuz(santri, target.juz);
    if (target.type === 'half-juz') return santri.halfJuz.has(Number(target.juz));
    if (target.type === 'nilai-minimum') return (Number(santri.nilai) || 0) >= (Number(target.minValue) || 0);
    if (target.type === 'setoran-minimum') return (Number(santri.setoranCount) || 0) >= (Number(target.minValue) || 0);
    if (target.type === 'halaman-minimum') return (Number(santri.totalPages) || 0) >= (Number(target.minValue) || 0);
    return false;
}

// State Modul Tahfizh
const TahfizhState = {
    allSetoran: [],
    verifiedSetoran: [],
    pendingSetoran: [],
    rawSantriList: [],      // Diisi dari MASTER_SANTRI presensi utama
    santriData: [],         // Data santri yang telah diproses statistiknya
    classGroups: {},        // Pengelompokan santri berdasarkan musyrif kelas
    
    // Utils
    isLoaded: false,
    setoranIdToDelete: null,
    searchDebounceTimer: null,
    santriNameMap: new Map(),
    studentProgramMap: new Map(), // Memetakan Nama -> Program dari database Tahfizh
    chartInstance: null,
    countdownInterval: null,
    useDummyData: false,
};
window.TahfizhState = TahfizhState;

function parseTahfizhJSON(raw, fallback) {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (error) {
        console.warn("Data lokal Tahfizh tidak valid, memakai fallback:", error);
        return fallback;
    }
}

async function fetchTahfizhMetadata() {
    const candidates = [
        'src/data/tahfizh_metadata.json',
        './src/data/tahfizh_metadata.json',
        './data/tahfizh_metadata.json',
        'data/tahfizh_metadata.json'
    ];

    let lastError = null;
    for (const path of candidates) {
        try {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            return await response.json();
        } catch (error) {
            lastError = error;
            console.warn(`Gagal memuat metadata Tahfizh dari ${path}:`, error);
        }
    }

    throw lastError || new Error('Metadata Tahfizh tidak ditemukan');
}

function shouldSendTahfizhPendingNotification(pendingCount) {
    if (!pendingCount || !window.sendLocalNotification) return false;
    if (appState?.settings?.notifications === false) return false;
    if (typeof window.isMusyrifNotificationTypeEnabled === 'function' && !window.isMusyrifNotificationTypeEnabled('setoran_pending')) return false;

    const today = window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().slice(0, 10);
    const key = 'tahfizh_pending_notif_state';
    const state = parseTahfizhJSON(localStorage.getItem(key), {});
    if (state.date === today && Number(state.count) === Number(pendingCount)) return false;

    localStorage.setItem(key, JSON.stringify({ date: today, count: pendingCount, sentAt: new Date().toISOString() }));
    return true;
}

function notifyWaliTahfizhVerified(studentNis, studentName, detail) {
    const normalizedNis = String(studentNis || '').trim();
    if (!normalizedNis || typeof window.addNotification !== 'function') return;

    window.addNotification(
        'wali',
        normalizedNis,
        'Setoran Hafalan Disetujui',
        `Alhamdulillah! Setoran hafalan ${detail} untuk ${studentName} telah disetujui oleh Musyrif.`,
        'tahfizh',
        'tab=tahfizh'
    );
}

// DOM Cache untuk Tahfizh
const TDOM = {};

function cacheTahfizhDOM() {
    const elementMapping = {
        mainContent: 'tab-tahfizh',
        
        // -- Validation Section --
        validationSection: 'tahfizh-validation-section',
        validationContainer: 'tahfizh-validation-container',
        validationCount: 'tahfizh-validation-count',
        
        // -- Form Input --
        setoranForm: 'tahfizh-setoranForm',
        tanggal: 'tahfizh-tanggal',
        nowBtn: 'tahfizh-nowBtn',
        musyrif: 'tahfizh-musyrif',
        namaSantri: 'tahfizh-namaSantri',
        santriId: 'tahfizh-santriId',
        kelas: 'tahfizh-kelas',
        program: 'tahfizh-program',
        jenis: 'tahfizh-jenis',
        juz: 'tahfizh-juz',
        halamanContainer: 'tahfizh-halaman-container',
        halaman: 'tahfizh-halaman',
        suratContainer: 'tahfizh-surat-container',
        surat: 'tahfizh-surat-checklist-area',
        submitButton: 'tahfizh-submit-button',
        submitButtonText: 'tahfizh-submit-button-text',
        submitButtonIcon: 'tahfizh-submit-button-icon',
        submitSpinner: 'tahfizh-submit-spinner',

        // -- Riwayat & Tabel --
        setoranTableBody: 'tahfizh-setoranTableBody',
        historyRowTemplate: 'tahfizh-history-row-template',
        searchRiwayat: 'tahfizh-search-riwayat',
        suggestionsContainer: 'tahfizh-suggestions-container',
        filterTanggalMulai: 'tahfizh-filter-tanggal-mulai',
        filterTanggalAkhir: 'tahfizh-filter-tanggal-akhir',
        filterKelas: 'tahfizh-filter-kelas',
        historyModeLabel: 'tahfizh-history-mode-label',
        dummyToggle: 'tahfizh-dummy-toggle',

        // -- Statistik Beranda --
        homeOverview: 'tahfizh-home-overview',
        focusSummary: 'tahfizh-focus-summary',
        recentActivity: 'tahfizh-recent-activity',

        // -- Sections Lain --
        peringkatSection: 'tahfizh-peringkat-section',
        tuntasTrackingAccordion: 'tahfizh-tuntas-tracking-accordion',
        tahfizhTuntasTrackingSection: 'tahfizh-tuntas-tracking-section',
        jadwalPerpulanganSection: 'tahfizh-jadwal-perpulangan-section',

        // -- Rekap & Analisis --
        rekapSelect: 'tahfizh-rekap-select',
        rekapContentContainer: 'tahfizh-rekap-content-container',
        rekapContentTemplate: 'tahfizh-rekap-content-template',
        santriSelectAnalisis: 'tahfizh-santri-select-analisis',
        analisisContentContainer: 'tahfizh-analisis-content-container',
        analisisDashboardTemplate: 'tahfizh-analisis-dashboard-template',
        analisisPromptTemplate: 'tahfizh-analisis-prompt-template',

        // -- Modals --
        studentDetailModal: 'tahfizhStudentDetailModal',
        detailNama: 'tahfizh-detail-nama',
        detailInfo: 'tahfizh-detail-info',
        progressChart: 'tahfizh-progressChart',
        juzVisualContainer: 'tahfizh-juz-visual-container',
        confirmDeleteBtn: 'tahfizh-confirmDeleteBtn',

        // -- HTML Templates --
        tplJadwalPerpulangan: 'tahfizh-tpl-jadwal-perpulangan',
        tplAccordionItem: 'tahfizh-tpl-accordion-item',
        tplPeringkatSection: 'tahfizh-tpl-peringkat-section',
        tplPeringkatItem: 'tahfizh-tpl-peringkat-item',
        tplTahfizhSection: 'tahfizh-tpl-tahfizh-section',
        tplTahfizhContent: 'tahfizh-tpl-tahfizh-content',
        tplJuzBlock: 'tahfizh-tpl-juz-block',
        tplRekapRow: 'tahfizh-tpl-rekap-row',
        tplValidationItem: 'tahfizh-tpl-validation-item'
    };

    for (const [propName, id] of Object.entries(elementMapping)) {
        const element = document.getElementById(id);
        if (element) TDOM[propName] = element;
    }
}

// Sub-tab Navigation
window.switchTahfizhSubTab = function(subtabName) {
    if (window.isWaliMode?.()) {
        subtabName = 'analisis';
    }

    document.querySelectorAll('.tahfizh-page-content').forEach(el => el.classList.add('hidden'));
    
    const target = document.getElementById(`tahfizh-page-${subtabName}`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.tahfizh-sub-nav-btn').forEach(btn => {
        if (btn.dataset.subtab === subtabName) {
            btn.classList.remove('active');
            void btn.offsetWidth;
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    window.syncRoleModeUI?.();
    if (window.lucide) window.lucide.createIcons();

    if (subtabName === 'rekap-global' && window.renderAdminTahfizhList) {
        window.renderAdminTahfizhList();
    }
};

// Main entry point dari tab-manager
async function initTahfizhTab() {
    applyTahfizhRuntimeConfig();
    cacheTahfizhDOM();
    setupTahfizhEventListeners();
    setupAdditionalInputListeners();
    
    // Selalu muat ulang data untuk menyinkronkan filter kelas bimbingan aktif
    await reloadTahfizhData();
    TahfizhState.isLoaded = true;

    if (window.isWaliMode?.()) {
        window.switchTahfizhSubTab('analisis');
        if (typeof renderTahfizhSantriRaporDashboard === 'function') {
            renderTahfizhSantriRaporDashboard(window.getWaliPrimaryId());
        }
    }

    window.syncRoleModeUI?.();
}

// Sinkronisasi data kelas & santri dari master data presensi
function syncSiswaFromMainApp() {
    if (typeof MASTER_SANTRI === 'undefined' || MASTER_SANTRI.length === 0) return;

    const activeClass = appState.selectedClass;
    if (!activeClass) return;

    // Musyrif melihat kelas aktif; Wali hanya melihat santri yang login.
    const classStudents = (window.isWaliMode?.() && window.getWaliPrimaryId?.())
        ? MASTER_SANTRI.filter(s => String(s.nis || s.id) === window.getWaliPrimaryId())
        : MASTER_SANTRI.filter(s => {
        const kelas = String(s.kelas || s.rombel || '').trim();
        return kelas === activeClass;
    });

    // Map properti dari spreadsheet (program tidak lagi dipakai sebagai pembeda)
    TahfizhState.rawSantriList = classStudents.map(s => {
        const musyrif = (window.classData && window.classData[s.kelas]?.musyrif) || s.musyrif_khusus || '-';
        return {
            id: s.nis || s.id,
            nama: s.nama,
            kelas: s.kelas,
            program: '',
            musyrif: musyrif
        };
    });

    TahfizhState.santriNameMap = new Map(TahfizhState.rawSantriList.map(s => [normalizeTahfizhName(s.nama), s.id]));
}

function isTahfizhDummyModeEnabled() {
    return isTahfizhDummyModeAllowed() && localStorage.getItem(TahfizhConfig.dummyModeKey) === 'true';
}

function setTahfizhDummyMode(enabled) {
    if (enabled && !isTahfizhDummyModeAllowed()) {
        localStorage.removeItem(TahfizhConfig.dummyModeKey);
        TahfizhState.useDummyData = false;
        if (window.showToast) window.showToast('Mode dummy hanya tersedia saat debug/demo aktif.', 'warning');
        updateTahfizhDummyToggleUI();
        return;
    }
    localStorage.setItem(TahfizhConfig.dummyModeKey, enabled ? 'true' : 'false');
    TahfizhState.useDummyData = enabled;
    updateTahfizhDummyToggleUI();
}

function updateTahfizhDummyToggleUI() {
    if (!TDOM.dummyToggle) return;
    const enabled = TahfizhState.useDummyData;
    TDOM.dummyToggle.classList.toggle('bg-orange-500', enabled);
    TDOM.dummyToggle.classList.toggle('text-white', enabled);
    TDOM.dummyToggle.classList.toggle('border-orange-400', enabled);
    TDOM.dummyToggle.classList.toggle('shadow-orange-500/20', enabled);
    TDOM.dummyToggle.classList.toggle('bg-white/80', !enabled);
    TDOM.dummyToggle.classList.toggle('dark:bg-slate-900/80', !enabled);
    TDOM.dummyToggle.classList.toggle('text-slate-500', !enabled);
    TDOM.dummyToggle.classList.toggle('dark:text-slate-400', !enabled);
    TDOM.dummyToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    TDOM.dummyToggle.title = enabled ? 'Matikan data dummy Tahfizh' : 'Nyalakan data dummy Tahfizh';
}

async function toggleTahfizhDummyMode() {
    const next = !TahfizhState.useDummyData;
    setTahfizhDummyMode(next);
    if (window.showToast) {
        window.showToast(next ? 'Mode data dummy Tahfizh aktif.' : 'Mode data dummy Tahfizh dimatikan.', 'info');
    }
    await reloadTahfizhData();
}

function setupTahfizhSecretTrigger() {
    const trigger = document.getElementById('tahfizh-secret-trigger');
    if (!trigger || trigger.dataset.secretReady === 'true') return;
    trigger.dataset.secretReady = 'true';
    let taps = 0;
    let timer = null;
    trigger.addEventListener('click', () => {
        taps += 1;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            taps = 0;
            timer = null;
        }, 1400);
        if (taps >= 5) {
            taps = 0;
            if (timer) clearTimeout(timer);
            timer = null;
            toggleTahfizhDummyMode();
        }
    });
}

function generateTahfizhDummySetoran() {
    const baseDate = new Date();
    const classStudents = TahfizhState.rawSantriList.slice(0, Math.min(10, TahfizhState.rawSantriList.length));
    const suratJuz30 = ['An-Naba', "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infithor', 'Al-Muthoffifin', 'Al-Insyiqaq'];
    const suratJuz29 = ['Al-Mulk', 'Al-Qalam', 'Al-Haqqah', 'Al-Maarij'];
    const dummyRows = [];

    classStudents.forEach((santri, idx) => {
        const total = 2 + (idx % 4);
        for (let i = 0; i < total; i++) {
            const createdAt = new Date(baseDate);
            createdAt.setDate(baseDate.getDate() - (idx + i));
            createdAt.setHours(7 + (i % 5), (idx * 11 + i * 7) % 60, 0, 0);
            const isMutqin = i === 0 && idx % 3 === 0;
            const juz = isMutqin ? (idx % 2 === 0 ? 30 : 29) : (idx % 4 === 0 ? 29 : 30);
            const suratList = juz === 29 ? suratJuz29 : suratJuz30;
            dummyRows.push({
                rowNumber: `dummy-${idx}-${i}`,
                source: 'dummy',
                localCreatedAt: createdAt.toISOString(),
                timestamp: createdAt.toISOString(),
                tanggal: createdAt.toISOString(),
                santriId: santri.id,
                namaSantri: santri.nama,
                kelas: santri.kelas,
                program: '',
                jenis: isMutqin ? 'Mutqin' : (i % 2 === 0 ? 'Ziyadah' : 'Murajaah'),
                juz,
                surat: suratList[(idx + i) % suratList.length],
                halaman: isMutqin ? '' : (0.5 + ((idx + i) % 4) * 0.5).toFixed(1),
                Status: i === total - 1 && idx % 5 === 0 ? 'Pending' : 'Verified',
            });
        }
    });

    return dummyRows;
}

// Mengambil data setoran hafalan & referensi dari localStorage (fallback ke metadata lokal jika kosong)
async function reloadTahfizhData() {
    try {
        console.log("📥 Memuat data Tahfizh dari localStorage...");
        TahfizhState.useDummyData = isTahfizhDummyModeEnabled();
        let setoranList = typeof window.getTahfizhSetoran === 'function' ? window.getTahfizhSetoran() : null;
        let localSetoran = setoranList ? JSON.stringify(setoranList) : localStorage.getItem('tahfizh_local_setoran');
        let localMetadata = localStorage.getItem('tahfizh_local_metadata');

        if (!localSetoran) {
            if (typeof window.saveTahfizhSetoran === 'function') {
                window.saveTahfizhSetoran([]);
            } else {
                localStorage.setItem('tahfizh_local_setoran', JSON.stringify([]));
            }
            localSetoran = JSON.stringify([]);
        }

        if (!localMetadata) {
            console.log("📥 Database lokal kosong, memuat data/tahfizh_metadata.json...");
            // Cegah fetch dari file:// protocol (file lokal)
            if (window.location.protocol === "file:") {
                console.warn("⚠️ Tidak bisa fetch dari file:// protocol. Menggunakan data kosong.");
                localStorage.setItem('tahfizh_local_metadata', JSON.stringify({ refJuz: [], refSurat: [] }));
                localMetadata = JSON.stringify({ refJuz: [], refSurat: [] });
            } else {
                const data = await fetchTahfizhMetadata();
                localStorage.setItem('tahfizh_local_metadata', JSON.stringify({ refJuz: data.refJuz || [], refSurat: data.refSurat || [] }));
                localMetadata = JSON.stringify({ refJuz: data.refJuz || [], refSurat: data.refSurat || [] });
            }
        }

        const parsedSetoran = setoranList || parseTahfizhJSON(localSetoran, []);
        let parsedMetadata = parseTahfizhJSON(localMetadata, { refJuz: [], refSurat: [] });
        if (!Array.isArray(parsedMetadata.refJuz) || !Array.isArray(parsedMetadata.refSurat)) {
            parsedMetadata = { refJuz: [], refSurat: [] };
            localStorage.setItem('tahfizh_local_metadata', JSON.stringify(parsedMetadata));
        }

        const data = {
            setoran: parsedSetoran,
            refJuz: parsedMetadata.refJuz,
            refSurat: parsedMetadata.refSurat,
            santri: []
        };

        processTahfizhResponse(data);
        if (typeof window.updateCommandCenterStats === 'function') {
            window.updateCommandCenterStats();
        }

        // Notifikasi: Ada setoran tahfizh pending
        const pendingCount = TahfizhState.pendingSetoran?.length || 0;
        if (shouldSendTahfizhPendingNotification(pendingCount)) {
          window.sendLocalNotification(
            "Setoran Menunggu Validasi",
            `Ada ${pendingCount} setoran hafalan yang menunggu persetujuan Anda.`
          );
        }
    } catch (error) {
        console.error("Gagal memuat data Tahfizh:", error);
        if (window.showToast) window.showToast("Gagal memuat data Tahfizh.", "error");
    }
}

function processTahfizhResponse(response) {
    if (!response) return;

    // 1. Proses data referensi Juz & Surat
    if (response.refJuz && response.refSurat) {
        TahfizhConfig.hafalanData = processHafalanReferens(response.refJuz, response.refSurat);
        localStorage.setItem('cachedTahfizhHafalanRef', JSON.stringify(TahfizhConfig.hafalanData));
    } else {
        const cachedHafalan = localStorage.getItem('cachedTahfizhHafalanRef');
        if (cachedHafalan) TahfizhConfig.hafalanData = JSON.parse(cachedHafalan);
    }

    // 2. Program lama dari metadata tidak dipakai sebagai pembeda di modul ini.
    if (response.santri) {
        TahfizhState.studentProgramMap = new Map();
    }

    // 3. Sinkronkan dengan master data presensi utama
    syncSiswaFromMainApp();

    // 4. Proses Setoran
    if (response.setoran) {
        const activeStudentNames = new Set(TahfizhState.rawSantriList.map(s => normalizeTahfizhName(s.nama)));
        const sourceSetoran = TahfizhState.useDummyData
            ? [...response.setoran, ...generateTahfizhDummySetoran()]
            : response.setoran;
        
        // Hanya muat setoran lokal untuk santri yang ada di kelas aktif Musyrif.
        // Data seed/metadata lama tidak ikut ditampilkan di riwayat.
        const filteredSetoran = sourceSetoran.filter(item => {
            const localOwned = item.source === 'local' || (TahfizhState.useDummyData && item.source === 'dummy') || item.timestamp || item.localCreatedAt;
            const normName = normalizeTahfizhName(item.namaSantri || item.NamaSantri || item.nama || '');
            return localOwned && activeStudentNames.has(normName);
        });

        TahfizhState.allSetoran = filteredSetoran.map(item => ({
            id: `row-${item.rowNumber || item.RowNumber}`,
            santriId: item.santriId || TahfizhState.santriNameMap.get(normalizeTahfizhName(item.namaSantri || item.NamaSantri || item.nama || '')) || null,
            namaSantri: item.namaSantri || item.NamaSantri || item.nama || '',
            createdAt: item.tanggal || item.Tanggal || item.timestamp,
            rowNumber: item.rowNumber || item.RowNumber,
            status: item.Status || 'Verified',
            ...item
        }));

        TahfizhState.verifiedSetoran = TahfizhState.allSetoran.filter(s => s.status === 'Verified');
        TahfizhState.pendingSetoran = TahfizhState.allSetoran.filter(s => s.status === 'Pending');
    }

    calculateTahfizhSantriStats();
    buildTahfizhClassGroups();
    renderAllTahfizhUI();
    updateTahfizhDummyToggleUI();
}

function processHafalanReferens(refJuz, refSurat) {
    const processed = { juzPageCounts: {}, surahData: {} };
    if (refJuz) {
        refJuz.forEach(item => { processed.juzPageCounts[item.key] = item.val; });
    }
    if (refSurat) {
        refSurat.forEach(item => {
            const juzKey = item.juz;
            if (!processed.surahData[juzKey]) {
                processed.surahData[juzKey] = { list: [], pages: {} };
            }
            processed.surahData[juzKey].list.push(item.nama);
            processed.surahData[juzKey].pages[item.nama] = parseFloat(item.halaman);
        });
    }
    return processed;
}

// Logika kalkulasi statistik hafalan santri
function calculateTahfizhSantriStats() {
    const santriStatsMap = new Map(TahfizhState.rawSantriList.map(s => [s.id, { 
        ...s, mutqinJuz: new Set(), halfJuz: new Set(), nilai: 0, nilaiTampil: 0, isTuntas: false, tuntasDate: null, ziyadahPages: 0, totalPages: 0, setoran: [], setoranCount: 0, ziyadahProgress: {}, statusPerpulangan: getTahfizhLabels().belumBolehPulang
    }]));
    
    // Kelompokkan setoran ke santri
    TahfizhState.allSetoran.forEach(setoran => {
        if (setoran.santriId && santriStatsMap.has(setoran.santriId)) {
            const santri = santriStatsMap.get(setoran.santriId);
            santri.setoran.push(setoran);
        }
    });

    santriStatsMap.forEach(santri => {
        const validSetoran = santri.setoran.filter(s => s.status === 'Verified');
        santri.setoranCount = validSetoran.length;

        if (validSetoran.length === 0) return;

        santri.totalPages = validSetoran.reduce((sum, s) => {
            let pageCount = parseFloat(s.halaman) || 0;
            if (isHalfJuz(s.juz)) {
                pageCount = getHalfJuzPages();
            } else if (s.jenis === 'Mutqin' && TahfizhConfig.hafalanData?.juzPageCounts[s.juz]) {
                pageCount = TahfizhConfig.hafalanData.juzPageCounts[s.juz];
            } else if (!pageCount && s.surat && TahfizhConfig.hafalanData?.surahData[s.juz]) {
                pageCount = TahfizhConfig.hafalanData.surahData[s.juz].pages[s.surat] || 0;
            }
            return sum + pageCount;
        }, 0);

        // Cek ujian kelancaran mutqin
        const mutqinSetengahJuz = validSetoran.filter(s => s.jenis === 'Mutqin' && isHalfJuz(s.juz));
        mutqinSetengahJuz.forEach(setoran => {
            const halfJuzNumber = getHalfJuzNumber(setoran.juz);
            if (halfJuzNumber !== null) santri.halfJuz.add(halfJuzNumber);
        });
        const requiredMutqinMap = new Map(getTuntasRequiredMutqinJuz().map(juz => [
            Number(juz),
            validSetoran.find(s => s.jenis === 'Mutqin' && Number(s.juz) === Number(juz))
        ]));

        requiredMutqinMap.forEach((setoran, juz) => {
            if (setoran) santri.mutqinJuz.add(juz);
        });

        // Hitung nilai/skor kelulusan
        const scoreMutqinJuz = getTahfizhRules().scoreMutqinJuz || getTuntasRequiredMutqinJuz()[0];
        const scoreMutqinSetoran = requiredMutqinMap.get(Number(scoreMutqinJuz));
        const scoreHalfJuzSetoran = mutqinSetengahJuz.find(s => getHalfJuzNumber(s.juz) === Number(scoreMutqinJuz) && new Date(s.createdAt) <= TahfizhConfig.deadlineJuz30Score);
        if (scoreHalfJuzSetoran || (scoreMutqinSetoran && new Date(scoreMutqinSetoran.createdAt) <= TahfizhConfig.deadlineJuz30Score)) {
            santri.nilai = 100;
        } else {
            const setoranSurahs = new Set(validSetoran.filter(set => Number(set.juz) === Number(scoreMutqinJuz) && set.surat).map(set => set.surat));
            let score = 0;
            if (TahfizhConfig.scoringTiers) {
                for (const tier of TahfizhConfig.scoringTiers) {
                    if (tier.required.every(surah => setoranSurahs.has(surah))) {
                        score = tier.score;
                        break;
                    }
                }
            }
            if (score === 0) {
                score = validSetoran.filter(s => s.jenis === 'Mutqin' && new Date(s.createdAt) > TahfizhConfig.deadlineJuz30Score).reduce((sum, s) => {
                    const pageCount = parseFloat(s.halaman) || TahfizhConfig.hafalanData?.juzPageCounts[s.juz] || 0;
                    return sum + pageCount;
                }, 0);
            }
            santri.nilai = score;
        }

        // Cek Ketuntasan — semua santri menggunakan kriteria yang sama
        if (isTahfizhTuntas(santri)) {
            santri.isTuntas = true;
            santri.nilai = Math.max(santri.nilai, 100);
        }

        if (santri.isTuntas) {
            let completionDates = [];
            mutqinSetengahJuz.forEach(setoran => completionDates.push(new Date(setoran.createdAt)));
            requiredMutqinMap.forEach(setoran => {
                if (setoran) completionDates.push(new Date(setoran.createdAt));
            });
            if (completionDates.length > 0) {
                santri.tuntasDate = new Date(Math.max(...completionDates));
                validSetoran.forEach(setoran => {
                    if (new Date(setoran.createdAt) > santri.tuntasDate) {
                        let pageValue = parseFloat(setoran.halaman) || 0;
                        if (!pageValue && setoran.surat && TahfizhConfig.hafalanData?.surahData[setoran.juz]) {
                            pageValue = TahfizhConfig.hafalanData.surahData[setoran.juz].pages[setoran.surat] || 0;
                        }
                        if (setoran.jenis === 'Ziyadah') {
                            santri.ziyadahPages += pageValue;
                            santri.ziyadahProgress[setoran.juz] = (santri.ziyadahProgress[setoran.juz] || 0) + pageValue;
                        }
                    }
                });
            }
        }

        santri.nilaiTampil = Math.min(100, santri.nilai);
        
        santri.statusPerpulangan = checkTahfizhPerpulangan(santri);
    });

    TahfizhState.santriData = Array.from(santriStatsMap.values());
}

function checkTahfizhPerpulangan(santri) {
    const validSetoran = santri.setoran.filter(s => s.status === 'Verified');
    
    let latestAchievedPeriod = null;

    if (TahfizhConfig.perpulanganPeriods) {
        for (const period of TahfizhConfig.perpulanganPeriods) {
            let conditionMet = false;
            if (period.type === 'surat') {
                conditionMet = period.required.every(requiredSurah => 
                    validSetoran.some(set => set.surat === requiredSurah && new Date(set.createdAt) <= period.deadline)
                );
            } else if (period.type === 'mutqin') {
                conditionMet = period.required.every(requiredJuz =>
                    validSetoran.some(set =>
                        set.jenis === 'Mutqin' &&
                        String(set.juz) === String(requiredJuz) &&
                        new Date(set.createdAt) <= period.deadline
                    )
                );
            }
            if (conditionMet) latestAchievedPeriod = period;
        }
    }

    const labels = getTahfizhLabels();
    return latestAchievedPeriod ? labels.bolehPulang : labels.belumBolehPulang;
}

function buildTahfizhClassGroups() {
    const tempGroups = {};
    TahfizhState.santriData.forEach(s => {
        const musyrifName = s.musyrif || 'Semua Musyrif';
        if (!tempGroups[musyrifName]) {
            tempGroups[musyrifName] = { santri: [], musyrif: musyrifName, classes: new Set() };
        }
        tempGroups[musyrifName].santri.push(s);
        tempGroups[musyrifName].classes.add(s.kelas);
    });

    TahfizhState.classGroups = {};
    for (const musyrif in tempGroups) {
        const group = tempGroups[musyrif];
        const groupName = [...group.classes].sort().join(', ') || 'Grup Khusus';
        TahfizhState.classGroups[groupName] = { santri: group.santri, musyrif: group.musyrif };
    }

    TahfizhState.classGroups['Seluruh Santri'] = {
        santri: TahfizhState.santriData,
        musyrif: 'Semua Musyrif'
    };
}

// Rendering UI Modul Tahfizh
function renderAllTahfizhUI() {
    renderTahfizhBeranda();
    renderTahfizhHistoryTable();
    renderTahfizhRekap();
    renderTahfizhAnalisisForm();
    updateTahfizhDummyToggleUI();
    if (TDOM.historyModeLabel) {
        TDOM.historyModeLabel.textContent = TahfizhState.useDummyData ? 'Dummy' : 'Lokal';
        TDOM.historyModeLabel.className = TahfizhState.useDummyData
            ? 'px-2 py-0.5 rounded-md bg-orange-50 dark:bg-orange-500/10 text-[9px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20'
            : 'px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400';
    }
    syncFormControls();
}

function renderTahfizhBeranda() {
    // Statistik Atas
    const activeSantriIds = new Set(TahfizhState.verifiedSetoran.map(s => s.santriId));
    const totalSantri = TahfizhState.rawSantriList.length;
    const tuntasCount = TahfizhState.santriData.filter(s => s.isTuntas).length;

    document.querySelectorAll('[data-tahfizh-stat="aktif"]').forEach(el => { el.textContent = `${activeSantriIds.size} / ${totalSantri}`; });
    document.querySelectorAll('[data-tahfizh-stat="tuntas"]').forEach(el => { el.textContent = tuntasCount; });
    document.querySelectorAll('[data-tahfizh-stat="proses"]').forEach(el => { el.textContent = Math.max(0, totalSantri - tuntasCount); });

    renderTahfizhHomeOverview(activeSantriIds.size, totalSantri, tuntasCount);
    renderTahfizhFocusSummary();
    renderTahfizhRecentActivity();

    // Validasi Inbox (Setoran Masuk)
    renderTahfizhValidationInbox();

    // Jadwal Perpulangan Countdown
    renderTahfizhJadwalPerpulangan();

    // Akordeon Kelas
    try {
        renderTahfizhTuntasAccordion();
    } catch (error) {
        console.error('[Tahfizh] Gagal render progress kelas:', error);
        if (TDOM.tuntasTrackingAccordion) {
            TDOM.tuntasTrackingAccordion.innerHTML = '<div class="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-xs font-bold text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">Progress kelas belum bisa ditampilkan. Data Tahfizh lainnya tetap tersedia.</div>';
        }
    }

    // Leaderboards Peringkat
    renderTahfizhLeaderboard();

    // Detail Tuntas Juz
    renderTahfizhJuzTuntasTracking();
}

function renderTahfizhHomeOverview(activeCount, totalSantri, tuntasCount) {
    if (!TDOM.homeOverview) return;

    const pendingCount = TahfizhState.pendingSetoran.length;
    const totalPages = TahfizhState.santriData.reduce((sum, s) => sum + (Number(s.totalPages) || 0), 0);
    const completionPct = totalSantri > 0 ? Math.round((tuntasCount / totalSantri) * 100) : 0;
    const cards = [
        { icon: 'activity', label: 'Santri Aktif Setor', value: `${activeCount}/${totalSantri}`, tone: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10' },
        { icon: 'badge-check', label: 'Tuntas Target', value: `${completionPct}%`, tone: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10' },
        { icon: 'book-open', label: 'Total Halaman', value: totalPages.toFixed(1), tone: 'text-orange-600 bg-orange-50 dark:text-orange-300 dark:bg-orange-500/10' },
        { icon: 'inbox', label: 'Menunggu Validasi', value: pendingCount, tone: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10' }
    ];

    TDOM.homeOverview.innerHTML = cards.map(card => `
        <div class="tahfizh-card rounded-2xl p-3">
            <div class="flex items-center justify-between gap-2">
                <span class="flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}">
                    <i data-lucide="${card.icon}" class="h-4 w-4"></i>
                </span>
                <span class="text-right text-lg font-bold tabular-nums text-slate-900 dark:text-white">${card.value}</span>
            </div>
            <p class="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">${card.label}</p>
        </div>
    `).join('');
}

function renderTahfizhFocusSummary() {
    if (!TDOM.focusSummary) return;

    const targets = getTahfizhTargetDefinitions().slice(0, 3);
    const rows = targets.map(target => {
        const total = TahfizhState.santriData.length;
        const tuntas = TahfizhState.santriData.filter(s => isTahfizhTargetMet(s, target)).length;
        const pct = total > 0 ? Math.round((tuntas / total) * 100) : 0;
        return `
            <div class="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                <div class="mb-2 flex items-center justify-between gap-2">
                    <p class="truncate text-xs font-bold text-slate-800 dark:text-white">${window.sanitizeHTML(target.label)}</p>
                    <span class="text-xs font-bold text-orange-600 dark:text-orange-400">${pct}%</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-white shadow-inner dark:bg-slate-800">
                    <div class="h-full rounded-full bg-orange-500" style="width:${pct}%"></div>
                </div>
                <p class="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">${tuntas} dari ${total} santri memenuhi target.</p>
            </div>
        `;
    }).join('');

    TDOM.focusSummary.innerHTML = `
        <div class="mb-3 flex items-center justify-between gap-2">
            <div class="min-w-0">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Fokus Pekan Ini</h3>
                <p class="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Target utama yang perlu dipantau.</p>
            </div>
            <i data-lucide="crosshair" class="h-5 w-5 shrink-0 text-orange-500"></i>
        </div>
        <div class="space-y-2">${rows || '<p class="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">Belum ada target.</p>'}</div>
    `;
}

function renderTahfizhRecentActivity() {
    if (!TDOM.recentActivity) return;

    const recent = [...TahfizhState.allSetoran]
        .sort((a, b) => new Date(b.createdAt || b.tanggal || 0) - new Date(a.createdAt || a.tanggal || 0))
        .slice(0, 5);

    const rows = recent.map(item => {
        const date = new Date(item.createdAt || item.tanggal || Date.now());
        const unit = item.halaman ? `${item.halaman} hlm` : (item.surat || '');
        return `
            <li class="flex items-start gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-500/10">
                    <i data-lucide="book-marked" class="h-4 w-4"></i>
                </span>
                <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-bold text-slate-800 dark:text-white">${window.sanitizeHTML(item.namaSantri || '-')}</p>
                    <p class="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">${window.sanitizeHTML(item.jenis || 'Setoran')} - ${window.sanitizeHTML(getTahfizhJuzLabel(item.juz || '-'))}${unit ? ` - ${window.sanitizeHTML(unit)}` : ''}</p>
                    <p class="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">${Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
            </li>
        `;
    }).join('');

    TDOM.recentActivity.innerHTML = `
        <div class="mb-3 flex items-center justify-between gap-2">
            <div class="min-w-0">
                <h3 class="text-sm font-bold text-slate-900 dark:text-white">Aktivitas Terkini</h3>
                <p class="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">Setoran terbaru perangkat ini.</p>
            </div>
            <button onclick="window.switchTahfizhSubTab('riwayat')" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-orange-50 hover:text-orange-600 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-orange-500/10" title="Buka riwayat">
                <i data-lucide="arrow-up-right" class="h-4 w-4"></i>
            </button>
        </div>
        <ul class="space-y-2">${rows || '<li class="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">Belum ada setoran terbaru.</li>'}</ul>
    `;
}

function renderTahfizhValidationInbox() {
    if (!TDOM.validationSection || !TDOM.validationContainer) return;

    TDOM.validationCount.textContent = TahfizhState.pendingSetoran.length;

    if (TahfizhState.pendingSetoran.length === 0) {
        TDOM.validationSection.classList.add('hidden');
        return;
    }

    TDOM.validationSection.classList.remove('hidden');
    TDOM.validationContainer.innerHTML = '';

    TahfizhState.pendingSetoran.forEach(s => {
        const clone = TDOM.tplValidationItem.content.cloneNode(true);
        setElementText(clone, '.val-nama', s.namaSantri);
        setElementText(clone, '.val-info', `Kelas ${s.kelas}`);
        
        const detailText = `${s.jenis} • ${getTahfizhJuzLabel(s.juz)} • ${s.halaman ? s.halaman + ' hlm' : s.surat}`;
        setElementText(clone, '.val-detail', detailText);
        setElementText(clone, '.val-date', new Date(s.createdAt).toLocaleString('id-ID'));

        const btnApprove = clone.querySelector('.btn-approve');
        const btnReject = clone.querySelector('.btn-reject');
        
        btnApprove.addEventListener('click', () => handleValidationAction(s.rowNumber, 'Verified'));
        btnReject.addEventListener('click', () => handleValidationAction(s.rowNumber, 'Rejected'));

        TDOM.validationContainer.appendChild(clone);
    });
    
    if (window.lucide) window.lucide.createIcons();
}

async function handleValidationAction(rowNumber, status) {
    // Tampilkan toast loading
    if (window.showToast) window.showToast(`Memproses ${status === 'Verified' ? 'Persetujuan' : 'Penolakan'}...`, 'info');

    try {
        let list = typeof window.getTahfizhSetoran === 'function'
            ? window.getTahfizhSetoran()
            : JSON.parse(localStorage.getItem('tahfizh_local_setoran') || '[]');
        if (!Array.isArray(list)) throw new Error("Database setoran tidak ditemukan");
        const index = list.findIndex(s => (s.rowNumber || s.RowNumber) == rowNumber);

        if (index === -1) throw new Error("Data setoran tidak ditemukan");

        const setoranItem = list[index];

        if (status === 'Verified') {
            list[index].Status = 'Verified';
            list[index].status = 'Verified';
        } else {
            list[index].Status = 'Rejected';
            list[index].status = 'Rejected';
        }

        localStorage.setItem('tahfizh_local_setoran', JSON.stringify(list));

        // Kirim notifikasi ke Wali jika setoran diverifikasi
        if (status === 'Verified') {
            const studentNis = String(setoranItem.santriId || setoranItem.nis || '').trim();
            const studentName = setoranItem.namaSantri || setoranItem.NamaSantri || 'Santri';
            const jenisSetoran = setoranItem.jenis || 'Ziyadah';
            const juzLabel = setoranItem.juz ? `Juz ${setoranItem.juz}` : (setoranItem.surat ? `Surat ${setoranItem.surat}` : '');
            const detail = [jenisSetoran, juzLabel].filter(Boolean).join(' - ');

            if (studentNis && typeof window.addNotification === 'function') {
                notifyWaliTahfizhVerified(studentNis, studentName, detail);
                console.log(`[TahfizhManager] Notification sent to wali for NIS: ${studentNis}`);
            }

            // Kirim local notification juga
            if (window.sendLocalNotification) {
                window.sendLocalNotification(
                    'Setoran Hafalan Disetujui',
                    `Setoran ${detail} untuk ${studentName} telah disetujui!`,
                    'tahfizh'
                );
            }
        }

        if (window.showToast) window.showToast(status === 'Verified' ? 'Setoran berhasil disetujui!' : 'Setoran ditolak.', 'success');
        await reloadTahfizhData();
    } catch (e) {
        if (window.showToast) window.showToast(`Gagal memvalidasi: ${e.message}`, 'error');
    }
}

function renderTahfizhJadwalPerpulangan() {
    if (!TDOM.jadwalPerpulanganSection || !TDOM.tplJadwalPerpulangan) return;
    if (TahfizhState.countdownInterval) clearInterval(TahfizhState.countdownInterval);

    const now = new Date();
    const nextPeriod = TahfizhConfig.perpulanganPeriods.find(p => now < p.deadline);
    TDOM.jadwalPerpulanganSection.innerHTML = '';

    const clone = TDOM.tplJadwalPerpulangan.content.cloneNode(true);
    TDOM.jadwalPerpulanganSection.appendChild(clone);
    const cont = TDOM.jadwalPerpulanganSection.querySelector('#tahfizh-jadwal-content-container');

    if (nextPeriod && cont) {
        const monthName = nextPeriod.deadline.toLocaleString('id-ID', { month: 'long' });
        const deadlineStr = nextPeriod.deadline.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const targetsHtml = nextPeriod.required.map(t => `
            <div class="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 py-1.5 px-3 rounded-full text-xs font-bold shadow-sm border border-slate-200/80 dark:border-slate-700/60 text-slate-650 dark:text-slate-300">
                <i data-lucide="check" class="w-4 h-4 text-orange-500"></i>
                <span>${nextPeriod.type === 'mutqin' ? getMutqinRequirementLabel(t) : t.replace(/_/g, ' ')}</span>
            </div>`).join('');

        cont.innerHTML = `
            <div class="tahfizh-card rounded-[1.75rem] p-4 sm:p-5 relative overflow-hidden group">
                <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    <div class="lg:col-span-7 text-center lg:text-left space-y-3">
                        <div>
                            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/50 mb-3">
                                <span class="relative flex h-2 w-2">
                                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                  <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </span>
                                <h4 class="text-[10px] font-bold text-orange-900 dark:text-orange-350 uppercase tracking-widest">Target Perpulangan</h4>
                            </div>
                            <h2 class="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">${monthName}</h2>
                            <div class="inline-flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/50 dark:bg-slate-800/50 px-4 py-2 rounded-xl border border-white/50 dark:border-slate-700">
                                <i data-lucide="calendar" class="w-4 h-4 text-orange-500"></i>
                                Deadline: <span class="font-bold font-mono text-slate-700 dark:text-slate-200">${deadlineStr} WIB</span>
                            </div>
                        </div>
                        <div id="tahfizh-countdown-timer" class="flex flex-wrap justify-center lg:justify-start gap-3 sm:gap-4"></div>
                    </div>
                    <div class="lg:col-span-5 relative">
                        <div class="bg-slate-50/80 dark:bg-slate-900/40 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/50">
                            <div class="flex items-center gap-3 mb-4 border-b border-orange-50/50 dark:border-orange-950/20 pb-3">
                                <div class="w-10 h-10 rounded-xl tahfizh-soft-icon flex items-center justify-center shadow-sm">
                                    <i data-lucide="book-open" class="w-5 h-5"></i>
                                </div>
                                <div class="text-left">
                                    <h4 class="text-sm font-black text-slate-700 dark:text-slate-200">Syarat Hafalan</h4>
                                    <p class="text-[10px] text-slate-400 font-medium">Harus diselesaikan sebelum tanggal di atas</p>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-2 content-start min-h-[60px] text-left">
                                ${targetsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        const timerEl = cont.querySelector('#tahfizh-countdown-timer');
        const headerCountdownEl = document.getElementById('tahfizh-header-countdown');
        const updateCountdown = () => {
            const nowMs = Date.now();
            const dist = nextPeriod.deadline.getTime() - nowMs;
            if (dist < 0) {
                if (timerEl) timerEl.innerHTML = '<p class="font-bold text-lg text-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-2 rounded-xl">Waktu Habis</p>';
                if (headerCountdownEl) {
                    headerCountdownEl.classList.add('hidden');
                    headerCountdownEl.classList.remove('flex');
                }
                clearInterval(TahfizhState.countdownInterval);
                return;
            }
            const d = Math.floor(dist / 864e5), h = Math.floor(dist % 864e5 / 36e5), m = Math.floor(dist % 36e5 / 6e4), s = Math.floor(dist % 6e4 / 1e3);
            if (headerCountdownEl) {
                const labelEl = headerCountdownEl.querySelector('.countdown-label');
                const timeEl = headerCountdownEl.querySelector('.countdown-time');
                if (labelEl) labelEl.textContent = d > 0 ? 'Perpulangan' : 'Hari Ini';
                if (timeEl) timeEl.textContent = d > 0
                    ? `${d}h ${String(h).padStart(2, '0')}j`
                    : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                headerCountdownEl.classList.remove('hidden');
                headerCountdownEl.classList.add('flex');
            }
            if (timerEl) {
                timerEl.innerHTML = [d, h, m, s].map((val, i) => `
                    <div class="flex flex-col items-center">
                        <div class="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-slate-950 rounded-xl border border-white dark:border-slate-800 shadow-sm flex items-center justify-center relative overflow-hidden group">
                            <span class="text-lg sm:text-xl font-black text-slate-800 dark:text-white tabular-nums tracking-tight group-hover:scale-110 transition-transform">
                                ${String(val).padStart(2, '0')}
                            </span>
                            <div class="absolute bottom-0 w-full h-1 bg-orange-500/20"></div>
                        </div>
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">
                            ${['Hari', 'Jam', 'Mnt', 'Dtk'][i]}
                        </span>
                    </div>`).join('');
            }
        };
        TahfizhState.countdownInterval = setInterval(updateCountdown, 1000);
        updateCountdown();
    } else if (cont) {
        cont.innerHTML = `
            <div class="tahfizh-empty-state rounded-2xl border border-dashed border-slate-200 bg-white/85 p-5 text-center shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
                <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <i data-lucide="calendar-check-2" class="h-5 w-5"></i>
                </div>
                <p class="text-sm font-black text-slate-700 dark:text-slate-200">Semua jadwal perpulangan selesai</p>
                <p class="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">Tidak ada target perpulangan aktif yang perlu ditindaklanjuti saat ini.</p>
            </div>`;
        const headerCountdownEl = document.getElementById('tahfizh-header-countdown');
        if (headerCountdownEl) {
            headerCountdownEl.classList.add('hidden');
            headerCountdownEl.classList.remove('flex');
        }
    }
    
    if (window.lucide) window.lucide.createIcons();
}

function renderTahfizhTuntasAccordion() {
    if (!TDOM.tuntasTrackingAccordion || !TDOM.tplAccordionItem) return;
    TDOM.tuntasTrackingAccordion.innerHTML = '';
    const safeText = (value) => {
        if (typeof window.sanitizeHTML === 'function') return window.sanitizeHTML(value);
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    };

    for (const groupName in TahfizhState.classGroups) {
        if (groupName === 'Khusus Tahfizh' || groupName === 'Seluruh Santri') continue;
        const group = TahfizhState.classGroups[groupName];
        if (!group || !Array.isArray(group.santri)) continue;
        const tuntasSantri = group.santri.filter(s => s.isTuntas);
        const tuntasCount = tuntasSantri.length;
        const totalCount = group.santri.length;
        const belumCount = totalCount - tuntasCount;
        const getDisplayProgress = (santri) => {
            if (santri.isTuntas) return 100;
            const nilaiProgress = Number(santri.nilaiTampil) || 0;
            const pageProgress = Math.min(100, Math.round(((Number(santri.totalPages) || 0) / 20) * 100));
            const activityProgress = (Number(santri.setoranCount) || 0) > 0 ? 5 : 0;
            return Math.max(nilaiProgress, pageProgress, activityProgress);
        };
        const percentage = totalCount > 0
            ? Math.round(group.santri.reduce((sum, s) => sum + getDisplayProgress(s), 0) / totalCount)
            : 0;
        const avgNilai = totalCount > 0
            ? Math.round(group.santri.reduce((sum, s) => sum + getDisplayProgress(s), 0) / totalCount)
            : 0;
        const totalSetoran = group.santri.reduce((sum, s) => sum + (Number(s.setoranCount) || 0), 0);
        const ringStyle = `background: conic-gradient(#f97316 ${percentage * 3.6}deg, rgba(226,232,240,.9) 0deg);`;

        const card = document.createElement('div');
        card.className = 'p-1';
        card.dataset.progressCard = 'true';
        card.innerHTML = `
            <div class="rounded-2xl border border-slate-100/80 bg-white/70 p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-950/20">
                <div class="mb-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <div class="mb-1 flex items-center gap-2">
                            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:ring-orange-500/20">
                                <i data-lucide="bar-chart-3" class="h-4 w-4"></i>
                            </span>
                            <div class="min-w-0">
                                <h4 class="truncate text-base font-black leading-tight text-slate-950 dark:text-white">${safeText(groupName)}</h4>
                                <p class="mt-0.5 text-[10px] font-bold text-slate-400">${totalCount} santri aktif</p>
                            </div>
                        </div>
                    </div>
                    <span class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-600 ring-1 ring-orange-100 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20">
                        <span class="h-1.5 w-1.5 rounded-full bg-orange-500"></span>
                        Live
                    </span>
                </div>

                <div class="grid items-center gap-3" style="grid-template-columns: 88px minmax(0, 1fr);">
                    <div class="flex h-20 w-20 items-center justify-center rounded-full p-1 shadow-inner" style="${ringStyle}">
                        <div class="flex h-full w-full flex-col items-center justify-center rounded-full bg-white dark:bg-slate-950">
                            <span class="text-2xl font-black leading-none text-orange-600 dark:text-orange-400">${percentage}%</span>
                            <span class="mt-0.5 text-[8px] font-black uppercase tracking-wide text-orange-500/80">Progres</span>
                        </div>
                    </div>

                    <div class="min-w-0">
                        <div class="mb-2 flex items-center justify-between gap-2">
                            <span class="text-[10px] font-black uppercase tracking-wide text-slate-400">Rata-rata kelas</span>
                            <span class="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-black text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">${avgNilai}%</span>
                        </div>
                        <div class="h-2.5 overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
                            <div class="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400" style="width:${avgNilai}%"></div>
                        </div>
                        <div class="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400">
                            <span class="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>${tuntasCount} Tuntas</span>
                            <span class="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"><span class="h-1.5 w-1.5 rounded-full bg-orange-500"></span>${belumCount} Proses</span>
                            <span class="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><i data-lucide="book-open-check" class="h-3 w-3"></i>${totalSetoran} Setor</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-2 grid grid-cols-3 gap-2">
                <div class="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <p class="text-[8px] font-black uppercase tracking-wide text-emerald-600/70 dark:text-emerald-300/70">Tuntas</p>
                    <p class="mt-1 text-xl font-black leading-none text-emerald-600 dark:text-emerald-300">${tuntasCount}</p>
                </div>
                <div class="rounded-xl border border-orange-100 bg-orange-50/70 p-3 dark:border-orange-500/20 dark:bg-orange-500/10">
                    <p class="text-[8px] font-black uppercase tracking-wide text-orange-600/70 dark:text-orange-300/70">Proses</p>
                    <p class="mt-1 text-xl font-black leading-none text-orange-600 dark:text-orange-300">${belumCount}</p>
                </div>
                <div class="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <p class="text-[8px] font-black uppercase tracking-wide text-slate-400">Setoran</p>
                    <p class="mt-1 text-xl font-black leading-none text-slate-800 dark:text-white">${totalSetoran}</p>
                </div>
            </div>
        `;

        TDOM.tuntasTrackingAccordion.appendChild(card);
    }
    
    if (window.lucide) window.lucide.createIcons();
}

function renderTahfizhLeaderboard() {
    if (!TDOM.peringkatSection || !TDOM.tplPeringkatSection) return;
    TDOM.peringkatSection.innerHTML = '';
    
    const clone = TDOM.tplPeringkatSection.content.cloneNode(true);
    TDOM.peringkatSection.appendChild(clone);
    
    renderTahfizhPeringkatContent();
}

function renderTahfizhPeringkatContent() {
    const contentContainer = TDOM.peringkatSection?.querySelector('[data-tahfizh-peringkat-content], #peringkat-content');
    if (!contentContainer || !TDOM.tplPeringkatItem) return;

    const list = TahfizhState.santriData;
    const getTop5 = (arr, key) => [...arr]
        .filter(s => (Number(s[key]) || 0) > 0)
        .sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0))
        .slice(0, 3);

    const criteria = [
        { key: 'setoranCount', title: 'Paling Rajin (Total Setoran)', unit: 'setoran' },
        { key: 'totalPages', title: 'Hafalan Terbanyak (Total Halaman)', unit: 'hlm' }
    ];
    
    const medalColors = ['bg-yellow-400', 'bg-slate-350', 'bg-amber-600'];

    contentContainer.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-6';

    criteria.forEach(c => {
        const col = document.createElement('div');
        col.className = 'space-y-3';
        
        const title = document.createElement('h4');
        title.className = 'font-bold text-center mb-3 text-slate-700 dark:text-slate-350 text-xs uppercase tracking-wider';
        title.textContent = c.title;
        col.appendChild(title);

        const ul = document.createElement('ul');
        ul.className = 'space-y-3';

        const topList = getTop5(list, c.key);
        if (topList.length > 0) {
            topList.forEach((s, i) => {
                const itemClone = TDOM.tplPeringkatItem.content.cloneNode(true);
                const badge = itemClone.querySelector('.medal-bg');
                if (badge) {
                    badge.textContent = i + 1;
                    badge.className = `medal-bg flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm ${medalColors[i] || 'bg-slate-300 dark:bg-slate-700'}`;
                }
                setElementText(itemClone, '.item-nama', s.nama);
                setElementText(itemClone, '.item-kelas', `Kelas ${s.kelas}`);
                
                const val = (Number(s[c.key]) || 0).toFixed(c.key === 'totalPages' ? 1 : 0);
                setElementText(itemClone, '.item-score', val);
                setElementText(itemClone, '.item-unit', c.unit);
                ul.appendChild(itemClone);
            });
        } else {
            ul.innerHTML = '<li class="text-center text-xs text-slate-400 dark:text-slate-500 py-6 italic">Belum ada data.</li>';
        }
        col.appendChild(ul);
        grid.appendChild(col);
    });

    contentContainer.appendChild(grid);
}

function renderTahfizhJuzTuntasTracking() {
    if (!TDOM.tahfizhTuntasTrackingSection || !TDOM.tplTahfizhSection) return;
    TDOM.tahfizhTuntasTrackingSection.innerHTML = '';
    
    const clone = TDOM.tplTahfizhSection.content.cloneNode(true);
    TDOM.tahfizhTuntasTrackingSection.appendChild(clone);

    const targets = getTahfizhTargetDefinitions();
    const tabsContainer = TDOM.tahfizhTuntasTrackingSection.querySelector('.tahfizh-target-tabs');
    if (tabsContainer) {
        tabsContainer.innerHTML = targets.map((target, index) => `
            <button class="tahfizh-tab shrink-0 rounded-xl px-3 py-2 text-[11px] font-black transition-all ${index === 0 ? '' : 'text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800'}" data-target="${target.id}">
                ${window.sanitizeHTML(target.label)}
            </button>
        `).join('');
    }

    const firstTarget = String(targets[0]?.id || '');
    if (!firstTarget) return;
    renderTahfizhJuzContent(firstTarget);
    const tab = TDOM.tahfizhTuntasTrackingSection.querySelector(`[data-target="${firstTarget}"]`);
    if (tab) {
        tab.className = "tahfizh-tab shrink-0 rounded-xl px-3 py-2 text-[11px] font-black transition-all bg-white text-orange-600 shadow-sm border border-orange-100/70 dark:bg-slate-800 dark:text-orange-300 dark:border-orange-500/20";
    }
}

function renderTahfizhJuzContent(targetKey, searchTerm = '') {
    const contentContainer = TDOM.tahfizhTuntasTrackingSection?.querySelector('[data-tahfizh-target-content], #tahfizh-content');
    if (!contentContainer || !TDOM.tplTahfizhContent) return;

    const target = getTahfizhTargetDefinitions().find(item => String(item.id) === String(targetKey));
    const targetLabel = target?.label || 'Target';
    const filterFn = (s) => isTahfizhTargetMet(s, target);

    const targetSantri = TahfizhState.santriData;
    if (targetSantri.length === 0) {
        contentContainer.innerHTML = `
          <div class="flex flex-col items-center justify-center py-12 px-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 text-center w-full">
            <div class="w-12 h-12 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-slate-100 dark:border-slate-700">
              <i data-lucide="users" class="w-6 h-6"></i>
            </div>
            <p class="text-xs font-bold text-slate-500 dark:text-slate-400">Belum ada data santri.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const tuntasCount = targetSantri.filter(filterFn).length;
    const totalCount = targetSantri.length;
    const percentage = totalCount > 0 ? Math.round((tuntasCount / totalCount) * 100) : 0;

    const lowerSearch = searchTerm.toLowerCase();
    const tuntasList = targetSantri.filter(s => filterFn(s) && s.nama.toLowerCase().includes(lowerSearch));
    const belumTuntasList = targetSantri.filter(s => !filterFn(s) && s.nama.toLowerCase().includes(lowerSearch));
    const getInitials = (name = '') => name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0])
        .join('')
        .toUpperCase() || '?';
    const renderTargetList = (list, emptyText, done) => {
        if (list.length === 0) {
            return `
                <li class="list-none rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-center text-xs font-bold text-slate-400 dark:border-slate-800 dark:bg-slate-900/50">
                    <i data-lucide="${done ? 'sparkles' : 'circle-check'}" class="mx-auto mb-2 h-5 w-5 text-slate-300"></i>
                    <span>${emptyText}</span>
                </li>`;
        }
        return list.map(s => {
            const avatarClass = done
                ? 'bg-emerald-500 text-white border-emerald-400'
                : 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/20';
            const statusClass = done
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-orange-600 dark:text-orange-400';
            const metricClass = done
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                : 'bg-white text-orange-700 border-orange-100 dark:bg-slate-900/70 dark:text-orange-300 dark:border-orange-500/20';
            const progressText = done ? 'Memenuhi target' : `${s.setoranCount || 0} setoran tercatat`;
            return `
                <li class="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-xs font-black ${avatarClass}">
                        ${window.sanitizeHTML(getInitials(s.nama))}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between gap-2">
                            <p class="truncate text-sm font-black text-slate-800 dark:text-white">${window.sanitizeHTML(s.nama)}</p>
                            <span class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${done ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300'}">${done ? 'Tuntas' : 'Belum'}</span>
                        </div>
                        <div class="mt-2 flex flex-wrap items-center gap-1.5">
                            <span class="rounded-full border px-2 py-0.5 text-[9px] font-black ${metricClass}">Kelas ${window.sanitizeHTML(s.kelas || '-')}</span>
                            <span class="rounded-full border px-2 py-0.5 text-[9px] font-black ${metricClass}">${s.setoranCount || 0} setoran</span>
                            <span class="text-[9px] font-bold ${statusClass}">${progressText}</span>
                        </div>
                    </div>
                </li>`;
        }).join('');
    };

    contentContainer.innerHTML = '';
    const clone = TDOM.tplTahfizhContent.content.cloneNode(true);
    setElementText(clone, '.text-progress-label', targetLabel);
    setElementText(clone, '.text-percentage', `${percentage}%`);
    setElementText(clone, '.target-summary', `${tuntasCount} dari ${totalCount} santri sudah memenuhi target. ${totalCount - tuntasCount} santri masuk prioritas pendampingan.`);

    const bar = clone.querySelector('.progress-bar');
    if (bar) bar.style.width = `${percentage}%`;
    const ring = clone.querySelector('.target-ring');
    if (ring) {
        ring.style.background = `conic-gradient(#f97316 ${percentage * 3.6}deg, rgba(255,237,213,.9) 0deg)`;
    }

    const searchInput = clone.querySelector('.tahfizh-search');
    if (searchInput) {
        searchInput.dataset.targetFilter = targetKey;
        searchInput.value = searchTerm;
    }

    clone.querySelectorAll('.count-tuntas').forEach(el => { el.textContent = tuntasList.length; });
    clone.querySelectorAll('.count-belum').forEach(el => { el.textContent = belumTuntasList.length; });
    clone.querySelectorAll('.count-total').forEach(el => { el.textContent = totalCount; });

    const listTuntasEl = clone.querySelector('.list-tuntas');
    if (listTuntasEl) listTuntasEl.innerHTML = renderTargetList(tuntasList, 'Belum ada santri yang memenuhi target ini.', true);

    const listBelumEl = clone.querySelector('.list-belum');
    if (listBelumEl) listBelumEl.innerHTML = renderTargetList(belumTuntasList, 'Semua santri sudah memenuhi target ini.', false);

    contentContainer.appendChild(clone);
    
    if (window.lucide) window.lucide.createIcons();
}

// Rendering Riwayat Setoran
function renderTahfizhHistoryTable() {
    if (!TDOM.setoranTableBody || !TDOM.historyRowTemplate) return;

    const searchTerm = TDOM.searchRiwayat.value.toLowerCase();
    const classFilter = TDOM.filterKelas.value;
    const startDate = TDOM.filterTanggalMulai.value ? new Date(TDOM.filterTanggalMulai.value) : null;
    const endDate = TDOM.filterTanggalAkhir.value ? new Date(TDOM.filterTanggalAkhir.value) : null;
    
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const filtered = TahfizhState.allSetoran.filter(setoran => {
        const santri = TahfizhState.santriData.find(st => st.id === setoran.santriId);
        
        // Filter sinkronisasi kelas: Tampilkan kelas Musyrif bimbingan yang login secara default
        const activeClass = appState.selectedClass;
        
        // Filter dropdown kelas
        const classMatch = (classFilter === 'Semua' && (!activeClass || (santri && santri.kelas === activeClass))) || 
                             (classFilter !== 'Semua' && (santri && santri.kelas === classFilter));
        const dateMatch = (!startDate || new Date(setoran.createdAt) >= startDate) && (!endDate || new Date(setoran.createdAt) <= endDate);
        const searchMatch = setoran.namaSantri.toLowerCase().includes(searchTerm);

        return searchMatch && classMatch && dateMatch;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);

    TDOM.setoranTableBody.innerHTML = '';
    if (filtered.length === 0) {
        TDOM.setoranTableBody.innerHTML = `
            <tr>
                <td colspan="4" class="p-4">
                    <div class="tahfizh-empty-state rounded-2xl border border-dashed border-orange-200/80 dark:border-orange-500/20 p-5 text-center">
                        <div class="mx-auto w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-500/10 text-orange-500 flex items-center justify-center border border-orange-100 dark:border-orange-500/20 mb-2">
                            <i data-lucide="database" class="w-4 h-4"></i>
                        </div>
                        <p class="text-xs font-black text-slate-700 dark:text-slate-200">Belum ada setoran tampil</p>
                        <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1">Aktifkan mode dummy atau input setoran untuk kelas ${appState.selectedClass || 'aktif'}.</p>
                    </div>
                </td>
            </tr>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach(setoran => {
        const santri = TahfizhState.santriData.find(s => s.id === setoran.santriId);
        const clone = TDOM.historyRowTemplate.content.cloneNode(true);
        
        setElementText(clone, '.data-nama', setoran.namaSantri);
        setElementText(clone, '.data-jenis', setoran.jenis);
        setElementText(clone, '.data-juz-text', getTahfizhJuzLabel(setoran.juz));
        setElementText(clone, '.data-unit', setoran.halaman ? `${setoran.halaman} hlm` : setoran.surat);
        
        const dateContainer = clone.querySelector('.data-tanggal');
        if (dateContainer) {
            dateContainer.textContent = new Date(setoran.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
        }

        // Status badge
        const statusEl = clone.querySelector('.data-status');
        if (statusEl) {
            if (setoran.status === 'Pending') {
                statusEl.innerHTML = `<span class="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-900/50">Menunggu Validasi</span>`;
            } else {
                statusEl.innerHTML = `<span class="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-900/50">Terverifikasi</span>`;
            }
        }

        // Tombol delete
        const deleteBtn = clone.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.dataset.id = setoran.rowNumber; // hapus berdasarkan rowNumber spreadsheet
            if (setoran.source === 'dummy') {
                deleteBtn.classList.add('hidden');
            } else {
                deleteBtn.addEventListener('click', () => confirmDeleteTahfizhRow(setoran.rowNumber));
            }
        }

        if (santri) {
            const pIcon = clone.querySelector('.data-program-icon');
            if (pIcon) {
                pIcon.remove();
            }
            const cIcon = clone.querySelector('.data-kelas-icon');
            if (cIcon) {
                cIcon.innerHTML = `<span title="Kelas ${santri.kelas}" class="inline-flex items-center justify-center h-5 w-5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 text-[10px] font-black border border-slate-200 dark:border-slate-700">${santri.kelas}</span>`;
            }
        }
        
        fragment.appendChild(clone);
    });

    TDOM.setoranTableBody.appendChild(fragment);
    if (window.lucide) window.lucide.createIcons();
}

function confirmDeleteTahfizhRow(rowNumber) {
    TahfizhState.setoranIdToDelete = rowNumber;
    
    // Tampilkan modal konfirmasi custom
    if (TDOM.studentDetailModal) {
        const modal = document.getElementById('tahfizhConfirmModal');
        if (modal) modal.classList.remove('hidden');
    }
}

// Rendering Rekap Capaian
function renderTahfizhRekap() {
    if (!TDOM.rekapSelect || !TDOM.rekapContentContainer || !TDOM.rekapContentTemplate) return;

    const activeClass = appState.selectedClass || 'Kelas Aktif';
    const activeSantri = TahfizhState.santriData.filter(s => !appState.selectedClass || s.kelas === appState.selectedClass);
    const activeMusyrif = (appState.selectedClass && window.classData && window.classData[appState.selectedClass]?.musyrif)
        || activeSantri.find(s => s.musyrif)?.musyrif
        || 'Musyrif Kelas';

    TahfizhState.classGroups[activeClass] = {
        santri: activeSantri,
        musyrif: activeMusyrif,
        sortState: TahfizhState.classGroups[activeClass]?.sortState || { column: 'nama', dir: 'asc' }
    };

    const groupOrder = [activeClass];
    TDOM.rekapSelect.innerHTML = '';
    TDOM.rekapContentContainer.innerHTML = '';

    groupOrder.forEach((groupName, index) => {
        const tabId = groupName.replace(/, /g, '').replace(/ /g, '-');
        TDOM.rekapSelect.add(new Option(groupName, tabId));

        const clone = TDOM.rekapContentTemplate.content.cloneNode(true);
        const content = clone.querySelector('.rekap-tab-content');
        content.id = `tahfizh-rekap-tab-${tabId}`;
        
        const group = TahfizhState.classGroups[groupName];
        setElementText(clone, '.data-title', `Rekap Capaian - ${groupName}`);
        setElementText(clone, '.data-musyrif', `Musyrif: ${group.musyrif}`);
        setElementText(clone, '.data-timestamp', new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' }));
        
        const btnPdf = clone.querySelector('.export-pdf-btn');
        if (btnPdf) {
            btnPdf.dataset.classGroup = groupName;
            btnPdf.addEventListener('click', () => exportTahfizhPDF(groupName));
        }

        if (index !== 0) content.classList.add('hidden');
        TDOM.rekapContentContainer.appendChild(content);
        renderSingleTahfizhRekapTable(groupName, true);
    });

    if (window.lucide) window.lucide.createIcons();
}

function renderSingleTahfizhRekapTable(groupName, isInitial = false) {
    const group = TahfizhState.classGroups[groupName];
    if (!group) return;

    const tabId = groupName.replace(/, /g, '').replace(/ /g, '-');
    const contentDiv = document.getElementById(`tahfizh-rekap-tab-${tabId}`);
    if (!contentDiv) return;

    if (isInitial && !group.sortState) {
        group.sortState = { column: 'nama', dir: 'asc' };
    }

    const { column, dir } = group.sortState;
    group.santri.sort((a, b) => {
        let valA, valB;
        switch (column) {
            case 'nama': valA = a.nama; valB = b.nama; break;
            case 'nilai': valA = a.nilaiTampil; valB = b.nilaiTampil; break;
            case 'ziyadah': valA = a.ziyadahPages; valB = b.ziyadahPages; break;
            case 'keterangan': valA = a.isTuntas; valB = b.isTuntas; break;
            default: return 0;
        }
        if (valA < valB) return dir === 'asc' ? -1 : 1;
        if (valA > valB) return dir === 'asc' ? 1 : -1;
        return 0;
    });

    const tableBody = contentDiv.querySelector('.data-table-body');
    if (!tableBody || !TDOM.tplRekapRow) return;
    tableBody.innerHTML = '';

    const fragment = document.createDocumentFragment();
    group.santri.forEach((santri, idx) => {
        const row = TDOM.tplRekapRow.content.cloneNode(true);
        setElementText(row, '.col-no', idx + 1);
        
        const btnDetail = row.querySelector('.detail-santri-text');
        if (btnDetail) {
            btnDetail.textContent = santri.nama;
            btnDetail.addEventListener('click', () => openTahfizhDetailModal(santri.id));
        }

        setElementText(row, '.col-nilai', santri.nilaiTampil);
        setElementText(row, '.col-ziyadah', (santri.ziyadahPages || 0).toFixed(1));
        
        const statusCell = row.querySelector('.col-status');
        if (statusCell) {
            statusCell.innerHTML = `<span class="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${santri.isTuntas ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400'}">${santri.isTuntas ? 'Tuntas' : 'Belum'}</span>`;
        }

        fragment.appendChild(row);
    });

    tableBody.appendChild(fragment);
}

function exportTahfizhPDF(classGroup) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');
        const group = TahfizhState.classGroups[classGroup];
        if (!group) return;

        const head = [['No.', 'Nama Santri', 'Nilai', 'Ziyadah (hlm)', 'Keterangan']];
        const body = group.santri.sort((a, b) => a.nama.localeCompare(b.nama)).map((s, idx) => [
            idx + 1, s.nama, s.nilaiTampil, (s.ziyadahPages || 0).toFixed(1), s.isTuntas ? 'Tuntas' : 'Belum Tuntas'
        ]);

        doc.autoTable({
            head,
            body,
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11] }, // Oranye
            styles: { font: 'helvetica', cellPadding: 6, valign: 'middle' },
            columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40, halign: 'center' }, 3: { cellWidth: 70, halign: 'center' }, 4: { cellWidth: 80, halign: 'center' } },
            didDrawPage: (data) => {
                doc.setFontSize(18);
                doc.setTextColor(180, 83, 9);
                doc.setFont('helvetica', 'bold');
                doc.text('Laporan Capaian Tahfizh', data.settings.margin.left, 40);
                doc.setFontSize(11);
                doc.setTextColor(60);
                doc.setFont('helvetica', 'normal');
                doc.text(`Kelompok: ${classGroup} | Musyrif: ${group.musyrif}`, data.settings.margin.left, 58);
            }
        });
        
        doc.save(`rekap_tahfizh_${classGroup.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`);
        if (window.showToast) window.showToast("PDF berhasil diunduh!", "success");
    } catch (error) {
        if (window.showToast) window.showToast("Gagal memproses ekspor PDF.", "error");
    }
}

// Rapor Detail Santri Modal
function openTahfizhDetailModal(santriId) {
    const s = TahfizhState.santriData.find(s => s.id === santriId);
    if (!s || !TDOM.studentDetailModal) return;

    TDOM.detailNama.textContent = s.nama;
    TDOM.detailInfo.textContent = `Kelas ${s.kelas} | Musyrif: ${s.musyrif}`;

    // Render grafik garis Chart.js
    renderTahfizhDetailChart(s);

    // Render visualisasi halaman juz
    renderTahfizhJuzVisualBlocks(s);

    TDOM.studentDetailModal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

function renderTahfizhDetailChart(santri) {
    const ctx = TDOM.progressChart.getContext('2d');
    if (TahfizhState.chartInstance) TahfizhState.chartInstance.destroy();

    const monthlyData = {};
    const validSetoran = santri.setoran.filter(s => s.status === 'Verified');
    const sorted = [...validSetoran].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    sorted.forEach(s => {
        const date = new Date(s.createdAt);
        const monthKey = date.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
        
        let pages = parseFloat(s.halaman) || 0;
        if (isHalfJuz(s.juz)) {
            pages = getHalfJuzPages();
        } else if (!pages && s.surat && TahfizhConfig.hafalanData?.surahData[s.juz]) {
            pages = TahfizhConfig.hafalanData.surahData[s.juz].pages[s.surat] || 0;
        }

        if (!monthlyData[monthKey]) monthlyData[monthKey] = 0;
        monthlyData[monthKey] += pages;
    });

    const labels = Object.keys(monthlyData);
    let accumulator = 0;
    const dataPoints = Object.values(monthlyData).map(val => {
        accumulator += val;
        return accumulator.toFixed(1);
    });

    TahfizhState.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Akumulasi Halaman',
                data: dataPoints,
                borderColor: '#f59e0b', // Oranye
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

function renderTahfizhJuzVisualBlocks(santri) {
    if (!TDOM.juzVisualContainer || !TDOM.tplJuzBlock) return;
    TDOM.juzVisualContainer.innerHTML = '';

    const targetJuzs = getTahfizhRules().raporFocusJuz || [];
    targetJuzs.forEach(juzNum => {
        const setoranJuz = santri.setoran.filter(s => s.juz == juzNum && s.status === 'Verified');
        let totalPagesDone = 0;

        setoranJuz.forEach(s => {
            if (s.jenis === 'Mutqin') {
                totalPagesDone = 20;
            } else {
                let pages = parseFloat(s.halaman) || 0;
                if (!pages && s.surat && TahfizhConfig.hafalanData?.surahData[juzNum]) {
                    pages = TahfizhConfig.hafalanData.surahData[juzNum].pages[s.surat] || 0;
                }
                totalPagesDone += pages;
            }
        });

        const maxPages = 20;
        const filledBlocks = Math.min(Math.floor(totalPagesDone), maxPages);
        const percentage = Math.min(Math.round((totalPagesDone / maxPages) * 100), 100);

        const clone = TDOM.tplJuzBlock.content.cloneNode(true);
        setElementText(clone, '.block-title', `Juz ${juzNum}`);
        setElementText(clone, '.block-stats', `${totalPagesDone.toFixed(1)} / 20 Hlm (${percentage}%)`);

        const grid = clone.querySelector('.block-grid');
        if (grid) {
            grid.innerHTML = Array(20).fill(0).map((_, i) => {
                const colorClass = i < filledBlocks ? 'bg-orange-500 shadow-sm' : 'bg-slate-200 dark:bg-slate-800';
                return `<div class="aspect-square rounded-md ${colorClass} transition-all duration-300 hover:scale-110" title="Halaman ${i+1}"></div>`;
            }).join('');
        }

        TDOM.juzVisualContainer.appendChild(clone);
    });
}

// Analisis Rapor Santri Subtab
function renderTahfizhAnalisisForm() {
    if (!TDOM.santriSelectAnalisis || !TDOM.analisisContentContainer || !TDOM.analisisPromptTemplate) return;

    TDOM.santriSelectAnalisis.innerHTML = '';
    TDOM.santriSelectAnalisis.add(new Option('Pilih nama santri...', ''));
    
    // Urutkan siswa dari kelas yang login saja agar rapi
    const filtered = TahfizhState.rawSantriList.sort((a, b) => a.nama.localeCompare(b.nama));
    filtered.forEach(s => {
        TDOM.santriSelectAnalisis.add(new Option(s.nama, s.id));
    });

    TDOM.analisisContentContainer.innerHTML = '';
    TDOM.analisisContentContainer.appendChild(TDOM.analisisPromptTemplate.content.cloneNode(true));
}

function renderTahfizhSantriRaporDashboard(santriId) {
    const s = TahfizhState.santriData.find(s => s.id === santriId);
    if (!s || !TDOM.analisisContentContainer || !TDOM.analisisDashboardTemplate) return;

    TDOM.analisisContentContainer.innerHTML = '';
    const dash = TDOM.analisisDashboardTemplate.content.cloneNode(true);

    setElementText(dash, '[data-name]', s.nama);
    setElementHTML(dash, '[data-kelas-text]', `<i data-lucide="school" class="inline h-3 w-3 align-[-2px]"></i> Kelas ${window.sanitizeHTML(s.kelas)}`);
    const programText = dash.querySelector('[data-program-text]');
    if (programText) programText.remove();

    // Status badge
    const statusBadge = dash.querySelector('[data-status-badge]');
    if (statusBadge) {
        statusBadge.textContent = s.isTuntas ? 'Tuntas' : 'Proses';
        statusBadge.className = `inline-flex h-7 items-center justify-center rounded-lg border px-3 py-1 text-xs font-black shadow-sm ${s.isTuntas ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/50' : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50'}`;
    }

    // Perpulangan badge
    const perpulanganBadge = dash.querySelector('[data-perpulangan-badge]');
    if (perpulanganBadge) {
        perpulanganBadge.textContent = s.statusPerpulangan;
        const bolehPulangLabel = getTahfizhLabels().bolehPulang;
        perpulanganBadge.className = `inline-flex h-7 items-center justify-center rounded-lg border px-3 py-1 text-xs font-black shadow-sm ${s.statusPerpulangan === bolehPulangLabel ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900/50' : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'}`;
    }

    setElementText(dash, '[data-nilai]', s.nilaiTampil);
    setElementText(dash, '[data-ziyadah]', `${(s.ziyadahPages || 0).toFixed(1)}`);
    setElementText(dash, '[data-total-setoran]', s.setoranCount);

    // Target wajib progres
    const targetWajibItems = [
        ...(getTahfizhRules().halfJuzOptions || []).map(juz => ({
            label: getTahfizhJuzLabel(getHalfJuzKey(juz)),
            met: s.halfJuz.has(Number(juz))
        })),
        ...getTuntasRequiredMutqinJuz().map(juz => ({
            label: getMutqinRequirementLabel(juz),
            met: hasMutqinJuz(s, juz)
        }))
    ];

    const targetsHtml = targetWajibItems.map(item => `
        <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <span class="font-bold text-xs text-slate-700 dark:text-slate-200">${item.label}</span>
            ${item.met ? '<span class="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500 text-white uppercase">Selesai</span>' : '<span class="text-[9px] font-black px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-450 uppercase">Proses</span>'}
        </div>`).join('');
    
    const targetWajibContainer = dash.querySelector('[data-progres-juz]');
    if (targetWajibContainer) targetWajibContainer.innerHTML = targetsHtml;

    // Detail Ziyadah
    const ziyadahSect = dash.querySelector('[data-ziyadah-section]');
    if (s.isTuntas && ziyadahSect) {
        ziyadahSect.classList.remove('hidden');
        const ziyadahCont = dash.querySelector('[data-progres-ziyadah]');
        if (ziyadahCont) {
            const hiddenBaseJuz = getTahfizhRules().hiddenZiyadahBaseJuz || [];
            const allJuz = Object.keys(TahfizhConfig.hafalanData?.juzPageCounts || {}).filter(j => !hiddenBaseJuz.includes(String(j)));
            ziyadahCont.innerHTML = allJuz.map(j => {
                const comp = s.ziyadahProgress[j] || 0;
                if (comp <= 0) return '';
                const total = TahfizhConfig.hafalanData.juzPageCounts[j];
                const pct = total > 0 ? Math.min(100, (comp / total) * 100).toFixed(0) : 0;
                return `
                    <div class="mb-3">
                        <div class="flex justify-between mb-1 text-xs font-bold text-slate-650 dark:text-slate-400">
                            <span>Juz ${j}</span>
                            <span>${comp.toFixed(1)} / ${total} Hlm</span>
                        </div>
                        <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-orange-500 h-full rounded-full" style="width: ${pct}%"></div>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    // Aktivitas Terkini Rapor
    const tableBody = dash.querySelector('[data-aktivitas-terkini]');
    if (tableBody) {
        const sortedActivities = [...s.setoran].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        tableBody.innerHTML = sortedActivities.length > 0 ? sortedActivities.map(act => `
            <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td class="p-4 align-middle">
                    <p class="font-bold text-sm text-slate-800 dark:text-slate-200">${act.jenis} <span class="text-slate-400 mx-1">•</span> ${getTahfizhJuzLabel(act.juz)}</p>
                    <p class="text-xs text-slate-400 font-mono mt-0.5">${act.halaman ? `${act.halaman} hlm` : act.surat}</p>
                </td>
                <td class="p-4 align-middle text-right text-xs font-bold text-slate-450">
                    ${new Date(act.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    ${act.status === 'Pending' ? '<span class="block text-amber-500 mt-1">Pending</span>' : ''}
                </td>
            </tr>`).join('') : '<tr><td colspan="2" class="p-8 text-center text-slate-400 dark:text-slate-550 font-bold text-xs italic">Belum ada aktivitas.</td></tr>';
    }

    TDOM.analisisContentContainer.appendChild(dash);

    // Render detail visual tambahan pada rapor
    renderTahfizhRaporFocusJuz(s);
    renderTahfizhRaporComposition(s);
    renderTahfizhRaporDynamicGrid(s);
    
    if (window.lucide) window.lucide.createIcons();
}

function renderTahfizhRaporFocusJuz(santri) {
    const cont = document.getElementById('focus-juz-container');
    if (!cont) return;

    let activeJuz = null;
    let activeProgress = 0;
    const checkOrder = [...Array(30).keys()].map(i => i + 1).reverse(); // Juz akhir -> awal

    for (let juz of checkOrder) {
        const setoranJuz = santri.setoran.filter(set => set.juz == juz && set.status === 'Verified');
        let pages = 0;
        let isMutqin = false;

        setoranJuz.forEach(set => {
            if (set.jenis === 'Mutqin') isMutqin = true;
            else {
                let p = parseFloat(set.halaman) || 0;
                if (!p && set.surat && TahfizhConfig.hafalanData?.surahData[juz]) {
                    p = TahfizhConfig.hafalanData.surahData[juz].pages[set.surat] || 0;
                }
                pages += p;
            }
        });

        if (isMutqin) pages = 20;

        if (pages > 0 && pages < 20) {
            activeJuz = juz;
            activeProgress = pages;
            break;
        }
    }

    if (activeJuz) {
        const percentage = Math.min(Math.round((activeProgress / 20) * 100), 100);
        cont.innerHTML = `
            <div class="relative w-40 h-40 flex items-center justify-center">
                <svg class="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle class="text-slate-100 dark:text-slate-800" stroke-width="10" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                    <circle class="text-orange-500 transition-all duration-1000 ease-out" stroke-width="10" stroke-linecap="round" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" 
                        style="stroke-dasharray: 251.2; stroke-dashoffset: ${251.2 - (percentage / 100 * 251.2)};" />
                </svg>
                <div class="flex flex-col items-center justify-center text-slate-700 dark:text-slate-300 relative z-10">
                    <span class="text-4xl font-black">${activeJuz}</span>
                    <span class="text-[10px] uppercase font-bold text-slate-400">Juz</span>
                </div>
            </div>
            <div class="mt-4">
                <p class="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-4 py-1.5 rounded-full border border-orange-100 dark:border-orange-900/30">
                    ${activeProgress.toFixed(1)} / 20 Hlm (${percentage}%)
                </p>
            </div>`;
    } else {
        cont.innerHTML = `<div class="p-6 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-350 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-bold text-xs italic">Semua juz tuntas atau belum dimulai.</div>`;
    }
}

function renderTahfizhRaporComposition(santri) {
    const canvas = document.getElementById('compositionChart');
    if (!canvas) return;

    const validSetoran = santri.setoran.filter(s => s.status === 'Verified');
    const countZiyadah = validSetoran.filter(s => s.jenis === 'Ziyadah').length;
    const countMutqin = validSetoran.filter(s => ['Mutqin', 'Murajaah'].includes(s.jenis)).length;

    if (countZiyadah === 0 && countMutqin === 0) {
        canvas.parentElement.innerHTML = `
          <div class="flex flex-col items-center justify-center py-8 text-center w-full">
            <div class="w-10 h-10 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl flex items-center justify-center mb-2 border border-slate-100 dark:border-slate-700">
              <i data-lucide="pie-chart" class="w-5 h-5"></i>
            </div>
            <p class="text-slate-400 dark:text-slate-500 font-bold text-xs italic">Belum ada data setoran.</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    if (window.tahfizhCompositionInstance) window.tahfizhCompositionInstance.destroy();

    window.tahfizhCompositionInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['Ziyadah', 'Mutqin/Mura'],
            datasets: [{
                data: [countZiyadah, countMutqin],
                backgroundColor: ['#f59e0b', '#10b981'], // Oranye & Emerald
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '75%'
        }
    });
}

function renderTahfizhRaporDynamicGrid(santri) {
    const cont = document.getElementById('dynamic-juz-grid');
    if (!cont) return;
    cont.innerHTML = '';

    let hasData = false;
    const juzOrder = [...Array(30).keys()].map(i => i + 1).reverse();

    juzOrder.forEach(juzNum => {
        const setoranJuz = santri.setoran.filter(s => 
            (s.juz == juzNum || (getHalfJuzNumber(s.juz) === Number(juzNum))) && s.status === 'Verified'
        );

        if (setoranJuz.length === 0) return;
        hasData = true;

        let totalPagesDone = 0;
        setoranJuz.forEach(s => {
            if (s.jenis === 'Mutqin') {
                if (isHalfJuz(s.juz)) totalPagesDone += getHalfJuzPages();
                else totalPagesDone = 20;
            } else {
                let pages = parseFloat(s.halaman) || 0;
                if (!pages && s.surat && TahfizhConfig.hafalanData?.surahData[juzNum]) {
                    pages = TahfizhConfig.hafalanData.surahData[juzNum].pages[s.surat] || 0;
                }
                totalPagesDone += pages;
            }
        });

        const filledBlocks = Math.min(Math.floor(totalPagesDone), 20);
        const percentage = Math.min(Math.round((totalPagesDone / 20) * 100), 100);

        const card = document.createElement('div');
        card.className = 'bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800';
        
        card.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <div class="flex items-center gap-2.5">
                    <span class="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-750 dark:text-slate-200 text-xs shadow-sm">${juzNum}</span>
                    <span class="font-bold text-slate-700 dark:text-slate-350 text-xs">Juz ${juzNum}</span>
                </div>
                <span class="text-[9px] font-black ${percentage >= 100 ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} px-2 py-0.5 rounded">
                    ${percentage >= 100 ? 'TUNTAS' : `${percentage}%`}
                </span>
            </div>
            <div class="grid grid-cols-5 gap-1.5">
                ${Array(20).fill(0).map((_, i) => {
                    const isFilled = i < filledBlocks;
                    const blockColor = isFilled ? 'bg-orange-500 shadow-sm shadow-orange-100/30' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60';
                    return `<div class="aspect-square rounded-md ${blockColor} transition-all hover:scale-110" title="Halaman ${i+1}"></div>`;
                }).join('')}
            </div>`;
        
        cont.appendChild(card);
    });

    if (!hasData) {
        cont.innerHTML = `<div class="col-span-full text-center py-8 text-slate-400 dark:text-slate-550 italic font-bold text-xs">Belum ada progres hafalan.</div>`;
    }
}

// Sinkronkan dropdown pilihan Musyrif & Santri pada form input otomatis
function syncFormControls() {
    if (!TDOM.musyrif || !TDOM.namaSantri) return;

    // Musyrif dropdown: Ambil data musyrif dari kelas presensi
    const activeClass = appState.selectedClass;
    let loggedMusyrif = '';
    if (activeClass && window.classData && window.classData[activeClass]) {
        loggedMusyrif = window.classData[activeClass].musyrif;
    }

    // Isi dropdown musyrif
    const musyrifSet = new Set(TahfizhState.rawSantriList.map(s => s.musyrif).filter(Boolean));
    const sortedMusyrif = [...musyrifSet].sort();
    
    TDOM.musyrif.innerHTML = '';
    sortedMusyrif.forEach(m => {
        TDOM.musyrif.add(new Option(m, m));
    });

    if (loggedMusyrif && sortedMusyrif.includes(loggedMusyrif)) {
        TDOM.musyrif.value = loggedMusyrif;
        TDOM.musyrif.disabled = true; // Kunci ke musyrif yang sedang login
    }

    // Isi dropdown nama santri: Hanya tampilkan santri dari kelas aktif (FILTERED_SANTRI)
    TDOM.namaSantri.innerHTML = '';
    TDOM.namaSantri.add(new Option('Pilih Santri', ''));

    if (typeof FILTERED_SANTRI !== 'undefined' && FILTERED_SANTRI.length > 0) {
        FILTERED_SANTRI.forEach(s => {
            TDOM.namaSantri.add(new Option(s.nama, s.nis || s.id));
        });
        TDOM.namaSantri.disabled = false;
    } else {
        TDOM.namaSantri.disabled = true;
    }

    // Set waktu awal input ke waktu sekarang
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    if (TDOM.tanggal) TDOM.tanggal.value = now.toISOString().slice(0, 16);

    // Sinkronkan filter kelas di riwayat
    if (TDOM.filterKelas) {
        TDOM.filterKelas.innerHTML = '';
        TDOM.filterKelas.add(new Option('Semua Kelas', 'Semua'));
        
        const kelasSet = new Set(MASTER_SANTRI.map(s => s.kelas).filter(Boolean));
        [...kelasSet].sort().forEach(k => {
            TDOM.filterKelas.add(new Option(k, k));
        });

        if (activeClass) {
            TDOM.filterKelas.value = activeClass;
            TDOM.filterKelas.disabled = true; // Kunci filter ke kelas Musyrif
        }
    }
}

// Menangani Event Listeners modul Tahfizh
function setupTahfizhEventListeners() {
    setupTahfizhSecretTrigger();

    if (TDOM.setoranForm && !TDOM.setoranForm.dataset.hasListener) {
        TDOM.setoranForm.dataset.hasListener = "true";
        TDOM.setoranForm.addEventListener('submit', handleTahfizhFormSubmit);
    }

    if (TDOM.namaSantri && !TDOM.namaSantri.dataset.hasListener) {
        TDOM.namaSantri.dataset.hasListener = "true";
        TDOM.namaSantri.addEventListener('change', handleFormSantriChange);
    }

    if (TDOM.jenis && !TDOM.jenis.dataset.hasListener) {
        TDOM.jenis.dataset.hasListener = "true";
        TDOM.jenis.addEventListener('change', handleFormJenisChange);
    }

    if (TDOM.juz && !TDOM.juz.dataset.hasListener) {
        TDOM.juz.dataset.hasListener = "true";
        TDOM.juz.addEventListener('change', handleFormJuzChange);
    }

    if (TDOM.nowBtn && !TDOM.nowBtn.dataset.hasListener) {
        TDOM.nowBtn.dataset.hasListener = "true";
        TDOM.nowBtn.addEventListener('click', () => {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            TDOM.tanggal.value = now.toISOString().slice(0, 16);
        });
    }

    if (TDOM.dummyToggle && !TDOM.dummyToggle.dataset.hasListener) {
        TDOM.dummyToggle.dataset.hasListener = "true";
        TDOM.dummyToggle.addEventListener('click', toggleTahfizhDummyMode);
    }

    if (TDOM.helpButton && !TDOM.helpButton.dataset.hasListener) {
        TDOM.helpButton.dataset.hasListener = "true";
        TDOM.helpButton.addEventListener('click', () => {
            const modal = document.getElementById('tahfizhHelpModal');
            if (modal) modal.classList.remove('hidden');
        });
    }

    // Modal konfirmasi hapus klik
    if (TDOM.confirmDeleteBtn && !TDOM.confirmDeleteBtn.dataset.hasListener) {
        TDOM.confirmDeleteBtn.dataset.hasListener = "true";
        TDOM.confirmDeleteBtn.addEventListener('click', deleteTahfizhRowDirectly);
    }

    // Event delegation klik rekap, analisis tabs, akordeon
    const mainTabContainer = document.getElementById('tab-tahfizh');
    if (mainTabContainer && !mainTabContainer.dataset.hasListener) {
        mainTabContainer.dataset.hasListener = "true";
        mainTabContainer.addEventListener('click', handleTahfizhDelegatedClicks);
        mainTabContainer.addEventListener('input', handleTahfizhDelegatedInput);
    }
}

function handleFormSantriChange() {
    const sId = TDOM.namaSantri.value;
    const rawSantri = MASTER_SANTRI.find(s => (s.nis || s.id) === sId);
    const sStats = TahfizhState.santriData.find(s => s.id === sId);

    if (rawSantri) {
        TDOM.kelas.value = rawSantri.kelas || '-';
        TDOM.program.value = '';
        TDOM.santriId.value = sId;

        const options = ["Ziyadah", "Murajaah", "Mutqin"];
        
        populateTahfizhSelect(TDOM.jenis, options, 'Pilih Jenis');
        TDOM.jenis.disabled = false;
    } else {
        TDOM.kelas.value = '';
        TDOM.program.value = '';
        TDOM.santriId.value = '';
        TDOM.jenis.innerHTML = '';
        TDOM.jenis.disabled = true;
    }
    TDOM.jenis.dispatchEvent(new Event('change'));
}

function handleFormJenisChange() {
    const jenis = TDOM.jenis.value;
    const sId = TDOM.namaSantri.value;
    const sStats = TahfizhState.santriData.find(s => s.id === sId);
    let juzOptions = [];

    if (jenis && sStats && TahfizhConfig.hafalanData?.surahData) {
        if (jenis === 'Mutqin') {
            (getTahfizhRules().halfJuzOptions || []).forEach(juz => {
                if (!sStats.halfJuz.has(Number(juz))) {
                    juzOptions.push({ text: getTahfizhJuzLabel(getHalfJuzKey(juz)), value: getHalfJuzKey(juz) });
                }
            });
            Object.keys(TahfizhConfig.hafalanData.surahData).forEach(j => {
                if (!hasMutqinJuz(sStats, j)) {
                    juzOptions.push({ text: getTahfizhJuzLabel(j), value: j });
                }
            });
        } else {
            Object.keys(TahfizhConfig.hafalanData.surahData).forEach(j => {
                juzOptions.push({ text: getTahfizhJuzLabel(j), value: j });
            });
        }
    }

    populateTahfizhSelect(TDOM.juz, juzOptions.sort((a, b) => {
        const getSortValue = (value) => getHalfJuzNumber(value) || Number(value) || 0;
        return getSortValue(a.value) - getSortValue(b.value);
    }), 'Pilih Juz');
    TDOM.juz.disabled = !jenis;
    TDOM.juz.dispatchEvent(new Event('change'));
}

function handleFormJuzChange() {
    const jenis = TDOM.jenis.value;
    const juz = TDOM.juz.value;

    TDOM.halamanContainer.classList.add('hidden');
    TDOM.suratContainer.classList.add('hidden');
    TDOM.halaman.disabled = true;
    TDOM.surat.innerHTML = '';

    if (!jenis || !juz || isHalfJuz(juz)) return;
    if (!TahfizhConfig.hafalanData?.surahData) return;

    if ((jenis === 'Ziyadah' || jenis === 'Murajaah') && TahfizhConfig.hafalanData.surahData[juz]) {
        TDOM.suratContainer.classList.remove('hidden');
        const suratList = TahfizhConfig.hafalanData.surahData[juz].list;

        if (suratList.length > 0) {
            suratList.forEach((namaSurat, index) => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-3 p-2 hover:bg-orange-50/50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent cursor-pointer';
                const chkId = `chk-tahfizh-surat-${index}`;
                
                div.innerHTML = `
                    <div class="relative flex items-center">
                        <input type="checkbox" id="${chkId}" value="${namaSurat}" class="surat-checkbox peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 dark:border-slate-700 transition-all checked:border-orange-500 checked:bg-orange-500">
                        <svg class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <label for="${chkId}" class="w-full cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-350 select-none">${namaSurat}</label>`;
                TDOM.surat.appendChild(div);
            });
        }
    } else {
        TDOM.halamanContainer.classList.remove('hidden');
        TDOM.halaman.disabled = false;
        TDOM.halaman.required = (jenis !== 'Mutqin');
        if (jenis === 'Mutqin') TDOM.halaman.placeholder = 'Kosongkan untuk 1 Juz penuh';
    }
}

async function handleTahfizhFormSubmit(e) {
    e.preventDefault();
    if (window.isWaliMode?.()) {
        if (window.showToast) window.showToast("Wali tidak memiliki izin untuk menyimpan setoran tahfizh.", "error");
        return;
    }
    if (!validateTahfizhForm()) return;

    // Loading State
    TDOM.submitButton.disabled = true;
    TDOM.submitButtonText.textContent = 'Memproses...';
    TDOM.submitButtonIcon.classList.add('hidden');
    TDOM.submitSpinner.classList.remove('hidden');

    const activeSantri = MASTER_SANTRI.find(s => (s.nis || s.id) === TDOM.namaSantri.value);
    const baseData = {
        musyrif: TDOM.musyrif.value,
        namaSantri: activeSantri?.nama || '',
        santriId: TDOM.santriId.value,
        kelas: TDOM.kelas.value,
        program: TDOM.program.value,
        jenis: TDOM.jenis.value,
        juz: TDOM.juz.value,
        tanggal: TDOM.tanggal.value,
        kualitas: 'Lancar',
        status: 'Verified' // Musyrif input otomatis verified
    };

    let payloads = [];
    if (!TDOM.suratContainer.classList.contains('hidden')) {
        const checked = TDOM.surat.querySelectorAll('.surat-checkbox:checked');
        checked.forEach(chk => {
            payloads.push({ ...baseData, surat: chk.value, halaman: '' });
        });
    } else {
        payloads.push({ ...baseData, surat: '', halaman: TDOM.halaman.value });
    }

    let successCount = 0;
    let failCount = 0;

    try {
        let list = typeof window.getTahfizhSetoran === 'function'
            ? window.getTahfizhSetoran()
            : JSON.parse(localStorage.getItem('tahfizh_local_setoran') || '[]');
        
        let maxRow = list.reduce((max, s) => {
            const rowNum = Number(s.rowNumber || s.RowNumber || 0);
            return rowNum > max ? rowNum : max;
        }, 0);

        for (const [idx, item] of payloads.entries()) {
            maxRow++;
            const newRecord = {
                ...item,
                rowNumber: maxRow,
                RowNumber: maxRow,
                Status: 'Verified',
                status: 'Verified',
                tanggal: item.tanggal || new Date().toISOString(),
                source: 'local',
                localCreatedAt: new Date().toISOString()
            };
            list.unshift(newRecord);
            successCount++;
        }

        if (typeof window.saveTahfizhSetoran === 'function') {
            window.saveTahfizhSetoran(list);
        } else {
            localStorage.setItem('tahfizh_local_setoran', JSON.stringify(list));
        }

        if (successCount > 0) {
            const studentNis = String(baseData.santriId || activeSantri?.nis || activeSantri?.id || '').trim();
            const studentName = baseData.namaSantri || activeSantri?.nama || 'Santri';
            const firstPayload = payloads[0] || {};
            const juzLabel = firstPayload.juz ? getTahfizhJuzLabel(firstPayload.juz) : '';
            const unitLabel = payloads.length > 1 ? `${payloads.length} setoran` : (firstPayload.surat || (firstPayload.halaman ? `${firstPayload.halaman} hlm` : ''));
            const detail = [firstPayload.jenis || 'Setoran', juzLabel, unitLabel].filter(Boolean).join(' - ');
            notifyWaliTahfizhVerified(studentNis, studentName, detail);
        }
    } catch (err) {
        failCount = payloads.length;
    }

    TDOM.submitButton.disabled = false;
    TDOM.submitButtonText.textContent = 'Simpan Setoran';
    TDOM.submitButtonIcon.classList.remove('hidden');
    TDOM.submitSpinner.classList.add('hidden');

    if (failCount === 0) {
        if (window.showToast) window.showToast(`Sukses! ${successCount} setoran tersimpan.`, 'success');
        TDOM.setoranForm.reset();
        TDOM.surat.innerHTML = '';
        TDOM.namaSantri.dispatchEvent(new Event('change'));
        await reloadTahfizhData();
        window.switchTahfizhSubTab('beranda');
    } else {
        if (window.showToast) window.showToast(`Gagal menyimpan setoran.`, 'error');
        await reloadTahfizhData();
    }
}

function validateTahfizhForm() {
    let isValid = true;
    
    // Reset errors
    document.querySelectorAll('#tab-tahfizh .form-error').forEach(el => el.classList.add('hidden'));

    const checks = [
        { el: TDOM.tanggal, msg: 'Waktu setoran harus diisi.' },
        { el: TDOM.musyrif, msg: 'Musyrif penerima harus dipilih.' },
        { el: TDOM.namaSantri, msg: 'Nama santri harus dipilih.' },
        { el: TDOM.jenis, msg: 'Jenis setoran harus dipilih.' },
        { el: TDOM.juz, msg: 'Juz harus dipilih.' }
    ];

    checks.forEach(c => {
        if (!c.el.value) {
            const err = c.el.closest('div').parentElement.querySelector('.form-error');
            if (err) {
                err.textContent = c.msg;
                err.classList.remove('hidden');
            }
            isValid = false;
        }
    });

    if (!TDOM.halamanContainer.classList.contains('hidden') && TDOM.jenis.value !== 'Mutqin') {
        if (!TDOM.halaman.value) {
            const err = TDOM.halamanContainer.querySelector('.form-error');
            if (err) {
                err.textContent = 'Jumlah halaman harus diisi.';
                err.classList.remove('hidden');
            }
            isValid = false;
        }
    }

    if (!TDOM.suratContainer.classList.contains('hidden')) {
        const checked = TDOM.surat.querySelectorAll('.surat-checkbox:checked');
        if (checked.length === 0) {
            const err = TDOM.suratContainer.querySelector('.form-error');
            if (err) {
                err.textContent = 'Pilih minimal satu surat.';
                err.classList.remove('hidden');
            }
            isValid = false;
        }
    }

    return isValid;
}

// Menghapus data row setoran secara langsung dari database
async function deleteTahfizhRowDirectly() {
    const rowNumber = TahfizhState.setoranIdToDelete;
    if (!rowNumber) return;

    const modal = document.getElementById('tahfizhConfirmModal');
    if (modal) modal.classList.add('hidden');

    if (window.showToast) window.showToast("Menghapus data setoran...", "info");

    try {
        let list = typeof window.getTahfizhSetoran === 'function'
            ? window.getTahfizhSetoran()
            : JSON.parse(localStorage.getItem('tahfizh_local_setoran') || '[]');
        if (!Array.isArray(list)) throw new Error("Database setoran tidak ditemukan");
        const index = list.findIndex(s => (s.rowNumber || s.RowNumber) == rowNumber);
        
        if (index === -1) throw new Error("Data setoran tidak ditemukan");
        
        list.splice(index, 1);
        if (typeof window.saveTahfizhSetoran === 'function') {
            window.saveTahfizhSetoran(list);
        } else {
            localStorage.setItem('tahfizh_local_setoran', JSON.stringify(list));
        }
        
        if (window.showToast) window.showToast("Data setoran berhasil dihapus.", "success");
        await reloadTahfizhData();
    } catch (e) {
        if (window.showToast) window.showToast(`Gagal menghapus data: ${e.message}`, "error");
    } finally {
        TahfizhState.setoranIdToDelete = null;
    }
}

// Handler event klik dengan pendelegasian pada tab Tahfizh
function handleTahfizhDelegatedClicks(e) {
    // 1. Akordeon kemajuan kelas
    const accBtn = e.target.closest('.accordion-button');
    if (accBtn) {
        const header = accBtn.closest('.accordion-header');
        const panel = header.nextElementSibling;
        const chevron = accBtn.querySelector('.accordion-chevron');
        
        if (panel) {
            const isOpen = panel.style.maxHeight && panel.style.maxHeight !== '0px';
            if (isOpen) {
                panel.style.maxHeight = '0px';
                if (chevron) chevron.classList.remove('rotate-180');
            } else {
                panel.style.maxHeight = `${panel.scrollHeight}px`;
                if (chevron) chevron.classList.add('rotate-180');
            }
        }
        return;
    }

    // 2. Leaderboard tab peringkat
    const peringkatTab = e.target.closest('.tab-peringkat');
    if (peringkatTab) {
        peringkatTab.parentElement.querySelectorAll('.tab-peringkat').forEach(b => {
            b.className = "tab-peringkat px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-slate-500 dark:text-slate-400";
        });
        peringkatTab.className = "tab-peringkat active px-3 py-1.5 text-xs font-bold rounded-lg transition-all bg-white text-orange-600 shadow-sm border border-orange-100/30";
        renderTahfizhPeringkatContent();
        return;
    }

    // 3. Tab tuntas juz (tahfizh)
    const juzTab = e.target.closest('.tahfizh-tab');
    if (juzTab) {
        const target = juzTab.dataset.target;
        juzTab.parentElement.querySelectorAll('.tahfizh-tab').forEach(b => {
            b.className = "tahfizh-tab shrink-0 rounded-xl px-3 py-2 text-[11px] font-black transition-all text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800";
        });
        juzTab.className = "tahfizh-tab shrink-0 rounded-xl px-3 py-2 text-[11px] font-black transition-all bg-white text-orange-600 shadow-sm border border-orange-100/70 dark:bg-slate-800 dark:text-orange-300 dark:border-orange-500/20";
        renderTahfizhJuzContent(target);
        return;
    }

    // 4. Pengubah Tab Analisis Dalam (Ringkasan / Aktivitas Rapor)
    const subAnalTab = e.target.closest('#tahfizh-analisis-tabs .analisis-tab');
    if (subAnalTab) {
        const target = subAnalTab.dataset.target;
        subAnalTab.parentElement.querySelectorAll('.analisis-tab').forEach(b => {
            b.className = "analisis-tab flex-1 py-3 text-sm font-bold rounded-xl transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200";
        });
        subAnalTab.className = "analisis-tab flex-1 py-3 text-sm font-bold rounded-xl transition-all shadow-sm bg-white text-orange-600";
        
        document.querySelectorAll('.analisis-tab-content').forEach(p => p.classList.add('hidden'));
        const activePanel = document.getElementById(target);
        if (activePanel) activePanel.classList.remove('hidden');
        return;
    }

    // 5. Tabel sorting di Rekap
    const sortable = e.target.closest('.sortable');
    if (sortable) {
        const column = sortable.dataset.sort;
        const tabContent = sortable.closest('.rekap-tab-content');
        const rekapSelectVal = TDOM.rekapSelect.value;
        
        const groupName = Object.keys(TahfizhState.classGroups).find(n => n.replace(/, /g, '').replace(/ /g, '-') === rekapSelectVal);
        if (groupName) {
            const group = TahfizhState.classGroups[groupName];
            const isSame = group.sortState?.column === column;
            group.sortState = { column, dir: isSame && group.sortState?.dir === 'asc' ? 'desc' : 'asc' };
            renderSingleTahfizhRekapTable(groupName);
        }
    }
}

function handleTahfizhDelegatedInput(e) {
    if (e.target.matches('.tahfizh-search')) {
        clearTimeout(TahfizhState.searchDebounceTimer);
        TahfizhState.searchDebounceTimer = setTimeout(() => {
            const filterKey = e.target.dataset.targetFilter;
            renderTahfizhJuzContent(filterKey, e.target.value);
        }, 300);
    }
}

// Event inputs pendukung riwayat, rekap dropdown, analisis dropdown
function setupAdditionalInputListeners() {
    if (TDOM.filterTanggalMulai && !TDOM.filterTanggalMulai.dataset.hasListener) {
        TDOM.filterTanggalMulai.dataset.hasListener = "true";
        [TDOM.filterTanggalMulai, TDOM.filterTanggalAkhir, TDOM.filterKelas].forEach(el => {
            if (el) el.addEventListener('input', renderTahfizhHistoryTable);
        });
    }

    if (TDOM.searchRiwayat && !TDOM.searchRiwayat.dataset.hasListener) {
        TDOM.searchRiwayat.dataset.hasListener = "true";
        TDOM.searchRiwayat.addEventListener('input', (e) => {
            clearTimeout(TahfizhState.searchDebounceTimer);
            TahfizhState.searchDebounceTimer = setTimeout(() => {
                renderTahfizhHistoryTable();
                
                const query = e.target.value;
                if (query.length < 2) {
                    TDOM.suggestionsContainer.classList.add('hidden');
                    return;
                }
                
                const matches = TahfizhState.santriData.filter(s => s.nama.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
                if (matches.length > 0) {
                    TDOM.suggestionsContainer.innerHTML = matches.map(s => `
                        <div class="tahfizh-suggestion-item p-2.5 hover:bg-orange-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-50 last:border-0">${s.nama}</div>`).join('');
                    TDOM.suggestionsContainer.classList.remove('hidden');
                } else {
                    TDOM.suggestionsContainer.classList.add('hidden');
                }
            }, 300);
        });

        // Click suggestion item
        TDOM.suggestionsContainer.addEventListener('click', e => {
            const item = e.target.closest('.tahfizh-suggestion-item');
            if (item) {
                TDOM.searchRiwayat.value = item.textContent;
                TDOM.suggestionsContainer.classList.add('hidden');
                renderTahfizhHistoryTable();
            }
        });
    }

    if (TDOM.rekapSelect && !TDOM.rekapSelect.dataset.hasListener) {
        TDOM.rekapSelect.dataset.hasListener = "true";
        TDOM.rekapSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            TDOM.rekapContentContainer.querySelectorAll('.rekap-tab-content').forEach(c => c.classList.add('hidden'));
            
            const target = document.getElementById(`tahfizh-rekap-tab-${val}`);
            if (target) target.classList.remove('hidden');
        });
    }

    if (TDOM.santriSelectAnalisis && !TDOM.santriSelectAnalisis.dataset.hasListener) {
        TDOM.santriSelectAnalisis.dataset.hasListener = "true";
        TDOM.santriSelectAnalisis.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val) {
                renderTahfizhSantriRaporDashboard(val);
            } else {
                TDOM.analisisContentContainer.innerHTML = '';
                TDOM.analisisContentContainer.appendChild(TDOM.analisisPromptTemplate.content.cloneNode(true));
            }
        });
    }
}

// Helpers
function normalizeTahfizhName(name) {
    return typeof name !== 'string' ? '' : name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function setElementText(parent, selector, text) {
    const el = parent.querySelector(selector);
    if (el) el.textContent = text;
}

function setElementHTML(parent, selector, html) {
    const el = parent.querySelector(selector);
    if (el) el.innerHTML = html;
}

function populateTahfizhSelect(selectEl, options, placeholder) {
    selectEl.innerHTML = '';
    if (placeholder) selectEl.add(new Option(placeholder, ''));
    options.forEach(opt => {
        const option = (typeof opt === 'string')
            ? new Option(opt, opt)
            : new Option(opt.text, opt.value);
        selectEl.add(option);
    });
}
