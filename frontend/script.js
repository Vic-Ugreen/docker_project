const API_URL = 'http://localhost:5000/api';

const authView = document.getElementById('authView');
const dashboardView = document.getElementById('dashboardView');

const authMessageBox = document.getElementById('authMessageBox');
const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const switchAuthModeBtn = document.getElementById('switchAuthModeBtn');
const authTitle = document.getElementById('authTitle');


const registerUsername = document.getElementById('registerUsername');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');

const notesGrid = document.getElementById('notesGrid');
const messageBox = document.getElementById('messageBox');
const welcomeText = document.getElementById('welcomeText');
const completionText = document.getElementById('completionText');
const logoutBtn = document.getElementById('logoutBtn');

const editorOverlay = document.getElementById('editorOverlay');
const editorModal = document.getElementById('editorModal');
const editorForm = document.getElementById('editorForm');
const editorTitle = document.getElementById('editorTitle');
const closeEditorBtn = document.getElementById('closeEditorBtn');
const cancelEditorBtn = document.getElementById('cancelEditorBtn');
const deleteTaskBtn = document.getElementById('deleteTaskBtn');

const editorTaskId = document.getElementById('editorTaskId');
const editorMode = document.getElementById('editorMode');
const editorTaskTitle = document.getElementById('editorTaskTitle');
const editorTaskDescription = document.getElementById('editorTaskDescription');
const editorTaskStatus = document.getElementById('editorTaskStatus');

const NOTE_COLORS = [
  { bg: '#ffe2e2', border: '#ef3a3a' },
  { bg: '#ffe8d6', border: '#f17c2f' },
  { bg: '#deefff', border: '#1993de' },
  { bg: '#e8f7dc', border: '#62a94f' },
  { bg: '#f3e4ff', border: '#a46be0' },
  { bg: '#fff0c9', border: '#d4a130' },
  { bg: '#ffe3f4', border: '#db6daf' }
];

let token = localStorage.getItem('token') || '';
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let tasks = [];
let isRegisterMode = false;
let deletingTaskId = null;

console.log('authMessageBox:', authMessageBox);

function showMessage(message, isError = false) {
  messageBox.innerHTML = `<span class="message-box-text">${escapeHtml(message)}</span>`;
  messageBox.classList.remove('hidden');

}

function hideMessage() {
  messageBox.classList.add('hidden');
  messageBox.innerHTML = '';
}

function showAuthMessage(message, isError = false) {
  authMessageBox.textContent = message;
  authMessageBox.classList.remove('hidden', 'error', 'success');
  authMessageBox.classList.add(isError ? 'error' : 'success');
}

function hideAuthMessage() {
  authMessageBox.classList.add('hidden');
  authMessageBox.classList.remove('error', 'success');
  authMessageBox.textContent = '';
}

function saveAuthData(newToken, user) {
  token = newToken;
  currentUser = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(currentUser));
}

function clearAuthData() {
  token = '';
  currentUser = null;
  tasks = [];
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function setAuthMode(registerMode) {
  isRegisterMode = registerMode;

  if (isRegisterMode) {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    authTitle.textContent = 'Register form';
    switchAuthModeBtn.textContent = 'Login';
  } else {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authTitle.textContent = 'Login form';
    switchAuthModeBtn.textContent = 'Register';
  }
}

function getNoteColor(taskId) {
  const numericId = Number(taskId) || 0;
  return NOTE_COLORS[numericId % NOTE_COLORS.length];
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function updateWelcomeMessage() {
  if (!currentUser) {
    welcomeText.textContent = 'Welcome, username';
    completionText.textContent = "You've completed 0% of your tasks!";
    return;
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.is_done).length;
  const percent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  welcomeText.textContent = `Welcome, ${currentUser.username}`;
  completionText.textContent = `You've completed ${percent}% of your tasks!`;
}

function showDashboard() {
  authView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
}

function showAuth() {
  dashboardView.classList.add('hidden');
  authView.classList.remove('hidden');
}

function renderNotes() {
  notesGrid.innerHTML = '';

  tasks.forEach(task => {
    const color = getNoteColor(task.id);
    const note = document.createElement('article');
    note.className = `note-card ${task.is_done ? 'completed' : ''}`;
    note.dataset.id = task.id;
    note.style.background = color.bg;
    note.style.borderColor = color.border;

    note.innerHTML = `
      <button class="note-menu-btn" type="button" aria-label="Edit note" data-id="${task.id}">
      <span class="note-menu-dots">⋮</span>
      </button>
      ${task.is_done ? '<div class="note-check">✓</div>' : ''}
      <div class="note-title">${escapeHtml(task.title)}</div>
      <div class="note-description">${escapeHtml(task.contents || '')}</div>
      <div class="note-status ${task.is_done ? 'completed-text' : ''}">
        ${task.is_done ? 'Completed' : 'Not completed'}
      </div>
    `;

    notesGrid.appendChild(note);
  });

  const addCard = document.createElement('button');
  addCard.type = 'button';
  addCard.className = 'add-note-card';
  addCard.id = 'addNoteBtn';
  addCard.innerHTML = `
    <div class="add-note-label">Add new note</div>
    <div class="add-note-plus">+</div>
  `;
  addCard.addEventListener('click', createNewNote);
  notesGrid.appendChild(addCard);

  document.querySelectorAll('.note-menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const taskId = btn.dataset.id;
      openEditorForExistingTask(taskId);
    });
  });

  updateWelcomeMessage();
}

