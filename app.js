import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// [추가됨] getDoc 임포트
import { getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// TODO: 본인 파이어베이스 키로 변경하세요!
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

// 🌟 관리자 이메일 설정 (반드시 본인 이메일로 변경하세요!)
const ADMIN_EMAIL = "asdf@asdf.com";

// 고유 익명 닉네임 생성 함수
const getUserNickname = (uid) => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const num = Math.abs(hash) % 10000;
    return `ㅇㅇ(${String(num).padStart(4, '0')})`;
};

// 다크모드 제어
const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.querySelectorAll('.dark-icon').forEach(icon => icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon'));
    document.querySelectorAll('.dark-text').forEach(txt => txt.innerText = isDark ? '라이트 모드' : '다크 모드');
    if(window.lucide) window.lucide.createIcons();
    if(!views.dashboard.classList.contains('hidden')) renderChart();
};
document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
document.getElementById('mobile-dark-mode-toggle').addEventListener('click', toggleDarkMode);

if (document.documentElement.classList.contains('dark')) {
    document.querySelectorAll('.dark-icon').forEach(icon => icon.setAttribute('data-lucide', 'sun'));
    document.querySelectorAll('.dark-text').forEach(txt => txt.innerText = '라이트 모드');
}

const views = {
    auth: document.getElementById('auth-section'),
    header: document.getElementById('user-header'),
    dashboard: document.getElementById('dashboard-view'),
    calendar: document.getElementById('calendar-view'),
    diary: document.getElementById('diary-view'),
    community: document.getElementById('community-view'),
    alarm: document.getElementById('alarm-view'),
    desktopNav: document.getElementById('desktop-sidebar'),
    mobileNav: document.getElementById('bottom-nav')
};
const msgBox = document.getElementById('message-box');
const msgText = document.getElementById('message-text');

const showMsg = (msg, type = 'info') => {
    msgText.innerText = msg;
    msgBox.className = 'absolute top-4 left-1/2 transform -translate-x-1/2 z-50 p-4 text-sm rounded-2xl shadow-lg backdrop-blur-md animate-fade-in transition-all w-11/12 max-w-md text-center bg-white dark:bg-slate-800 border dark:border-slate-700';
    if (type === 'error') msgBox.classList.add('bg-red-500/90', 'text-white', 'border-red-400');
    else if (type === 'success') msgBox.classList.add('bg-emerald-500/90', 'text-white', 'border-emerald-400');
    else msgBox.classList.add('bg-blue-600/90', 'text-white', 'border-blue-400');
    msgBox.classList.remove('hidden');
    setTimeout(() => msgBox.classList.add('hidden'), 3000);
};

const alarmAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
alarmAudio.loop = true;

