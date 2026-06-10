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

// Safe Storage Helper to handle file:// protocol restrictions in some browsers
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

// --- 3. State Management ---
let memos = [];

const supabaseUrl = 'https://oogaekyovpsvkplsxbak.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZ2Fla3lvdnBzdmtwbHN4YmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODQyMTIsImV4cCI6MjA5NjY2MDIxMn0.-PIo7K7KjjJTIahUzzm2r6z4I0hTdK4kvsO8c0X5hzg';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

async function fetchMemos() {
    try {
        const { data, error } = await supabaseClient
            .from('memos')
            .select('*')
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
            
            const timeStr = memo.timestamp ? `<div class="memo-time"><i class="fa-regular fa-clock"></i> ${formatDate(memo.timestamp)}</div>` : '';
            
            li.innerHTML = `
                <div class="memo-actions">
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

async function addMemo() {
    if (!memoInput) return;
    const content = memoInput.value.trim();
    if (!content) return;

    const newMemo = {
        text: content,
        timestamp: Date.now(),
        completed: false
    };

    try {
        const { data, error } = await supabaseClient
            .from('memos')
            .insert([newMemo])
            .select();
            
        if (error) throw error;
        
        memos.push(data[0] || newMemo);
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
    const memo = memos[index];
    const newCompleted = !memo.completed;
    
    try {
        if (memo.id) {
            const { error } = await supabaseClient
                .from('memos')
                .update({ completed: newCompleted })
                .eq('id', memo.id);
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
    const memo = memos[index];
    
    try {
        if (memo.id) {
            const { error } = await supabaseClient
                .from('memos')
                .delete()
                .eq('id', memo.id);
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
        });
    } else {
        memos.splice(index, 1);
        renderMemos();
    }
}

async function clearAllMemos() {
    if (confirm('모든 메모를 삭제하시겠습니까?')) {
        try {
            const ids = memos.map(m => m.id).filter(id => id);
            if (ids.length > 0) {
                const { error } = await supabaseClient
                    .from('memos')
                    .delete()
                    .in('id', ids);
                if (error) throw error;
            }
            
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
if (memoForm) {
    memoForm.addEventListener('submit', (e) => {
        e.preventDefault();
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

// Initial Render
fetchMemos();
