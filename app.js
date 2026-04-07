import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// TODO: 파이어베이스 설정값 변경 필수
const firebaseConfig = {
  apiKey: "AIzaSyC4oCU2t4qhMKgx0b_T3ry7GnghSkHigdE",
  authDomain: "healthcalendar-56191.firebaseapp.com",
  projectId: "healthcalendar-56191",
  storageBucket: "healthcalendar-56191.firebasestorage.app",
  messagingSenderId: "160289182226",
  appId: "1:160289182226:web:1245cdeac0eddb92193ecb",
  measurementId: "G-P5WF2BJ70W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'health-diary-app';

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

const showMsg = (msg, type = 'info') => {
    msgText.innerText = msg;
    msgBox.className = 'absolute top-4 left-1/2 transform -translate-x-1/2 z-50 p-4 text-sm rounded-2xl shadow-lg backdrop-blur-md animate-fade-in transition-all w-11/12 max-w-md text-center bg-white border';
    if (type === 'error') msgBox.classList.add('bg-red-500/90', 'text-white', 'border-red-400');
    else if (type === 'success') msgBox.classList.add('bg-emerald-500/90', 'text-white', 'border-emerald-400');
    else msgBox.classList.add('bg-blue-600/90', 'text-white', 'border-blue-400');
    msgBox.classList.remove('hidden');
    setTimeout(() => msgBox.classList.add('hidden'), 3000);
};

let currentUser = null;
let unsubscribeRecords = null;

document.getElementById('login-btn').addEventListener('click', () => {
    const e = document.getElementById('email-input').value;
    const p = document.getElementById('password-input').value;
    if(!e || !p) return showMsg("정보를 입력해주세요.", "error");
    signInWithEmailAndPassword(auth, e, p).then(() => showMsg("로그인 성공!", "success")).catch(() => showMsg("로그인 실패", "error"));
});

document.getElementById('signup-btn').addEventListener('click', () => {
    const e = document.getElementById('email-input').value;
    const p = document.getElementById('password-input').value;
    if(!e || !p) return showMsg("정보를 입력해주세요.", "error");
    createUserWithEmailAndPassword(auth, e, p).then(() => showMsg("회원가입 완료!", "success")).catch((err) => showMsg(err.message, "error"));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        views.auth.classList.add('hidden');
        views.header.classList.remove('hidden');
        views.desktopNav.classList.remove('hidden'); views.desktopNav.classList.add('md:flex');
        views.mobileNav.classList.remove('hidden'); views.mobileNav.classList.add('flex');
        switchTab('calendar'); // 로그인 시 바로 캘린더를 보여주도록 변경!
        document.getElementById('user-greeting').innerText = `${user.email.split('@')[0]}님`;
        fetchMyRecords(user.uid);
    } else {
        currentUser = null;
        
        // 데이터 감지 리스너 해제 및 완전 초기화
        if (unsubscribeRecords) {
            unsubscribeRecords();
            unsubscribeRecords = null;
        }
        // [핵심 추가] 이전 유저의 로컬 데이터 객체를 완벽히 비워줍니다.
        myRecords = {};

        views.auth.classList.remove('hidden');
        views.header.classList.add('hidden');
        views.dashboard.classList.add('hidden');
        views.calendar.classList.add('hidden');
        views.desktopNav.classList.add('hidden'); views.desktopNav.classList.remove('md:flex');
        views.mobileNav.classList.add('hidden'); views.mobileNav.classList.remove('flex');
    }
});

const switchTab = (tabName) => {
    const isDash = tabName === 'dashboard';
    views.dashboard.classList.toggle('hidden', !isDash);
    views.calendar.classList.toggle('hidden', isDash);
    
    const dHome = document.getElementById('nav-home'), dCal = document.getElementById('nav-calendar');
    dHome.className = isDash ? "w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold transition" : "w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-white/50 hover:text-slate-800 rounded-xl font-medium transition";
    dCal.className = !isDash ? "w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold transition" : "w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-white/50 hover:text-slate-800 rounded-xl font-medium transition";

    const mHome = document.getElementById('mobile-nav-home'), mCal = document.getElementById('mobile-nav-calendar');
    mHome.className = isDash ? "flex flex-col items-center gap-1 text-blue-600" : "flex flex-col items-center gap-1 text-slate-400";
    mCal.className = !isDash ? "flex flex-col items-center gap-1 text-blue-600" : "flex flex-col items-center gap-1 text-slate-400";

    if (!isDash) renderCalendar();
};