const fetchHealthNews = async () => {
    const container = document.getElementById('health-news-container');
    try {
        const rssUrl = encodeURIComponent('https://news.google.com/rss/search?q=건강+OR+다이어트&hl=ko&gl=KR&ceid=KR:ko');
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`);
        const data = await response.json();
        if (data.status === 'ok') {
            container.innerHTML = ''; 
            const articles = data.items.slice(0, 3);
            articles.forEach(article => {
                const date = new Date(article.pubDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
                container.innerHTML += `
                    <a href="${article.link}" target="_blank" class="bg-white/60 dark:bg-slate-800/60 p-4 rounded-2xl flex flex-col gap-2 hover:bg-white/90 dark:hover:bg-slate-700 transition shadow-sm cursor-pointer block border border-transparent hover:border-blue-200 dark:hover:border-slate-600">
                        <p class="font-bold text-slate-800 dark:text-slate-200 text-sm leading-snug line-clamp-2" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${article.title}</p>
                        <div class="flex justify-between items-center mt-1">
                            <span class="text-xs font-semibold text-blue-500">${article.source || '건강 리포트'}</span><span class="text-xs text-slate-400">${date}</span>
                        </div>
                    </a>`;
            });
        }
    } catch (error) { container.innerHTML = `<div class="text-center text-sm text-slate-400 py-4">최신 뉴스를 불러오지 못했습니다.</div>`; }
};

let currentUser = null;
let unsubscribeRecords = null;
let unsubscribeDiaries = null;
let unsubscribeAlarms = null;
let unsubscribeCommunity = null;

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
        switchTab('dashboard'); 
        document.getElementById('user-greeting').innerText = `${user.email.split('@')[0]}님`;
        
        fetchMyRecords(user.uid);
        fetchMyDiaries(user.uid);
        fetchMyAlarms(user.uid);
        fetchCommunityPosts(); 
        startAlarmChecker();
        fetchHealthNews();
    } else {
        currentUser = null;
        if (unsubscribeRecords) unsubscribeRecords();
        if (unsubscribeDiaries) unsubscribeDiaries();
        if (unsubscribeAlarms) unsubscribeAlarms();
        if (unsubscribeCommunity) unsubscribeCommunity();
        stopAlarmChecker();
        
        myRecords = {}; myDiaries = {}; myAlarms = []; communityPosts = [];
        views.auth.classList.remove('hidden');
        views.header.classList.add('hidden');
        views.dashboard.classList.add('hidden');
        views.calendar.classList.add('hidden');
        views.diary.classList.add('hidden'); 
        views.community.classList.add('hidden'); 
        views.alarm.classList.add('hidden');
        views.desktopNav.classList.add('hidden'); views.desktopNav.classList.remove('md:flex');
        views.mobileNav.classList.add('hidden'); views.mobileNav.classList.remove('flex');
    }
});

const switchTab = (tabName) => {
    views.dashboard.classList.toggle('hidden', tabName !== 'dashboard');
    views.calendar.classList.toggle('hidden', tabName !== 'calendar');
    views.diary.classList.toggle('hidden', tabName !== 'diary'); 
    views.community.classList.toggle('hidden', tabName !== 'community'); 
    views.alarm.classList.toggle('hidden', tabName !== 'alarm');
    
    const setBtnStyle = (id, isActive, isMobile = false) => {
        const btn = document.getElementById(id);
        if(!btn) return;
        if(isMobile) {
            btn.className = isActive ? "flex flex-col items-center gap-1 text-blue-600 dark:text-blue-400 w-[16%]" : "flex flex-col items-center gap-1 text-slate-400 w-[16%]";
        } else {
            btn.className = isActive ? "w-full flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl font-bold transition" : "w-full flex items-center gap-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-white rounded-xl font-medium transition";
        }
    };
    
    setBtnStyle('nav-home', tabName === 'dashboard'); 
    setBtnStyle('nav-calendar', tabName === 'calendar'); 
    setBtnStyle('nav-diary', tabName === 'diary'); 
    setBtnStyle('nav-community', tabName === 'community'); 
    setBtnStyle('nav-alarm', tabName === 'alarm');
    
    setBtnStyle('mobile-nav-home', tabName === 'dashboard', true); 
    setBtnStyle('mobile-nav-calendar', tabName === 'calendar', true); 
    setBtnStyle('mobile-nav-diary', tabName === 'diary', true); 
    setBtnStyle('mobile-nav-community', tabName === 'community', true); 
    setBtnStyle('mobile-nav-alarm', tabName === 'alarm', true);

    if (tabName === 'calendar') renderCalendar();
    if (tabName === 'dashboard') renderChart();
    if (tabName === 'diary') renderFullDiaryList(); 
    if (tabName === 'community') renderCommunityFeed(); 
};

document.getElementById('nav-home').addEventListener('click', () => switchTab('dashboard'));
document.getElementById('mobile-nav-home').addEventListener('click', () => switchTab('dashboard'));
document.getElementById('nav-calendar').addEventListener('click', () => switchTab('calendar'));
document.getElementById('mobile-nav-calendar').addEventListener('click', () => switchTab('calendar'));
document.getElementById('nav-diary').addEventListener('click', () => switchTab('diary'));
document.getElementById('mobile-nav-diary').addEventListener('click', () => switchTab('diary'));
document.getElementById('nav-community').addEventListener('click', () => switchTab('community'));
document.getElementById('mobile-nav-community').addEventListener('click', () => switchTab('community'));
document.getElementById('nav-alarm').addEventListener('click', () => switchTab('alarm'));
document.getElementById('mobile-nav-alarm').addEventListener('click', () => switchTab('alarm'));

document.getElementById('shortcut-calendar-btn').addEventListener('click', () => switchTab('calendar'));
document.getElementById('shortcut-diary-btn').addEventListener('click', () => { switchTab('diary'); document.getElementById('open-write-diary-btn').click(); });


// ----------------------------------------------------
// 개인 기록 로직 (건강수치, 일기, 차트 등 기존과 동일)
// ----------------------------------------------------
let currentDate = new Date();
let myRecords = {}; 
let myDiaries = {}; 

const fetchMyRecords = (userId) => {
    const recordsRef = collection(db, 'artifacts', appId, 'users', userId, 'healthRecords');
    unsubscribeRecords = onSnapshot(recordsRef, (snapshot) => {
        myRecords = {};
        snapshot.forEach((doc) => { myRecords[doc.id] = doc.data(); });
        if(!views.calendar.classList.contains('hidden')) renderCalendar();
        updateDashboardSummary();
        renderChart();
    });
};

const fetchMyDiaries = (userId) => {
    const diariesRef = collection(db, 'artifacts', appId, 'users', userId, 'diaries');
    unsubscribeDiaries = onSnapshot(diariesRef, (snapshot) => {
        myDiaries = {};
        snapshot.forEach((doc) => { myDiaries[doc.id] = doc.data(); });
        if(!views.diary.classList.contains('hidden')) renderFullDiaryList();
        updateDashboardSummary();
        updateRecentDiary(); 
    });
};

const hasData = (dateStr) => {
    const rec = myRecords[dateStr];
    const dia = myDiaries[dateStr];
    return (rec && (rec.bp || rec.water > 0 || rec.steps > 0 || rec.meds || rec.notes)) || (dia && dia.content);
};

const updateStreakUI = () => {
    const badgeEl = document.getElementById('streak-badge');
    const countEl = document.getElementById('streak-count');
    if(!badgeEl || !countEl) return;
    let streak = 0; let d = new Date();
    let todayStr = getLocalDateString(d);
    let yesterday = new Date(d); yesterday.setDate(yesterday.getDate() - 1);
    if (!hasData(todayStr) && !hasData(getLocalDateString(yesterday))) { badgeEl.classList.add('hidden'); return; }
    for (let i = 0; i < 365; i++) {
        let checkDate = new Date(); checkDate.setDate(checkDate.getDate() - i);
        let dateStr = getLocalDateString(checkDate);
        if (i === 0 && !hasData(dateStr)) continue; 
        if (hasData(dateStr)) streak++; else break; 
    }
    if (streak > 0) { countEl.innerText = streak; badgeEl.classList.remove('hidden'); } else { badgeEl.classList.add('hidden'); }
};

const updateDashboardSummary = () => {
    updateStreakUI();
    const todayStr = getLocalDateString(new Date());
    const data = myRecords[todayStr];
    const diaryData = myDiaries[todayStr];
    const summaryEl = document.getElementById('today-summary-text');
    let summary = "";
    if(data) {
        if(data.bp) summary += `혈압: ${data.bp}<br>`;
        if(data.water > 0) summary += `수분: ${data.water}잔<br>`;
        if(data.steps > 0) summary += `걸음수: ${data.steps}보<br>`;
        if(data.meds) summary += `약 복용: 완료<br>`;
    }
    if(!summary && diaryData && diaryData.content) summary = "오늘의 일기가 작성되었습니다!";
    else if(!summary) summary = "기록된 항목이 없습니다.";
    
    if(data || (diaryData && diaryData.content)) {
        summaryEl.innerHTML = summary;
        summaryEl.classList.replace('text-2xl', 'text-xl'); summaryEl.classList.replace('md:text-3xl', 'md:text-2xl');
    } else {
        summaryEl.innerHTML = "캘린더나 일기장에서<br>오늘을 기록해 보세요!";
        summaryEl.classList.replace('text-xl', 'text-2xl'); summaryEl.classList.replace('md:text-2xl', 'md:text-3xl');
    }
};

const updateRecentDiary = () => {
    const container = document.getElementById('recent-diary-container');
    container.innerHTML = '';
    const dates = Object.keys(myDiaries).sort((a, b) => new Date(b) - new Date(a)).slice(0, 2); 
    if(dates.length === 0) {
        container.innerHTML = `<p class="text-sm text-slate-400 dark:text-slate-500 text-center py-4">기록된 일기가 없습니다.</p>`; return;
    }
    dates.forEach(date => {
        const text = myDiaries[date].content; 
        const formattedDate = new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        container.innerHTML += `
            <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/50 relative cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 transition" onclick="document.getElementById('nav-diary').click()">
                <div class="absolute -top-3 -right-2 text-4xl opacity-20">"</div>
                <p class="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">${formattedDate}</p>
                <p class="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 leading-relaxed">${text}</p>
            </div>`;
    });
};

const renderFullDiaryList = () => {
    const listEl = document.getElementById('full-diary-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    const dates = Object.keys(myDiaries).sort((a, b) => new Date(b) - new Date(a));
    if(dates.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-10 text-slate-400">
                <i data-lucide="book-x" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                <p>아직 작성된 일기가 없습니다.</p>
            </div>`;
    } else {
        dates.forEach(date => {
            const data = myDiaries[date];
            const d = new Date(date);
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const formattedDate = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
            listEl.innerHTML += `
                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative hover:shadow-md transition cursor-pointer" onclick="openDiaryModal('${date}')">
                    <div class="flex justify-between items-start mb-3"><h4 class="font-bold text-slate-800 dark:text-white">${formattedDate}</h4><button class="text-slate-400 hover:text-purple-500"><i data-lucide="edit-3" class="w-4 h-4"></i></button></div>
                    <p class="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">${data.content}</p>
                </div>`;
        });
    }
    if(window.lucide) window.lucide.createIcons();
};

