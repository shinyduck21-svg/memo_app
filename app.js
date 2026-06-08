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
try {
    const stored = safeStorage.getItem('memos');
    if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
            memos = parsed.map(item => {
                if (item === null || item === undefined) return { text: '', timestamp: Date.now(), completed: false };
                if (typeof item === 'object') {
                    return {
                        text: String(item.text || ''),
                        timestamp: item.timestamp || Date.now(),
                        completed: !!item.completed
                    };
                }
                return { text: String(item), timestamp: Date.now(), completed: false };
            });
        }
    }
} catch (e) {
    console.error("Failed to parse stored memos:", e);
    memos = [];
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
    safeStorage.setItem('memos', JSON.stringify(memos));
}

function addMemo() {
    if (!memoInput) return;
    const content = memoInput.value.trim();
    if (!content) return;

    memos.push({
        text: content,
        timestamp: Date.now(),
        completed: false
    });
    memoInput.value = '';
    renderMemos();
    showToast('메모가 추가되었습니다.');
    memoInput.focus();
}

function toggleMemo(index) {
    memos[index].completed = !memos[index].completed;
    renderMemos();
}

function deleteMemo(index) {
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

function clearAllMemos() {
    if (confirm('모든 메모를 삭제하시겠습니까?')) {
        memos = [];
        renderMemos();
        showToast('모든 메모가 삭제되었습니다.');
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
renderMemos();
