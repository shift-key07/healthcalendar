import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// 뷰 매핑
const views = {
    auth: document.getElementById('auth-section'),
    header: document.getElementById('user-header'),
    dashboard: document.getElementById('dashboard-view'),
    calendar: document.getElementById('calendar-view'),
    alarm: document.getElementById('alarm-view'), // 추가됨
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

// --- 상태 변수 ---
let currentUser = null;
let unsubscribeRecords = null;
let unsubscribeAlarms = null; // 알람 감지기

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
        
        switchTab('dashboard'); // 기본 화면 대시보드
        document.getElementById('user-greeting').innerText = `${user.email.split('@')[0]}님`;
        
        fetchMyRecords(user.uid);
        fetchMyAlarms(user.uid); // 알람 가져오기 시작
        startAlarmChecker();     // 알람 시간 감지 시작!
    } else {
        currentUser = null;
        if (unsubscribeRecords) unsubscribeRecords();
        if (unsubscribeAlarms) unsubscribeAlarms();
        stopAlarmChecker();      // 로그아웃 시 알람 감지 중지
        
        myRecords = {};
        myAlarms = [];
        
        views.auth.classList.remove('hidden');
        views.header.classList.add('hidden');
        views.dashboard.classList.add('hidden');
        views.calendar.classList.add('hidden');
        views.alarm.classList.add('hidden');
        views.desktopNav.classList.add('hidden'); views.desktopNav.classList.remove('md:flex');
        views.mobileNav.classList.add('hidden'); views.mobileNav.classList.remove('flex');
    }
});

// --- 네비게이션 탭 스위칭 ---
const switchTab = (tabName) => {
    // 뷰 보이기/숨기기
    views.dashboard.classList.toggle('hidden', tabName !== 'dashboard');
    views.calendar.classList.toggle('hidden', tabName !== 'calendar');
    views.alarm.classList.toggle('hidden', tabName !== 'alarm');
    
    // 버튼 스타일 초기화 함수
    const setBtnStyle = (id, isActive, isMobile = false) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        if(isMobile) {
            btn.className = isActive ? "flex flex-col items-center gap-1 text-blue-600" : "flex flex-col items-center gap-1 text-slate-400";
        } else {
            btn.className = isActive ? "w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold transition" : "w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-white/50 hover:text-slate-800 rounded-xl font-medium transition";
        }
    };

    setBtnStyle('nav-home', tabName === 'dashboard');
    setBtnStyle('nav-calendar', tabName === 'calendar');
    setBtnStyle('nav-alarm', tabName === 'alarm');
    
    setBtnStyle('mobile-nav-home', tabName === 'dashboard', true);
    setBtnStyle('mobile-nav-calendar', tabName === 'calendar', true);
    setBtnStyle('mobile-nav-alarm', tabName === 'alarm', true);

    if (tabName === 'calendar') renderCalendar();
};

document.getElementById('nav-home').addEventListener('click', () => switchTab('dashboard'));
document.getElementById('mobile-nav-home').addEventListener('click', () => switchTab('dashboard'));
document.getElementById('nav-calendar').addEventListener('click', () => switchTab('calendar'));
document.getElementById('mobile-nav-calendar').addEventListener('click', () => switchTab('calendar'));
document.getElementById('shortcut-calendar-btn').addEventListener('click', () => switchTab('calendar'));
document.getElementById('nav-alarm').addEventListener('click', () => switchTab('alarm'));
document.getElementById('mobile-nav-alarm').addEventListener('click', () => switchTab('alarm'));

// ==========================================
// 1. 기존 캘린더 로직 (동일)
// ==========================================
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
        cell.className = "calendar-cell bg-white border border-slate-100 p-1 md:p-2 rounded-xl shadow-sm flex flex-col overflow-hidden";
        
        if (cellDateStr === todayStr) cell.classList.add('today-cell');

        const dateSpan = document.createElement('span');
        dateSpan.className = "text-xs md:text-sm font-semibold text-slate-700 block mb-1 px-1";
        if (new Date(year, month, i).getDay() === 0) dateSpan.classList.add('text-red-500');
        
        dateSpan.innerText = i;
        cell.appendChild(dateSpan);

        if (myRecords[cellDateStr]) {
            const data = myRecords[cellDateStr];
            const recordsContainer = document.createElement('div');
            recordsContainer.className = "flex flex-col gap-1 mt-1 w-full";
            
            if (data.bp) recordsContainer.innerHTML += `<div class="bg-rose-100 text-rose-700 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text" title="혈압: ${data.bp}"><i data-lucide="activity" class="w-3 h-3 flex-shrink-0"></i> ${data.bp}</div>`;
            if (data.water > 0) recordsContainer.innerHTML += `<div class="bg-blue-100 text-blue-700 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text" title="수분: ${data.water}잔"><i data-lucide="droplet" class="w-3 h-3 flex-shrink-0"></i> ${data.water}잔</div>`;
            if (data.meds) recordsContainer.innerHTML += `<div class="bg-amber-100 text-amber-700 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text"><i data-lucide="pill" class="w-3 h-3 flex-shrink-0"></i> 복용완료</div>`;
            if (data.notes) recordsContainer.innerHTML += `<div class="bg-slate-100 text-slate-600 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text" title="${data.notes}"><i data-lucide="align-left" class="w-3 h-3 flex-shrink-0"></i> ${data.notes}</div>`;
            
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

const recordModal = document.getElementById('record-modal');
let activeRecordDate = "";

const openRecordModal = (dateStr, y, m, d) => {
    activeRecordDate = dateStr;
    document.getElementById('modal-date-title').innerText = `${y}년 ${m}월 ${d}일`;
    const data = myRecords[dateStr] || { bp: "", water: 0, meds: false, notes: "" };
    
    document.getElementById('record-bp').value = data.bp;
    document.getElementById('record-water').value = data.water;
    document.getElementById('record-meds').checked = data.meds;
    document.getElementById('record-notes').value = data.notes;
    recordModal.classList.remove('hidden');
};

document.getElementById('close-modal-btn').addEventListener('click', () => recordModal.classList.add('hidden'));

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
        showMsg("저장되었습니다!", "success");
        recordModal.classList.add('hidden');
    } catch (error) { showMsg("오류가 발생했습니다.", "error"); }
});