const getLocalDateString = (d) => {
    const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const renderCalendar = () => {
    const year = currentDate.getFullYear(); const month = currentDate.getMonth();
    document.getElementById('calendar-month-year').innerText = `${year}년 ${month + 1}월`;
    const firstDay = new Date(year, month, 1).getDay(); const lastDate = new Date(year, month + 1, 0).getDate();
    const todayStr = getLocalDateString(new Date());
    const grid = document.getElementById('calendar-grid'); grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) { grid.innerHTML += `<div class="p-2 rounded-xl bg-transparent"></div>`; }
    for (let i = 1; i <= lastDate; i++) {
        const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const cell = document.createElement('div');
        cell.className = "calendar-cell bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-1 md:p-2 rounded-xl shadow-sm flex flex-col overflow-hidden relative";
        if (cellDateStr === todayStr) cell.classList.add('today-cell');

        const dateSpan = document.createElement('span');
        dateSpan.className = "text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-1 px-1";
        if (new Date(year, month, i).getDay() === 0) dateSpan.classList.add('text-red-500', 'dark:text-red-400');
        dateSpan.innerText = i; cell.appendChild(dateSpan);

        if (myRecords[cellDateStr]) {
            const data = myRecords[cellDateStr];
            const rc = document.createElement('div'); rc.className = "flex flex-col gap-1 mt-1 w-full";
            if (data.bp) rc.innerHTML += `<div class="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text"><i data-lucide="activity" class="w-3 h-3 flex-shrink-0"></i> ${data.bp}</div>`;
            if (data.water > 0) rc.innerHTML += `<div class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text"><i data-lucide="droplet" class="w-3 h-3 flex-shrink-0"></i> ${data.water}잔</div>`;
            if (data.steps > 0) rc.innerHTML += `<div class="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text"><i data-lucide="footprints" class="w-3 h-3 flex-shrink-0"></i> ${data.steps}</div>`;
            if (data.meds) rc.innerHTML += `<div class="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text"><i data-lucide="pill" class="w-3 h-3 flex-shrink-0"></i> 복용</div>`;
            if (data.notes) rc.innerHTML += `<div class="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] md:text-xs px-1.5 py-0.5 rounded flex items-center gap-1 w-full truncate-text"><i data-lucide="align-left" class="w-3 h-3 flex-shrink-0"></i> ${data.notes}</div>`;
            cell.appendChild(rc);
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
    activeRecordDate = dateStr; document.getElementById('modal-date-title').innerText = `${y}년 ${m}월 ${d}일`;
    const data = myRecords[dateStr] || { bp: "", water: 0, steps: "", meds: false, notes: "" };
    document.getElementById('record-bp').value = data.bp; document.getElementById('record-water').value = data.water;
    document.getElementById('record-steps').value = data.steps || ""; document.getElementById('record-meds').checked = data.meds;
    document.getElementById('record-notes').value = data.notes;
    recordModal.classList.remove('hidden');
};
document.getElementById('close-modal-btn').addEventListener('click', () => recordModal.classList.add('hidden'));

document.getElementById('save-record-btn').addEventListener('click', async () => {
    if (!currentUser) return;
    const bp = document.getElementById('record-bp').value.trim(); const water = parseInt(document.getElementById('record-water').value) || 0;
    const steps = parseInt(document.getElementById('record-steps').value) || 0; const meds = document.getElementById('record-meds').checked;
    const notes = document.getElementById('record-notes').value.trim();
    
    try {
        await setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'healthRecords', activeRecordDate), { bp, water, steps, meds, notes, updatedAt: new Date().toISOString() }, { merge: true });
        showMsg("저장되었습니다!", "success"); recordModal.classList.add('hidden');
    } catch (error) { showMsg("오류가 발생했습니다.", "error"); }
});

