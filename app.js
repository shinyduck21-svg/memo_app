// --- 1. Utilities & Security ---
function escapeHTML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const hour = d.getHours();
    const min = String(d.getMinutes()).padStart(2, '0');
    const period = hour >= 12 ? '오후' : '오전';
    const displayHour = String(hour % 12 || 12).padStart(2, '0');
    return `${year}.${month}.${date} ${period} ${displayHour}:${min}`;
}

// Safe Storage Helper
const safeStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn(`LocalStorage getItem failed for key "${key}":`, e);
            return null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn(`LocalStorage setItem failed for key "${key}":`, e);
        }
    }
};

// --- 2. DOM Elements ---
const memoForm = document.getElementById('memoForm');
const memoInput = document.getElementById('memoInput');
const memoList = document.getElementById('memoList');
const memoCount = document.getElementById('memoCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const themeToggle = document.getElementById('themeToggle');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// Auth Elements
const googleLoginBtn = document.getElementById('googleLoginBtn');
const userProfile = document.getElementById('userProfile');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');

// --- 3. State Management ---
let memos = [];
let dragSourceIndex = null;
let currentUser = null;

const supabaseUrl = 'https://oogaekyovpsvkplsxbak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZ2Fla3lvdnBzdmtwbHN4YmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODQyMTIsImV4cCI6MjA5NjY2MDIxMn0.-PIo7K7KjjJTIahUzzm2r6z4I0hTdK4kvsO8c0X5hzg';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// --- Auth Functions ---
async function signInWithGoogle() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });
    if (error) {
        console.error("Login failed:", error.message);
        showToast("로그인에 실패했습니다.");
    }
}

async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error("Logout failed:", error.message);
        showToast("로그아웃에 실패했습니다.");
    } else {
        showToast("로그아웃 되었습니다.");
    }
}

function handleAuthStateChange(session) {
    if (session) {
        currentUser = session.user;
        if (googleLoginBtn) googleLoginBtn.style.display = 'none';
        if (userProfile) userProfile.style.display = 'flex';
        if (userName) userName.textContent = currentUser.user_metadata.full_name || currentUser.email;
        fetchMemos();
    } else {
        currentUser = null;
        if (googleLoginBtn) googleLoginBtn.style.display = 'flex';
        if (userProfile) userProfile.style.display = 'none';
        if (userName) userName.textContent = '';
        memos = [];
        renderMemos();
    }
}

// Check initial session and listen for changes
supabaseClient.auth.onAuthStateChange((event, session) => {
    handleAuthStateChange(session);
});

async function fetchMemos() {
    if (!currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('memos')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: true });
            
        if (error) throw error;
        memos = data || [];
        renderMemos();
    } catch (e) {
        console.error("Failed to fetch memos:", e);
        showToast("메모를 불러오는데 실패했습니다.");
    }
}

// --- 4. UI Actions & Functions ---
let toastTimeout;
function showToast(message) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

function updateThemeIcon(theme) {
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('i');
    if (icon) {
        if (theme === 'light') {
            icon.className = 'fa-solid fa-sun';
        } else {
            icon.className = 'fa-solid fa-moon';
        }
    }
}

function renderMemos() {
    if (!memoList) return;
    memoList.innerHTML = '';
    
    if (!currentUser) {
        memoList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-lock"></i>
                <p>로그인 후 메모를 이용하실 수 있습니다.</p>
            </div>
        `;
        if (clearAllBtn) clearAllBtn.style.display = 'none';
        if (memoCount) memoCount.textContent = '로그인이 필요합니다';
        return;
    }
    
    if (memos.length === 0) {
        memoList.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <p>등록된 메모가 없습니다.</p>
                <p style="font-size: 0.8rem; margin-top: 0.3rem;">첫 메모를 추가해보세요!</p>
            </div>
        `;
        if (clearAllBtn) clearAllBtn.style.display = 'none';
    } else {
        if (clearAllBtn) clearAllBtn.style.display = 'flex';
        memos.forEach((memo, index) => {
            const li = document.createElement('li');
            li.className = `memo-item ${memo.completed ? 'completed' : ''}`;
            li.setAttribute('draggable', true);
            li.dataset.index = index;
            
            // Drag and Drop Events
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragover', handleDragOver);
            li.addEventListener('dragenter', handleDragEnter);
            li.addEventListener('dragleave', handleDragLeave);
            li.addEventListener('drop', handleDrop);
            li.addEventListener('dragend', handleDragEnd);
            
            const timeStr = memo.timestamp ? `<div class="memo-time"><i class="fa-regular fa-clock"></i> ${formatDate(memo.timestamp)}</div>` : '';
            
            li.innerHTML = `
                <div class="memo-actions">
                    <div class="move-btn" title="드래그하여 이동">
                        <i class="fa-solid fa-grip-lines"></i>
                    </div>
                    <button class="check-btn" onclick="toggleMemo(${index})" aria-label="메모 완료/미완료">
                        <i class="${memo.completed ? 'fa-solid fa-check-circle' : 'fa-regular fa-circle'}"></i>
                    </button>
                </div>
                <div class="memo-body">
                    <div class="memo-content">${escapeHTML(memo.text)}</div>
                    ${timeStr}
                </div>
                <div class="memo-actions">
                    <button class="delete-btn" onclick="deleteMemo(${index})" aria-label="메모 삭제">
                        <i class="fa-regular fa-trash-can"></i>
                    </button>
                </div>
            `;
            memoList.appendChild(li);
        });
    }
    
    if (memoCount) memoCount.textContent = `전체 메모: ${memos.length}개`;
}

