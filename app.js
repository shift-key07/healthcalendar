import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// TODO: 파이어베이스 콘솔에서 발급받은 본인의 설정값으로 변경하세요!
const firebaseConfig = {
  apiKey: "AIzaSyC4oCU2t4qhMKgx0b_T3ry7GnghSkHigdE",
  authDomain: "healthcalendar-56191.firebaseapp.com",
  projectId: "healthcalendar-56191",
  storageBucket: "healthcalendar-56191.firebasestorage.app",
  messagingSenderId: "160289182226",
  appId: "1:160289182226:web:1245cdeac0eddb92193ecb",
  measurementId: "G-P5WF2BJ70W"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'health-diary-app'; // DB 경로용 고정 ID

// DOM 요소 매핑
const views = {
    auth: document.getElementById('auth-section'),
    header: document.getElementById('user-header'),
    dashboard: document.getElementById('dashboard-view'),
    calendar: document.getElementById('calendar-view'),
    desktopNav: document.getElementById('desktop-sidebar'),
    mobileNav: document.getElementById('bottom-nav')
};
const msgBox = document.getElementById('message-box');
const msgText = document.getElementById('message-text');

// 알림 메시지 함수
const showMsg = (msg, type = 'info') => {
    msgText.innerText = msg;
    msgBox.className = 'absolute top-4 left-1/2 transform -translate-x-1/2 z-50 p-4 text-sm rounded-2xl shadow-lg backdrop-blur-md animate-fade-in transition-all w-11/12 max-w-md text-center bg-white border';
    if (type === 'error') msgBox.classList.add('bg-red-500/90', 'text-white', 'border-red-400');
    else if (type === 'success') msgBox.classList.add('bg-emerald-500/90', 'text-white', 'border-emerald-400');
    else msgBox.classList.add('bg-blue-600/90', 'text-white', 'border-blue-400');
    
    msgBox.classList.remove('hidden');
    setTimeout(() => msgBox.classList.add('hidden'), 3000);
};

// --- 인증(Auth) 로직 ---
let currentUser = null;
let unsubscribeRecords = null;

document.getElementById('login-btn').addEventListener('click', () => {
    const e = document.getElementById('email-input').value;
    const p = document.getElementById('password-input').value;
    if(!e || !p) return showMsg("정보를 입력해주세요.", "error");
    signInWithEmailAndPassword(auth, e, p).then(() => showMsg("로그인 성공!", "success")).catch(() => showMsg("로그인 실패. 이메일과 비밀번호를 확인하세요.", "error"));
});

document.getElementById('signup-btn').addEventListener('click', () => {
    const e = document.getElementById('email-input').value;
    const p = document.getElementById('password-input').value;
    if(!e || !p) return showMsg("정보를 입력해주세요.", "error");
    createUserWithEmailAndPassword(auth, e, p).then(() => showMsg("회원가입 완료!", "success")).catch((err) => showMsg(err.message, "error"));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// 인증 상태 감지 (로그인/로그아웃 시 화면 전환)
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        // 로그인 성공 화면 전환
        views.auth.classList.add('hidden');
        views.header.classList.remove('hidden');
        views.desktopNav.classList.remove('hidden'); views.desktopNav.classList.add('md:flex');
        views.mobileNav.classList.remove('hidden'); views.mobileNav.classList.add('flex');
        switchTab('dashboard');
        
        document.getElementById('user-greeting').innerText = `${user.email.split('@')[0]}님`;
        
        // 내 데이터 불러오기 시작
        fetchMyRecords(user.uid);
    } else {
        currentUser = null;
        if (unsubscribeRecords) unsubscribeRecords(); // 리스너 해제
        
        // 로그아웃 화면 전환
        views.auth.classList.remove('hidden');
        views.header.classList.add('hidden');
        views.dashboard.classList.add('hidden');
        views.calendar.classList.add('hidden');
        views.desktopNav.classList.add('hidden'); views.desktopNav.classList.remove('md:flex');
        views.mobileNav.classList.add('hidden'); views.mobileNav.classList.remove('flex');
        document.getElementById('email-input').value = '';
        document.getElementById('password-input').value = '';
    }
});

// --- 네비게이션 탭 스위칭 로직 ---
const switchTab = (tabName) => {
    const isDash = tabName === 'dashboard';
    views.dashboard.classList.toggle('hidden', !isDash);
    views.calendar.classList.toggle('hidden', isDash);
    
    // 메뉴 색상 활성화 상태 변경
    const dHome = document.getElementById('nav-home');
    const dCal = document.getElementById('nav-calendar');
    dHome.className = isDash ? "w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold transition" : "w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-white/50 hover:text-slate-800 rounded-xl font-medium transition";
    dCal.className = !isDash ? "w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold transition" : "w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-white/50 hover:text-slate-800 rounded-xl font-medium transition";

    const mHome = document.getElementById('mobile-nav-home');
    const mCal = document.getElementById('mobile-nav-calendar');
    mHome.className = isDash ? "flex flex-col items-center gap-1 text-blue-600" : "flex flex-col items-center gap-1 text-slate-400";
    mCal.className = !isDash ? "flex flex-col items-center gap-1 text-blue-600" : "flex flex-col items-center gap-1 text-slate-400";

    if (!isDash) renderCalendar();
};