const diaryModal = document.getElementById('diary-modal');
const diaryDateInput = document.getElementById('diary-date-input');
const diaryContentInput = document.getElementById('diary-content-input');
const openDiaryModal = (dateStr) => {
    if(!dateStr) dateStr = getLocalDateString(new Date());
    diaryDateInput.value = dateStr; const data = myDiaries[dateStr]; diaryContentInput.value = data ? data.content : "";
    diaryModal.classList.remove('hidden');
};
document.getElementById('open-write-diary-btn').addEventListener('click', () => openDiaryModal());
document.getElementById('close-diary-modal-btn').addEventListener('click', () => diaryModal.classList.add('hidden'));
diaryDateInput.addEventListener('change', (e) => { const data = myDiaries[e.target.value]; diaryContentInput.value = data ? data.content : ""; });

document.getElementById('save-diary-btn').addEventListener('click', async () => {
    if (!currentUser) return;
    const selectedDate = diaryDateInput.value; const content = diaryContentInput.value.trim();
    if(!selectedDate || !content) return showMsg("내용을 입력해주세요.", "error");
    try {
        await setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'diaries', selectedDate), { content, updatedAt: new Date().toISOString() }, { merge: true });
        showMsg("일기가 저장되었습니다!", "success"); diaryModal.classList.add('hidden');
    } catch (error) { showMsg("오류 발생.", "error"); }
});