// --- Drag & Drop Handlers ---
function handleDragStart(e) {
    dragSourceIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSourceIndex);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    
    const targetIndex = parseInt(this.dataset.index);
    
    if (dragSourceIndex !== targetIndex) {
        const movedItem = memos.splice(dragSourceIndex, 1)[0];
        memos.splice(targetIndex, 0, movedItem);
        updateMemosOrder();
        renderMemos();
    }
    return false;
}

function handleDragEnd(e) {
    const items = document.querySelectorAll('.memo-item');
    items.forEach(item => {
        item.classList.remove('dragging');
        item.classList.remove('drag-over');
    });
}

async function updateMemosOrder() {
    if (!currentUser) return;
    const originalTimestamps = [...memos].map(m => m.timestamp).sort((a, b) => a - b);
    
    try {
        const updates = memos.map((memo, idx) => {
            const newTimestamp = originalTimestamps[idx];
            return supabaseClient
                .from('memos')
                .update({ timestamp: newTimestamp })
                .eq('id', memo.id)
                .eq('user_id', currentUser.id);
        });
        
        const results = await Promise.all(updates);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) throw errors[0].error;
        
        showToast('순서가 변경되었습니다.');
    } catch (e) {
        console.error("Error updating order:", e);
        showToast("순서 저장에 실패했습니다.");
    }
}

async function addMemo() {
    if (!memoInput || !currentUser) return;
    const content = memoInput.value.trim();
    if (!content) return;

    const newMemo = {
        text: content,
        timestamp: Date.now(),
        completed: false,
        user_id: currentUser.id
    };

    try {
        const { data, error } = await supabaseClient
            .from('memos')
            .insert([newMemo])
            .select();
            
        if (error) throw error;
        
        if (data && data[0]) {
            memos.push(data[0]);
        } else {
            memos.push(newMemo);
        }
        
        memoInput.value = '';
        renderMemos();
        showToast('메모가 추가되었습니다.');
        memoInput.focus();
    } catch (e) {
        console.error("Error adding memo:", e);
        showToast('메모 추가에 실패했습니다.');
    }
}

async function toggleMemo(index) {
    if (!currentUser) return;
    const memo = memos[index];
    const newCompleted = !memo.completed;
    
    try {
        if (memo.id) {
            const { error } = await supabaseClient
                .from('memos')
                .update({ completed: newCompleted })
                .eq('id', memo.id)
                .eq('user_id', currentUser.id);
            if (error) throw error;
        }
        
        memos[index].completed = newCompleted;
        renderMemos();
    } catch (e) {
        console.error("Error toggling memo:", e);
        showToast("상태 변경에 실패했습니다.");
    }
}

async function deleteMemo(index) {
    if (!currentUser) return;
    const memo = memos[index];
    
    try {
        if (memo.id) {
            const { error } = await supabaseClient
                .from('memos')
                .delete()
                .eq('id', memo.id)
                .eq('user_id', currentUser.id);
            if (error) throw error;
        }
        performUIRemoval(index);
    } catch (e) {
        console.error("Error deleting memo:", e);
        showToast("삭제에 실패했습니다.");
    }
}

function performUIRemoval(index) {
    const items = memoList.querySelectorAll('.memo-item');
    if (items[index]) {
        items[index].classList.add('removing');
        items[index].addEventListener('animationend', () => {
            memos.splice(index, 1);
            renderMemos();
            showToast('메모가 삭제되었습니다.');
        }, { once: true });
    } else {
        memos.splice(index, 1);
        renderMemos();
    }
}

async function clearAllMemos() {
    if (!currentUser) return;
    if (confirm('모든 메모를 삭제하시겠습니까?')) {
        try {
            const { error } = await supabaseClient
                .from('memos')
                .delete()
                .eq('user_id', currentUser.id);
            
            if (error) throw error;
            
            memos = [];
            renderMemos();
            showToast('모든 메모가 삭제되었습니다.');
        } catch(e) {
             console.error("Error clearing memos:", e);
             showToast("삭제에 실패했습니다.");
        }
    }
}

// --- 5. Event Listeners & Initialization ---
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', signInWithGoogle);
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', signOut);
}

if (memoForm) {
    memoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentUser) {
            showToast("로그인이 필요합니다.");
            return;
        }
        addMemo();
    });
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        safeStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        showToast('테마가 변경되었습니다.');
    });
}

// Initialize Theme
const savedTheme = safeStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);
