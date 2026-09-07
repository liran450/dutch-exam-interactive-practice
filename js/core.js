// ======== STORAGE ========
const STORAGE_KEY = 'kns_trainer_v1';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { questionStats: {}, testHistory: [] };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

var appData = loadData();

function getQStats(qId) {
  if (!appData.questionStats[qId]) {
    appData.questionStats[qId] = { correct: 0, wrong: 0, lastSeen: null };
  }
  return appData.questionStats[qId];
}

function recordAnswer(qId, isCorrect) {
  const s = getQStats(qId);
  if (isCorrect) s.correct++;
  else s.wrong++;
  s.lastSeen = Date.now();
  saveData(appData);
}

function getQuestionStatus(qId) {
  const s = appData.questionStats[qId];
  if (!s || (s.correct === 0 && s.wrong === 0)) return 'unseen';
  const total = s.correct + s.wrong;
  const pct = s.correct / total;
  if (pct >= 0.8 && total >= 2) return 'mastered';
  if (pct >= 0.5) return 'learning';
  return 'weak';
}

// ======== VIEW MANAGEMENT ========
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');
  if (viewId === 'home') { renderHome(); }
  if (viewId === 'select') renderSelect();
  if (viewId === 'history') { renderHistory(); }
  if (viewId === 'speak-select') renderSpeakSelect();
}

// ======== UTILS ========
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function confirmQuit() { document.getElementById('quit-modal').classList.add('show'); }
function hideQuitModal() { document.getElementById('quit-modal').classList.remove('show'); }
function doQuit() {
  hideQuitModal();
  if (currentQuiz && currentQuiz.answers.length > 0) finishQuiz();
  else showView('home');
}

function showResetModal() { document.getElementById('reset-modal').classList.add('show'); }
function hideResetModal() { document.getElementById('reset-modal').classList.remove('show'); }
function doReset() {
  hideResetModal();
  appData = { questionStats: {}, testHistory: [] };
  saveData(appData);
  speakData = { questionStats: {}, testHistory: [] };
  saveSpeakData(speakData);
  showView('home');
}

// ======== SECTION TABS ========
function switchSection(section) {
  ['photo', 'qa', 'aanvul'].forEach(s => {
    const tab = document.getElementById('tab-' + s);
    if (tab) tab.classList.toggle('active', section === s);
    const sec = document.getElementById('home-' + s + '-section');
    if (sec) sec.style.display = section === s ? '' : 'none';
  });
  if (section === 'qa') renderSpeakHome('qa');
  if (section === 'aanvul') renderSpeakHome('aanvul');
}

function switchHistorySection(section) {
  ['photo', 'qa', 'aanvul'].forEach(s => {
    const tab = document.getElementById('htab-' + s);
    if (tab) tab.classList.toggle('active', section === s);
    const sec = document.getElementById('history-' + s + '-section');
    if (sec) sec.style.display = section === s ? '' : 'none';
  });
  if (section === 'qa') renderSpeakHistory('qa');
  if (section === 'aanvul') renderSpeakHistory('aanvul');
}

// ======== EXPORT / IMPORT ========
function exportProgress() {
  const bundle = { photo: appData, speaking: speakData };
  const dataStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kns-trainer-voortgang-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerImport() {
  document.getElementById('import-file-input').click();
}

var pendingImportData = null;

function handleImportFile(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    var parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch (err) {
      alert('Dit bestand is geen geldig JSON-bestand.');
      return;
    }
    if (!parsed || typeof parsed !== 'object') {
      alert('Dit bestand bevat geen geldige KNS Trainer voortgang.');
      return;
    }

    var photo = null, speaking = null;
    if (parsed.photo || parsed.speaking) {
      if (parsed.photo && typeof parsed.photo.questionStats === 'object') photo = parsed.photo;
      if (parsed.speaking && typeof parsed.speaking.questionStats === 'object') speaking = parsed.speaking;
    } else if (typeof parsed.questionStats === 'object') {
      photo = parsed;
    }

    if (!photo && !speaking) {
      alert('Dit bestand bevat geen geldige KNS Trainer voortgang.');
      return;
    }

    pendingImportData = {
      photo: photo ? { questionStats: photo.questionStats || {}, testHistory: Array.isArray(photo.testHistory) ? photo.testHistory : [] } : null,
      speaking: speaking ? { questionStats: speaking.questionStats || {}, testHistory: Array.isArray(speaking.testHistory) ? speaking.testHistory : [] } : null
    };

    const qCount = pendingImportData.photo ? Object.keys(pendingImportData.photo.questionStats).length : 0;
    const sCount = pendingImportData.speaking ? Object.keys(pendingImportData.speaking.questionStats).length : 0;
    const tCount = (pendingImportData.photo ? pendingImportData.photo.testHistory.length : 0) +
                   (pendingImportData.speaking ? pendingImportData.speaking.testHistory.length : 0);
    document.getElementById('import-modal-text').textContent =
      `Dit bestand bevat ${qCount} foto-vragen, ${sCount} spreekvragen en ${tCount} testen. Dit vervangt uw huidige voortgang. Dit kan niet ongedaan worden.`;
    document.getElementById('import-modal').classList.add('show');
  };
  reader.onerror = function() {
    alert('Kan het bestand niet lezen.');
  };
  reader.readAsText(file);
}

function hideImportModal() {
  document.getElementById('import-modal').classList.remove('show');
  pendingImportData = null;
}

function doImport() {
  if (!pendingImportData) return;
  if (pendingImportData.photo) {
    appData = pendingImportData.photo;
    saveData(appData);
  }
  if (pendingImportData.speaking) {
    speakData = pendingImportData.speaking;
    saveSpeakData(speakData);
  }
  pendingImportData = null;
  hideImportModal();
  showView('home');
}