let healthChartInstance = null; let currentChartType = 'steps'; 
const renderChart = () => {
    const canvas = document.getElementById('healthChart'); if(!canvas) return; const ctx = canvas.getContext('2d');
    if (healthChartInstance) healthChartInstance.destroy(); 
    const labels = []; const dataset1 = []; const dataset2 = []; 

    const today = new Date(); const currentDayOfWeek = today.getDay(); 
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - currentDayOfWeek);
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
    document.getElementById('chart-date-range').innerText = `(${startOfWeek.getMonth()+1}/${startOfWeek.getDate()} ~ ${endOfWeek.getMonth()+1}/${endOfWeek.getDate()})`;

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    for(let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
        labels.push(`${d.getMonth()+1}/${d.getDate()}(${dayNames[d.getDay()]})`);
        const data = myRecords[getLocalDateString(d)] || {};
        if (currentChartType === 'steps') dataset1.push(data.steps || 0);
        else if (currentChartType === 'water') dataset1.push(data.water || 0);
        else if (currentChartType === 'bp') {
            let sys = 0, dia = 0;
            if(data.bp && data.bp.includes('/')) { const parts = data.bp.split('/'); sys = parseInt(parts[0]) || 0; dia = parseInt(parts[1]) || 0; }
            dataset1.push(sys); dataset2.push(dia);
        }
    }

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b'; const gridColor = isDark ? '#334155' : '#e2e8f0';
    Chart.defaults.color = textColor;
    let yAxisConfig = { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } };
    if (currentChartType === 'water') { yAxisConfig.suggestedMax = 10; yAxisConfig.ticks.stepSize = 1; } 
    else if (currentChartType === 'bp') { yAxisConfig.beginAtZero = false; yAxisConfig.suggestedMin = 60; yAxisConfig.suggestedMax = 160; }

    const config = {
        type: currentChartType === 'bp' ? 'line' : 'bar', data: { labels: labels, datasets: [] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: currentChartType === 'bp', labels: { color: textColor } } }, scales: { y: yAxisConfig, x: { grid: { display: false }, ticks: { color: textColor } } } }
    };
    if (currentChartType === 'steps') config.data.datasets.push({ label: '걸음수(보)', data: dataset1, backgroundColor: '#10b981', borderRadius: 4 });
    else if (currentChartType === 'water') config.data.datasets.push({ label: '수분(잔)', data: dataset1, backgroundColor: '#3b82f6', borderRadius: 4 });
    else if (currentChartType === 'bp') {
        config.data.datasets.push({ label: '수축기', data: dataset1, borderColor: '#f43f5e', backgroundColor: '#f43f5e', tension: 0.3 });
        config.data.datasets.push({ label: '이완기', data: dataset2, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.3 });
    }
    healthChartInstance = new Chart(ctx, config);
};

['steps', 'bp', 'water'].forEach(type => {
    const btn = document.getElementById(`chart-tab-${type}`);
    if(btn) {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-tab').forEach(el => { el.classList.remove('bg-white', 'text-blue-600', 'shadow-sm', 'dark:bg-slate-700', 'dark:text-blue-400'); el.classList.add('text-slate-500', 'dark:text-slate-400'); });
            e.target.classList.remove('text-slate-500', 'dark:text-slate-400'); e.target.classList.add('bg-white', 'text-blue-600', 'shadow-sm', 'dark:bg-slate-700', 'dark:text-blue-400');
            currentChartType = type; renderChart();
        });
    }
});

// ----------------------------------------------------
// 🌟 커뮤니티 관리 및 뮤트(차단) 로직 
// ----------------------------------------------------
let communityPosts = [];
let activePostForComment = null; 

// [새로 추가됨] 뮤트(차단) 상태 확인 함수
const checkMuteStatus = async (uid) => {
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'mutedUsers', uid));
        if(snap.exists()) {
            const mutedUntil = new Date(snap.data().mutedUntil);
            if(mutedUntil > new Date()) return mutedUntil; // 차단 기한이 남았으면 시간 반환
        }
    } catch(e) { console.error(e); }
    return false;
};

