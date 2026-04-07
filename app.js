// Firebase SDK 라이브러리 가져오기 (모듈 방식)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// TODO: 본인의 Firebase 프로젝트 설정값으로 변경하세요!
const firebaseConfig = {
  apiKey: "AIzaSyC4oCU2t4qhMKgx0b_T3ry7GnghSkHigdE",
  authDomain: "healthcalendar-56191.firebaseapp.com",
  projectId: "healthcalendar-56191",
  storageBucket: "healthcalendar-56191.firebasestorage.app",
  messagingSenderId: "160289182226",
  appId: "1:160289182226:web:1245cdeac0eddb92193ecb",
  measurementId: "G-P5WF2BJ70W"
};

// 파이어베이스 초기화
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM 요소들 가져오기
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');

// 화면 섹션 요소들
const authSection = document.getElementById('auth-section');
const appContent = document.getElementById('app-content');
const desktopSidebar = document.getElementById('desktop-sidebar');
const bottomNav = document.getElementById('bottom-nav');
const userGreeting = document.getElementById('user-greeting');

// 커스텀 알림창 요소
const messageBox = document.getElementById('message-box');
const messageText = document.getElementById('message-text');

// 알림 띄우는 함수 (alert 대체)
function showMessage(msg, type = 'info') {
    messageText.innerText = msg;
    
    // 기본 스타일 리셋
    messageBox.className = 'absolute top-4 left-1/2 transform -translate-x-1/2 z-50 p-4 text-sm rounded-2xl shadow-lg backdrop-blur-md animate-fade-in transition-all w-11/12 max-w-md text-center';
    
    if (type === 'error') {
        messageBox.classList.add('bg-red-500/90', 'text-white', 'border', 'border-red-400');
    } else if (type === 'success') {
        messageBox.classList.add('bg-emerald-500/90', 'text-white', 'border', 'border-emerald-400');
    } else {
        messageBox.classList.add('bg-blue-600/90', 'text-white', 'border', 'border-blue-400');
    }
    
    messageBox.classList.remove('hidden');
    
    // 3초 뒤 숨김
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 3000);
}

// 1. 회원가입 이벤트
signupBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if(!email || !password) return showMessage("이메일과 비밀번호를 입력해주세요.", "error");

    createUserWithEmailAndPassword(auth, email, password)
        .then(() => showMessage("회원가입 완료! 환영합니다.", "success"))
        .catch((error) => showMessage("회원가입 실패: " + error.message, "error"));
});

// 2. 로그인 이벤트
loginBtn.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    if(!email || !password) return showMessage("이메일과 비밀번호를 입력해주세요.", "error");

    signInWithEmailAndPassword(auth, email, password)
        .then(() => showMessage("로그인 성공!", "success"))
        .catch(() => showMessage("로그인 실패: 이메일이나 비밀번호를 확인해주세요.", "error"));
});

// 3. 로그아웃 이벤트
logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
        showMessage("로그아웃 되었습니다.", "info");
    });
});

// 4. 인증 상태 감지 (로그인 여부에 따라 화면 전환)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // [로그인 됨] 로그인 화면 숨기고 대시보드 켜기
        authSection.classList.add('hidden');
        appContent.classList.remove('hidden');
        
        // 데스크탑: 사이드바 보이기 / 모바일: 하단 네비게이션 보이기
        desktopSidebar.classList.remove('hidden');
        desktopSidebar.classList.add('md:flex');
        
        bottomNav.classList.remove('hidden');
        bottomNav.classList.add('flex'); // 모바일에서만 보이도록 css로 제어됨

        // 인사말 설정
        const username = user.email.split('@')[0];
        userGreeting.innerText = `${username}님`;
    } else {
        // [로그아웃 됨] 대시보드 숨기고 로그인 화면 켜기
        authSection.classList.remove('hidden');
        appContent.classList.add('hidden');
        
        // 사이드바, 네비게이션 숨기기
        desktopSidebar.classList.add('hidden');
        desktopSidebar.classList.remove('md:flex');
        
        bottomNav.classList.add('hidden');
        bottomNav.classList.remove('flex');
        
        // 입력창 초기화
        emailInput.value = '';
        passwordInput.value = '';
    }
});