// ==========================================
// 2. 신규 알람 로직 (백그라운드 & UI)
// ==========================================
let myAlarms = []; 
const addAlarmModal = document.getElementById('add-alarm-modal');
const alarmTriggerModal = document.getElementById('alarm-trigger-modal');
let alarmTimerId = null;
let lastTriggeredTime = ""; // 같은 1분 내에 중복 알림 방지

// Firestore에서 알람 실시간 가져오기
const fetchMyAlarms = (userId) => {
    const alarmsRef = collection(db, 'artifacts', appId, 'users', userId, 'alarms');
    unsubscribeAlarms = onSnapshot(alarmsRef, (snapshot) => {
        myAlarms = [];
        snapshot.forEach((doc) => {
            myAlarms.push({ id: doc.id, ...doc.data() });
        });
        
        // 시간순 정렬
        myAlarms.sort((a, b) => a.time.localeCompare(b.time));
        renderAlarmList();
    });
};

// 알람 리스트 HTML 그리기
const renderAlarmList = () => {
    const listEl = document.getElementById('alarm-list');
    listEl.innerHTML = '';

    if(myAlarms.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-slate-400 flex flex-col items-center"><i data-lucide="bell-off" class="w-10 h-10 mb-2 opacity-50"></i><p>등록된 알림이 없습니다.</p></div>`;
    } else {
        myAlarms.forEach(alarm => {
            const item = document.createElement('div');
            item.className = "flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm";
            item.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="text-2xl font-black text-slate-800">${alarm.time}</div>
                    <div class="font-bold text-slate-600">${alarm.title}</div>
                </div>
                <button class="delete-alarm-btn text-slate-400 hover:text-red-500 p-2 transition" data-id="${alarm.id}">
                    <i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i>
                </button>
            `;
            listEl.appendChild(item);
        });
    }

    // 삭제 버튼 이벤트 연결
    document.querySelectorAll('.delete-alarm-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const alarmId = e.target.getAttribute('data-id');
            if(confirm('이 알림을 삭제할까요?')) {
                await deleteDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'alarms', alarmId));
                showMsg('알림이 삭제되었습니다.');
            }
        });
    });
    
    if(window.lucide) window.lucide.createIcons();
};

// 알람 추가 모달 열기/닫기
document.getElementById('open-add-alarm-btn').addEventListener('click', () => {
    document.getElementById('alarm-time-input').value = "09:00"; // 기본값
    document.getElementById('alarm-title-input').value = "";
    addAlarmModal.classList.remove('hidden');
});
document.getElementById('close-alarm-modal-btn').addEventListener('click', () => addAlarmModal.classList.add('hidden'));

// 알람 DB에 저장
document.getElementById('save-alarm-btn').addEventListener('click', async () => {
    const time = document.getElementById('alarm-time-input').value; // 형식: "09:00"
    const title = document.getElementById('alarm-title-input').value.trim();

    if(!time || !title) return showMsg("시간과 알림 이름을 모두 입력해주세요.", "error");

    // 랜덤 ID로 저장 (같은 시간에 여러 알람이 있을 수 있으므로)
    const newAlarmId = crypto.randomUUID();
    
    try {
        await setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'alarms', newAlarmId), {
            time: time,
            title: title,
            createdAt: new Date().toISOString()
        });
        showMsg("알림이 등록되었습니다!", "success");
        addAlarmModal.classList.add('hidden');
    } catch(err) {
        console.error(err);
        showMsg("저장 실패", "error");
    }
});

// --- 시간 감지기 (타이머) ---
const startAlarmChecker = () => {
    if(alarmTimerId) clearInterval(alarmTimerId);
    
    // 10초마다 현재 시간을 확인합니다.
    alarmTimerId = setInterval(() => {
        if(!currentUser || myAlarms.length === 0) return;
        
        const now = new Date();
        // 현재 시간을 "HH:MM" 형식으로 변환
        const currentHHMM = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');

        // 방금 울린 분(minute)이 아닐 때만 검사
        if(currentHHMM !== lastTriggeredTime) {
            // 현재 시간과 일치하는 알람 찾기
            const matchingAlarm = myAlarms.find(a => a.time === currentHHMM);
            
            if(matchingAlarm) {
                // 알람 발견! 화면에 모달 띄우기
                document.getElementById('alarm-trigger-title').innerText = matchingAlarm.title;
                alarmTriggerModal.classList.remove('hidden');
                
                // 중복 실행을 막기 위해 마지막 실행 시간 기록
                lastTriggeredTime = currentHHMM;
            }
        }
    }, 10000); // 10초(10000ms)
};

const stopAlarmChecker = () => {
    if(alarmTimerId) clearInterval(alarmTimerId);
    lastTriggeredTime = "";
};

// 알람 끄기 버튼 (모달 닫기)
document.getElementById('dismiss-alarm-btn').addEventListener('click', () => {
    alarmTriggerModal.classList.add('hidden');
});