const fetchCommunityPosts = () => {
    const postsRef = collection(db, 'artifacts', appId, 'communityPosts');
    unsubscribeCommunity = onSnapshot(postsRef, (snapshot) => {
        communityPosts = [];
        snapshot.forEach((doc) => { communityPosts.push({ id: doc.id, ...doc.data() }); });
        communityPosts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        if(!views.community.classList.contains('hidden')) renderCommunityFeed();
    });
};

const renderCommunityFeed = () => {
    const listEl = document.getElementById('community-feed-list');
    if(!listEl) return;
    listEl.innerHTML = '';

    if(communityPosts.length === 0) {
        listEl.innerHTML = `
            <div class="text-center py-10 text-slate-400">
                <i data-lucide="message-square" class="w-12 h-12 mx-auto mb-3 opacity-50"></i>
                <p>아직 작성된 글이 없습니다.</p>
            </div>`;
    } else {
        communityPosts.forEach(post => {
            const d = new Date(post.createdAt);
            const timeStr = d.toLocaleDateString() === new Date().toLocaleDateString() 
                            ? `오늘 ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` 
                            : d.toLocaleDateString();
                            
            const isLiked = post.likes && post.likes.includes(currentUser.uid);
            const likeCount = post.likes ? post.likes.length : 0;
            const comments = post.comments || [];
            
            const isAdminView = currentUser.email === ADMIN_EMAIL;
            const canDeletePost = post.authorId === currentUser.uid || isAdminView;
            const canMutePostAuthor = isAdminView && !post.isAdmin; // 관리자가 아니면 뮤트 가능

            // 👑 관리자 전용 아바타/닉네임 스타일
            const avatarHtml = post.isAdmin 
                ? `<div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-sm">👑</div>`
                : `<div class="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm">${post.authorName.replace('ㅇㅇ(', '').replace(')', '')}</div>`;
            
            const authorNameHtml = post.isAdmin
                ? `<p class="font-bold text-amber-500 text-sm">👑 관리자</p>`
                : `<p class="font-bold text-slate-800 dark:text-white text-sm">${post.authorName}</p>`;

            let commentsHtml = '';
            if(comments.length > 0) {
                commentsHtml = `<div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">`;
                comments.forEach(c => {
                    const canDeleteComment = c.authorId === currentUser.uid || isAdminView;
                    const canMuteCommentAuthor = isAdminView && !c.isAdmin;
                    
                    const commentName = c.isAdmin ? `<span class="font-bold text-amber-500 mr-2">👑 관리자</span>` : `<span class="font-bold text-slate-700 dark:text-slate-300 mr-2">${c.authorName}</span>`;

                    commentsHtml += `
                        <div class="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-sm relative group flex justify-between items-start">
                            <div>
                                ${commentName}
                                <span class="text-slate-600 dark:text-slate-400">${c.text}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                ${canMuteCommentAuthor ? `<button class="mute-user-btn text-slate-400 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition" data-uid="${c.authorId}" title="이 사용자 뮤트(차단)"><i data-lucide="mic-off" class="w-4 h-4 pointer-events-none"></i></button>` : ''}
                                ${canDeleteComment ? `<button class="delete-comment-btn text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition" data-post-id="${post.id}" data-comment-id="${c.id}" title="댓글 삭제"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>` : ''}
                            </div>
                        </div>`;
                });
                commentsHtml += `</div>`;
            }

            listEl.innerHTML += `
                <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative">
                    <div class="flex items-center gap-3 mb-3">
                        ${avatarHtml}
                        <div>
                            ${authorNameHtml}
                            <p class="text-xs text-slate-400">${timeStr}</p>
                        </div>
                        <div class="ml-auto flex items-center gap-3">
                            ${canMutePostAuthor ? `<button class="mute-user-btn text-slate-400 hover:text-orange-500" data-uid="${post.authorId}" title="이 사용자 뮤트(차단)"><i data-lucide="mic-off" class="w-4 h-4 pointer-events-none"></i></button>` : ''}
                            ${canDeletePost ? `<button class="delete-post-btn text-slate-400 hover:text-red-500" data-id="${post.id}" title="글 삭제"><i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i></button>` : ''}
                        </div>
                    </div>
                    
                    <p class="text-slate-700 dark:text-slate-200 whitespace-pre-wrap mb-4">${post.content}</p>
                    
                    <div class="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm">
                        <button class="like-btn flex items-center gap-1 transition ${isLiked ? 'text-rose-500' : 'hover:text-rose-500'}" data-id="${post.id}">
                            <i data-lucide="heart" class="w-5 h-5 pointer-events-none ${isLiked ? 'fill-current' : ''}"></i> ${likeCount}
                        </button>
                        <button class="comment-btn flex items-center gap-1 transition hover:text-emerald-500" data-id="${post.id}">
                            <i data-lucide="message-circle" class="w-5 h-5 pointer-events-none"></i> ${comments.length}
                        </button>
                    </div>
                    
                    ${commentsHtml}
                </div>
            `;
        });
    }
    
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleLike(e.target.getAttribute('data-id')));
    });
    
    document.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            activePostForComment = e.target.getAttribute('data-id');
            document.getElementById('comment-input').value = '';
            document.getElementById('comment-modal').classList.remove('hidden');
        });
    });

    document.querySelectorAll('.delete-post-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm('이 글을 삭제하시겠습니까?')) {
                await deleteDoc(doc(db, 'artifacts', appId, 'communityPosts', e.target.getAttribute('data-id')));
                showMsg('글이 삭제되었습니다.');
            }
        });
    });

    document.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(confirm('이 댓글을 삭제하시겠습니까?')) {
                const postRef = doc(db, 'artifacts', appId, 'communityPosts', e.target.getAttribute('data-post-id'));
                const post = communityPosts.find(p => p.id === e.target.getAttribute('data-post-id'));
                const commentToRemove = post.comments.find(c => c.id === e.target.getAttribute('data-comment-id'));
                await updateDoc(postRef, { comments: arrayRemove(commentToRemove) });
                showMsg('댓글이 삭제되었습니다.');
            }
        });
    });

    // 🌟 [추가됨] 관리자 전용 뮤트 버튼 이벤트
    document.querySelectorAll('.mute-user-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const targetUid = e.target.getAttribute('data-uid');
            const days = prompt('몇 일 동안 글쓰기를 차단하시겠습니까? (숫자만 입력)');
            if(days && !isNaN(days)) {
                const unbanDate = new Date();
                unbanDate.setDate(unbanDate.getDate() + parseInt(days));
                await setDoc(doc(db, 'artifacts', appId, 'mutedUsers', targetUid), { mutedUntil: unbanDate.toISOString() });
                showMsg(`해당 사용자가 ${days}일간 차단되었습니다.`, 'success');
            }
        });
    });

    if(window.lucide) window.lucide.createIcons();
};