document.getElementById('nav-home').addEventListener('click', () => switchTab('dashboard'));
document.getElementById('mobile-nav-home').addEventListener('click', () => switchTab('dashboard'));
document.getElementById('nav-calendar').addEventListener('click', () => switchTab('calendar'));
document.getElementById('mobile-nav-calendar').addEventListener('click', () => switchTab('calendar'));
document.getElementById('shortcut-calendar-btn').addEventListener('click', () => switchTab('calendar'));

// --- 캘린더 및 데이터 로직 ---
let currentDate = new Date();
let myRecords = {}; // 예: { '2026-04-07': { bp: '120/80', water: 3, meds: true, notes: '' } }

const fetchMyRecords = (userId) => {
    const recordsRef = collection(db, 'artifacts', appId, 'users', userId, 'healthRecords');
    unsubscribeRecords = onSnapshot(recordsRef, (snapshot) => {
        myRecords = {};
        snapshot.forEach((doc) => {
            myRecords[doc.id] = doc.data(); 
        });
        if(!views.calendar.classList.contains('hidden')) renderCalendar();
        updateDashboardSummary();
    }, (error) => {
        console.error("데이터 동기화 에러:", error);
    });
};

const updateDashboardSummary = () => {
    const todayStr = getLocalDateString(new Date());
    const data = myRecords[todayStr];
    const summaryEl = document.getElementById('today-summary-text');
    
    if(data) {
        let summary = "";
        if(data.bp) summary += `혈압: ${data.bp}<br>`;
        if(data.water > 0) summary += `수분: ${data.water}잔<br>`;
        if(data.meds) summary += `약 복용: 완료<br>`;
        if(!summary) summary = "메모만 작성되었습니다.";
        summaryEl.innerHTML = summary;
        summaryEl.classList.replace('text-2xl', 'text-xl');
    } else {
        summaryEl.innerHTML = "캘린더에서 오늘의 건강을<br>기록해 보세요!";
        summaryEl.classList.replace('text-xl', 'text-2xl');
    }
};

const getLocalDateString = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('calendar-month-year').innerText = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const todayStr = getLocalDateString(new Date());
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = "p-2 rounded-xl bg-transparent";
        grid.appendChild(emptyCell);
    }

    for (let i = 1; i <= lastDate; i++) {
        const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = "calendar-cell bg-white border border-slate-100 p-2 md:p-3 rounded-xl shadow-sm flex flex-col relative";
        
        if (cellDateStr === todayStr) cell.classList.add('today-cell');

        const dateSpan = document.createElement('span');
        dateSpan.className = "text-sm font-semibold text-slate-700 block mb-1";
        dateSpan.innerText = i;
        cell.appendChild(dateSpan);

        if (myRecords[cellDateStr]) {
            const data = myRecords[cellDateStr];
            const badgeContainer = document.createElement('div');
            badgeContainer.className = "flex flex-wrap gap-1 mt-auto";
            
            if (data.bp) badgeContainer.innerHTML += `<div class="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center"><i data-lucide="activity" class="w-3 h-3 text-rose-500"></i></div>`;
            if (data.water > 0) badgeContainer.innerHTML += `<div class="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center"><i data-lucide="droplet" class="w-3 h-3 text-blue-500"></i></div>`;
            if (data.meds) badgeContainer.innerHTML += `<div class="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center"><i data-lucide="pill" class="w-3 h-3 text-amber-500"></i></div>`;
            
            cell.appendChild(badgeContainer);
        }

        cell.addEventListener('click', () => openRecordModal(cellDateStr, year, month + 1, i));
        grid.appendChild(cell);
    }
    
    if(window.lucide) window.lucide.createIcons();
};

document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('today-month').addEventListener('click', () => { currentDate = new Date(); renderCalendar(); });

// --- 데이터 입력 팝업(모달) 제어 ---
const modal = document.getElementById('record-modal');
let activeRecordDate = "";

const openRecordModal = (dateStr, y, m, d) => {
    activeRecordDate = dateStr;
    document.getElementById('modal-date-title').innerText = `${y}년 ${m}월 ${d}일 기록`;
    
    const data = myRecords[dateStr] || { bp: "", water: 0, meds: false, notes: "" };
    
    document.getElementById('record-bp').value = data.bp;
    document.getElementById('record-water').value = data.water;
    document.getElementById('record-meds').checked = data.meds;
    document.getElementById('record-notes').value = data.notes;

    modal.classList.remove('hidden');
};

document.getElementById('close-modal-btn').addEventListener('click', () => modal.classList.add('hidden'));

document.getElementById('save-record-btn').addEventListener('click', async () => {
    if (!currentUser) return;
    
    const bp = document.getElementById('record-bp').value.trim();
    const water = parseInt(document.getElementById('record-water').value) || 0;
    const meds = document.getElementById('record-meds').checked;
    const notes = document.getElementById('record-notes').value.trim();

    const recordData = { bp, water, meds, notes, updatedAt: new Date().toISOString() };

    try {
        const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'healthRecords', activeRecordDate);
        await setDoc(docRef, recordData, { merge: true });
        
        showMsg("성공적으로 저장되었습니다!", "success");
        modal.classList.add('hidden');
    } catch (error) {
        console.error("저장 실패:", error);
        showMsg("저장 중 오류가 발생했습니다.", "error");
    }
});