document.getElementById('nav-home').addEventListener('click', () => switchTab('dashboard'));
document.getElementById('mobile-nav-home').addEventListener('click', () => switchTab('dashboard'));
document.getElementById('nav-calendar').addEventListener('click', () => switchTab('calendar'));
document.getElementById('mobile-nav-calendar').addEventListener('click', () => switchTab('calendar'));
document.getElementById('shortcut-calendar-btn').addEventListener('click', () => switchTab('calendar'));

let currentDate = new Date();
let myRecords = {};

const fetchMyRecords = (userId) => {
    const recordsRef = collection(db, 'artifacts', appId, 'users', userId, 'healthRecords');
    unsubscribeRecords = onSnapshot(recordsRef, (snapshot) => {
        myRecords = {};
        snapshot.forEach((doc) => { myRecords[doc.id] = doc.data(); });
        if(!views.calendar.classList.contains('hidden')) renderCalendar();
        updateDashboardSummary();
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

// --- [변경됨] 캘린더 렌더링 (구글 태스크 스타일 텍스트 칩 적용) ---
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
        // 셀 높이를 키우고 넘치는 내용은 숨기도록 속성 부여
        cell.className = "calendar-cell bg-white border border-slate-100 p-1 md:p-2 rounded-xl shadow-sm flex flex-col overflow-hidden";
        
        if (cellDateStr === todayStr) cell.classList.add('today-cell');

        const dateSpan = document.createElement('span');
        dateSpan.className = "text-xs md:text-sm font-semibold text-slate-700 block mb-1 px-1";
        // 일요일 빨간색 처리
        const currentDayOfWeek = new Date(year, month, i).getDay();
        if (currentDayOfWeek === 0) dateSpan.classList.add('text-red-500');
        
        dateSpan.innerText = i;
        cell.appendChild(dateSpan);

        // 데이터가 있을 경우 텍스트 라벨 추가
        if (myRecords[cellDateStr]) {
            const data = myRecords[cellDateStr];
            const recordsContainer = document.createElement('div');
            recordsContainer.className = "flex flex-col gap-1 mt-1 w-full";
            
            // 혈압 칩 (빨간색)
            if (data.bp) {
                recordsContainer.innerHTML += `
                    <div class="bg-rose-100 text-rose-700 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text" title="혈압: ${data.bp}">
                        <i data-lucide="activity" class="w-3 h-3 flex-shrink-0"></i> ${data.bp}
                    </div>`;
            }
            // 수분 칩 (파란색)
            if (data.water > 0) {
                recordsContainer.innerHTML += `
                    <div class="bg-blue-100 text-blue-700 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text" title="수분: ${data.water}잔">
                        <i data-lucide="droplet" class="w-3 h-3 flex-shrink-0"></i> ${data.water}잔
                    </div>`;
            }
            // 약 복용 칩 (노란색)
            if (data.meds) {
                recordsContainer.innerHTML += `
                    <div class="bg-amber-100 text-amber-700 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text">
                        <i data-lucide="pill" class="w-3 h-3 flex-shrink-0"></i> 복용완료
                    </div>`;
            }
            // 메모 칩 (회색) - 입력한 내용 앞부분만 보여줌
            if (data.notes) {
                recordsContainer.innerHTML += `
                    <div class="bg-slate-100 text-slate-600 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text" title="${data.notes}">
                        <i data-lucide="align-left" class="w-3 h-3 flex-shrink-0"></i> ${data.notes}
                    </div>`;
            }
            
            cell.appendChild(recordsContainer);
        }

        cell.addEventListener('click', () => openRecordModal(cellDateStr, year, month + 1, i));
        grid.appendChild(cell);
    }
    
    if(window.lucide) window.lucide.createIcons();
};

document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('today-month').addEventListener('click', () => { currentDate = new Date(); renderCalendar(); });

const modal = document.getElementById('record-modal');
let activeRecordDate = "";

const openRecordModal = (dateStr, y, m, d) => {
    activeRecordDate = dateStr;
    document.getElementById('modal-date-title').innerText = `${y}년 ${m}월 ${d}일`;
    
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

    // 빈 값이면 DB에서 필드를 지우기 위해 처리 가능하지만, 우선은 덮어쓰기 형태로 유지합니다.
    const recordData = { bp, water, meds, notes, updatedAt: new Date().toISOString() };

    try {
        const docRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'healthRecords', activeRecordDate);
        await setDoc(docRef, recordData, { merge: true });
        
        showMsg("저장되었습니다!", "success");
        modal.classList.add('hidden');
    } catch (error) {
        console.error("저장 실패:", error);
        showMsg("오류가 발생했습니다.", "error");
    }
});