// 글 등록 (+ 뮤트 체크 및 관리자 체크)
document.getElementById('submit-post-btn').addEventListener('click', async () => {
    if (!currentUser) return;
    const inputEl = document.getElementById('community-post-input');
    const content = inputEl.value.trim();
    if(!content) return showMsg("내용을 입력해주세요!", "error");

    // 🌟 뮤트(차단) 상태인지 확인
    const mutedUntil = await checkMuteStatus(currentUser.uid);
    if(mutedUntil) {
        return showMsg(`차단된 계정입니다. (${mutedUntil.toLocaleDateString()} 해제)`, "error");
    }

    const newPostId = crypto.randomUUID();
    const isUserAdmin = currentUser.email === ADMIN_EMAIL;
    const authorName = isUserAdmin ? "👑 관리자" : getUserNickname(currentUser.uid);

    try {
        await setDoc(doc(db, 'artifacts', appId, 'communityPosts', newPostId), {
            content: content,
            authorId: currentUser.uid,
            authorName: authorName,
            isAdmin: isUserAdmin, // 관리자 여부 저장
            likes: [],
            comments: [],
            createdAt: new Date().toISOString()
        });
        inputEl.value = '';
        showMsg("글이 등록되었습니다!", "success");
    } catch (error) {
        showMsg("글 등록 중 오류가 발생했습니다.", "error");
    }
});

const toggleLike = async (postId) => {
    if (!currentUser) return;
    const postRef = doc(db, 'artifacts', appId, 'communityPosts', postId);
    const post = communityPosts.find(p => p.id === postId);
    if(post.likes && post.likes.includes(currentUser.uid)) await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
    else await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
};

document.getElementById('close-comment-modal-btn').addEventListener('click', () => {
    document.getElementById('comment-modal').classList.add('hidden');
});

// 댓글 등록 (+ 뮤트 체크 및 관리자 체크)
document.getElementById('submit-comment-btn').addEventListener('click', async () => {
    if (!currentUser || !activePostForComment) return;
    const commentInput = document.getElementById('comment-input');
    const text = commentInput.value.trim();
    if(!text) return showMsg("댓글 내용을 입력해주세요.", "error");

    // 🌟 뮤트(차단) 상태인지 확인
    const mutedUntil = await checkMuteStatus(currentUser.uid);
    if(mutedUntil) {
        document.getElementById('comment-modal').classList.add('hidden');
        return showMsg(`차단된 계정입니다. (${mutedUntil.toLocaleDateString()} 해제)`, "error");
    }

    const postRef = doc(db, 'artifacts', appId, 'communityPosts', activePostForComment);
    const isUserAdmin = currentUser.email === ADMIN_EMAIL;
    const authorName = isUserAdmin ? "👑 관리자" : getUserNickname(currentUser.uid);

    const newComment = {
        id: crypto.randomUUID(),
        authorId: currentUser.uid,
        authorName: authorName,
        isAdmin: isUserAdmin, // 관리자 여부 저장
        text: text,
        createdAt: new Date().toISOString()
    };

    try {
        await updateDoc(postRef, { comments: arrayUnion(newComment) });
        document.getElementById('comment-modal').classList.add('hidden');
        showMsg("댓글이 등록되었습니다.", "success");
    } catch (error) { showMsg("댓글 등록 실패", "error"); }
});

