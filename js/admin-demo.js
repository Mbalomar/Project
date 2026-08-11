// ============================================================================
// Client-side admin demo for the static (GitHub Pages) build.
//
// IMPORTANT — this is a front-end-only demonstration, not a real backend:
// there is no server, no database, and no password hashing. "Login" is a
// hardcoded check in this file, and all project data lives in the visitor's
// own browser (localStorage) — nothing here is shared between visitors or
// persisted anywhere real. It exists to demonstrate the intended admin UX
// (the same screens, forms, and CRUD flow as the full Node.js/Express/SQLite
// version in this repo, which has real authentication and a real database).
// ============================================================================

const DEMO_USERNAME = 'admin';
const DEMO_PASSWORD = 'demo123';
const AUTH_KEY = 'misclub_demo_auth';
const DATA_KEY = 'misclub_demo_projects';
const SETTINGS_KEY = 'misclub_demo_settings';

const SEMESTER_LABELS = {
  historical: 'Historical',
  'fall-2025-2026': 'Fall 2025–2026',
  'spring-2025-2026': 'Spring 2025–2026',
};

function isAuthed() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

function requireAuth() {
  if (!isAuthed()) {
    window.location.href = 'admin-login.html';
  }
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function seedIfEmpty() {
  if (localStorage.getItem(DATA_KEY)) return;
  try {
    const res = await fetch('data.json');
    const data = await res.json();
    localStorage.setItem(DATA_KEY, JSON.stringify(data.projects || []));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings || {}));
  } catch (e) {
    localStorage.setItem(DATA_KEY, JSON.stringify([]));
  }
}

function getProjects() {
  return JSON.parse(localStorage.getItem(DATA_KEY) || '[]');
}

function saveProjects(projects) {
  localStorage.setItem(DATA_KEY, JSON.stringify(projects));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// --- Login page -------------------------------------------------------------
function initLoginPage() {
  if (isAuthed()) {
    window.location.href = 'admin-dashboard.html';
    return;
  }
  const form = document.getElementById('demoLoginForm');
  const errorBox = document.getElementById('loginError');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, '1');
      window.location.href = 'admin-dashboard.html';
    } else {
      errorBox.textContent = 'Invalid username or password. (Demo credentials are shown above.)';
      errorBox.style.display = 'block';
    }
  });
}

// --- Dashboard page -----------------------------------------------------------
let editingId = null;

function renderTable() {
  const projects = getProjects();
  const tbody = document.getElementById('projectsTbody');
  if (!projects.length) {
    tbody.innerHTML = '<tr><td colspan="6">No projects yet. Click "New Project" to add the first one.</td></tr>';
    return;
  }
  tbody.innerHTML = projects
    .slice()
    .reverse()
    .map((p) => `
      <tr>
        <td><a href="project-${p.slug}.html" target="_blank" rel="noopener noreferrer">${escapeHtml(p.title)}</a></td>
        <td>${SEMESTER_LABELS[p.semester] || p.semester}</td>
        <td><span class="status-pill status-${p.status}">${escapeHtml(p.status)}</span></td>
        <td>${p.featured ? 'Yes' : '—'}</td>
        <td>${escapeHtml(p.updated_at || p.created_at || '')}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-outline btn-sm" onclick="openForm('edit', ${p.id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})">Delete</button>
          </div>
        </td>
      </tr>
    `)
    .join('');
}

function openForm(mode, id) {
  editingId = mode === 'edit' ? id : null;
  const projects = getProjects();
  const project = mode === 'edit' ? projects.find((p) => p.id === id) : {};

  document.getElementById('formTitle').textContent = mode === 'edit' ? 'Edit Project' : 'New Project';
  document.getElementById('f_title').value = project.title || '';
  document.getElementById('f_summary').value = project.summary || '';
  document.getElementById('f_description').value = project.description || '';
  document.getElementById('f_semester').value = project.semester || 'fall-2025-2026';
  document.getElementById('f_team_members').value = project.team_members || '';
  document.getElementById('f_advisor').value = project.advisor || '';
  document.getElementById('f_tags').value = project.tags || '';
  document.getElementById('f_github_url').value = project.github_url || '';
  document.getElementById('f_demo_url').value = project.demo_url || '';
  document.getElementById('f_status').value = project.status || 'published';
  document.getElementById('f_featured').checked = !!project.featured;
  document.getElementById('formError').style.display = 'none';

  document.getElementById('modalOverlay').classList.add('open');
}

function closeForm() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function handleSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('f_title').value.trim();
  const summary = document.getElementById('f_summary').value.trim();
  const description = document.getElementById('f_description').value.trim();
  const errorBox = document.getElementById('formError');

  if (title.length < 3 || summary.length < 10 || description.length < 20) {
    errorBox.textContent = 'Title needs 3+ characters, summary 10+, description 20+.';
    errorBox.style.display = 'block';
    return;
  }

  const projects = getProjects();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const payload = {
    title,
    summary,
    description,
    semester: document.getElementById('f_semester').value,
    team_members: document.getElementById('f_team_members').value.trim(),
    advisor: document.getElementById('f_advisor').value.trim(),
    tags: document.getElementById('f_tags').value.trim(),
    github_url: document.getElementById('f_github_url').value.trim(),
    demo_url: document.getElementById('f_demo_url').value.trim(),
    status: document.getElementById('f_status').value,
    featured: document.getElementById('f_featured').checked ? 1 : 0,
    updated_at: now,
  };

  if (editingId) {
    const idx = projects.findIndex((p) => p.id === editingId);
    if (idx > -1) {
      payload.slug = projects[idx].slug; // keep existing slug/URL stable on edit
      projects[idx] = { ...projects[idx], ...payload };
    }
  } else {
    const nextId = projects.reduce((max, p) => Math.max(max, p.id), 0) + 1;
    payload.id = nextId;
    payload.slug = slugify(title) || `project-${nextId}`;
    payload.image_path = '';
    payload.created_at = now;
    projects.push(payload);
  }

  saveProjects(projects);
  closeForm();
  renderTable();
}

function deleteProject(id) {
  if (!window.confirm('Delete this project? (This only affects your local demo copy.)')) return;
  const projects = getProjects().filter((p) => p.id !== id);
  saveProjects(projects);
  renderTable();
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  window.location.href = 'admin-login.html';
}

function resetDemoData() {
  if (!window.confirm('Reset the demo back to the original sample projects? Your local edits will be lost.')) return;
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  seedIfEmpty().then(renderTable);
}

async function initDashboardPage() {
  requireAuth();
  if (!isAuthed()) return;
  await seedIfEmpty();
  renderTable();
  document.getElementById('projectForm').addEventListener('submit', handleSubmit);
}