function openEditor(task, mode = 'edit') {
  const color = getNoteColor(task.id || Date.now());
  editorOverlay.classList.remove('hidden');
  editorModal.style.background = color.bg;
  editorModal.style.borderColor = `${color.border}55`;

  editorMode.value = mode;
  editorTaskId.value = task.id || '';
  editorTaskTitle.value = task.title || '';
  editorTaskDescription.value = task.contents || '';
  editorTaskStatus.value = String(Boolean(task.is_done));

  if (mode === 'create') {
    editorTitle.textContent = 'Create note';
    deleteTaskBtn.classList.add('hidden');
  } else {
    editorTitle.textContent = 'Edit note';
    deleteTaskBtn.classList.remove('hidden');
  }
}

function closeEditor() {
  editorOverlay.classList.add('hidden');
  deletingTaskId = null;
}

function openEditorForExistingTask(taskId) {
  const task = tasks.find(item => String(item.id) === String(taskId));
  if (!task) return;
  openEditor(task, 'edit');
}

async function fetchTasks() {
  try {
    const response = await fetch(`${API_URL}/tasks`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to load tasks');
    }

    tasks = data;
    renderNotes();
    showDashboard();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function registerUser(event) {
  event.preventDefault();
  hideAuthMessage();

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: registerUsername.value.trim(),
        email: registerEmail.value.trim(),
        password: registerPassword.value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    registerForm.reset();
    showAuthMessage('Registration successful. You can now sign in.');
    setAuthMode(false);
  } catch (error) {
    showAuthMessage(error.message, true);
  }
}

async function loginUser(event) {
  event.preventDefault();
  hideAuthMessage();

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: loginEmail.value.trim(),
        password: loginPassword.value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    saveAuthData(data.token, data.user);
    loginForm.reset();
    await fetchTasks();
    showMessage(`Welcome back, ${data.user.username}!`);
  } catch (error) {
    showAuthMessage(error.message, true);
  }
}

async function createNewNote() {
  hideMessage();

  try {
    const response = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'New note',
        contents: ''
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create note');
    }

    tasks.unshift(data.task);
    renderNotes();
    showMessage('New note created.');
    openEditor(data.task, 'edit');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function saveEditorChanges(event) {
  event.preventDefault();
  hideMessage();

  const mode = editorMode.value;
  const taskId = editorTaskId.value;
  const title = editorTaskTitle.value.trim();
  const contents = editorTaskDescription.value.trim();
  const isDone = editorTaskStatus.value === 'true';

  if (!title) {
    showMessage('Title is required.', true);
    return;
  }

  try {
    if (mode === 'create') {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          contents
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create note');
      }

      tasks.unshift(data.task);
      renderNotes();
      showMessage('Note created successfully.');
      closeEditor();
      return;
    }

    const response = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        contents,
        is_done: isDone
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to save note');
    }

    const index = tasks.findIndex(task => String(task.id) === String(taskId));
    if (index !== -1) {
      tasks[index] = data.task;
    }

    renderNotes();
    showMessage('Note saved successfully.');
    closeEditor();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function deleteCurrentTask() {
  const taskId = editorTaskId.value;
  if (!taskId) return;

  try {
    deletingTaskId = taskId;

    const noteElement = document.querySelector(`.note-card[data-id="${taskId}"]`);
    if (noteElement) {
      noteElement.classList.add('removing');
    }

    setTimeout(async () => {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete note');
      }

      tasks = tasks.filter(task => String(task.id) !== String(taskId));
      renderNotes();
      showMessage('Note deleted successfully.');
      closeEditor();
    }, 240);
  } catch (error) {
    showMessage(error.message, true);
  }
}

function logout() {
  clearAuthData();
  renderNotes();
  closeEditor();
  showAuth();
  setAuthMode(false);
  showMessage('You have been logged out.');
}

switchAuthModeBtn.addEventListener('click', () => {
  setAuthMode(!isRegisterMode);
  hideAuthMessage();
});

registerForm.addEventListener('submit', registerUser);
loginForm.addEventListener('submit', loginUser);
logoutBtn.addEventListener('click', logout);

editorForm.addEventListener('submit', saveEditorChanges);
closeEditorBtn.addEventListener('click', closeEditor);
cancelEditorBtn.addEventListener('click', closeEditor);
deleteTaskBtn.addEventListener('click', deleteCurrentTask);

editorOverlay.addEventListener('click', event => {
  if (event.target === editorOverlay) {
    closeEditor();
  }
});

setAuthMode(false);

if (token && currentUser) {
  fetchTasks();
} else {
  showAuth();
}