// ----------------------------------------------------
// 알람 로직 (기존과 동일)
// ----------------------------------------------------
let myAlarms = []; 
const addAlarmModal = document.getElementById('add-alarm-modal');
const alarmTriggerModal = document.getElementById('alarm-trigger-modal');
let alarmTimerId = null; let lastTriggeredTime = "";

const fetchMyAlarms = (userId) => {
    const alarmsRef = collection(db, 'artifacts', appId, 'users', userId, 'alarms');
    unsubscribeAlarms = onSnapshot(alarmsRef, (snapshot) => {
        myAlarms = []; snapshot.forEach((doc) => { myAlarms.push({ id: doc.id, ...doc.data() }); });
        myAlarms.sort((a, b) => a.time.localeCompare(b.time)); renderAlarmList();
    });
};

const renderAlarmList = () => {
    const listEl = document.getElementById('alarm-list'); listEl.innerHTML = '';
    if(myAlarms.length === 0) listEl.innerHTML = `<div class="text-center py-10 text-slate-400 flex flex-col items-center"><i data-lucide="bell-off" class="w-10 h-10 mb-2 opacity-50"></i><p>등록된 알림이 없습니다.</p></div>`;
    else {
        myAlarms.forEach(alarm => {
            const item = document.createElement('div');
            item.className = "flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm";
            item.innerHTML = `<div class="flex items-center gap-4"><div class="text-2xl font-black text-slate-800 dark:text-white">${alarm.time}</div><div class="font-bold text-slate-600 dark:text-slate-300">${alarm.title}</div></div><button class="delete-alarm-btn text-slate-400 hover:text-red-500 p-2 transition" data-id="${alarm.id}"><i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i></button>`;
            listEl.appendChild(item);
        });
    }
    document.querySelectorAll('.delete-alarm-btn').forEach(btn => { btn.addEventListener('click', async (e) => { if(confirm('삭제할까요?')) { await deleteDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'alarms', e.target.getAttribute('data-id'))); showMsg('삭제되었습니다.'); } }); });
    if(window.lucide) window.lucide.createIcons();
};

document.getElementById('open-add-alarm-btn').addEventListener('click', () => { document.getElementById('alarm-time-input').value = "09:00"; document.getElementById('alarm-title-input').value = ""; addAlarmModal.classList.remove('hidden'); });
document.getElementById('close-alarm-modal-btn').addEventListener('click', () => addAlarmModal.classList.add('hidden'));

document.getElementById('save-alarm-btn').addEventListener('click', async () => {
    const time = document.getElementById('alarm-time-input').value; const title = document.getElementById('alarm-title-input').value.trim();
    if(!time || !title) return showMsg("시간과 이름을 입력해주세요.", "error");
    try { await setDoc(doc(db, 'artifacts', appId, 'users', currentUser.uid, 'alarms', crypto.randomUUID()), { time, title, createdAt: new Date().toISOString() }); showMsg("알림 등록 완료!", "success"); addAlarmModal.classList.add('hidden'); } catch(err) { showMsg("저장 실패", "error"); }
});

const startAlarmChecker = () => {
    if(alarmTimerId) clearInterval(alarmTimerId);
    alarmTimerId = setInterval(() => {
        if(!currentUser || myAlarms.length === 0) return;
        const now = new Date(); const currentHHMM = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
        if(currentHHMM !== lastTriggeredTime) {
            const matchingAlarm = myAlarms.find(a => a.time === currentHHMM);
            if(matchingAlarm) {
                document.getElementById('alarm-trigger-title').innerText = matchingAlarm.title; alarmTriggerModal.classList.remove('hidden');
                lastTriggeredTime = currentHHMM; alarmAudio.currentTime = 0; alarmAudio.play().catch(e => console.log("차단됨:", e));
            }
        }
    }, 10000);
};
const stopAlarmChecker = () => { if(alarmTimerId) clearInterval(alarmTimerId); lastTriggeredTime = ""; };
document.getElementById('dismiss-alarm-btn').addEventListener('click', () => { alarmTriggerModal.classList.add('hidden'); alarmAudio.pause(); });
