// ======== SPEAKING STORAGE ========
const SPEAK_STORAGE_KEY = 'kns_speaking_v1';

function loadSpeakData() {
  try {
    const raw = localStorage.getItem(SPEAK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { questionStats: {}, testHistory: [] };
}

function saveSpeakData(data) {
  localStorage.setItem(SPEAK_STORAGE_KEY, JSON.stringify(data));
}

var speakData = loadSpeakData();

function getSpeakQStats(qId) {
  if (!speakData.questionStats[qId]) {
    speakData.questionStats[qId] = { correct: 0, wrong: 0, lastSeen: null };
  }
  return speakData.questionStats[qId];
}

function recordSpeakAnswer(qId, verdict) {
  const s = getSpeakQStats(qId);
  if (verdict === 'correct') s.correct++;
  else s.wrong++;
  s.lastSeen = Date.now();
  saveSpeakData(speakData);
}

function getSpeakQuestionStatus(qId) {
  const s = speakData.questionStats[qId];
  if (!s || (s.correct === 0 && s.wrong === 0)) return 'unseen';
  const total = s.correct + s.wrong;
  const pct = s.correct / total;
  if (pct >= 0.8 && total >= 2) return 'mastered';
  if (pct >= 0.5) return 'learning';
  return 'weak';
}

// ======== SPEAK HOME STATS ========
function renderSpeakHome(type) {
  const stats = computeSpeakOverallStats(type);
  const el = document.getElementById(type + '-home-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="stat-item"><div class="stat-value">${stats.seen}</div><div class="stat-label">Gezien</div></div>
    <div class="stat-item"><div class="stat-value">${stats.mastered}</div><div class="stat-label">Geleerd</div></div>
    <div class="stat-item"><div class="stat-value">${stats.weak}</div><div class="stat-label">Zwak</div></div>
    <div class="stat-item"><div class="stat-value">${stats.avgPct}%</div><div class="stat-label">Gemiddeld</div></div>
  `;
}

function computeSpeakOverallStats(type) {
  const pool = type ? SPEAKING_QUESTIONS.filter(q => q.type === type) : SPEAKING_QUESTIONS;
  var seen = 0, mastered = 0, weak = 0, totalCorrect = 0, totalAttempts = 0;
  pool.forEach(q => {
    const status = getSpeakQuestionStatus(q.id);
    const s = speakData.questionStats[q.id];
    if (s && (s.correct + s.wrong) > 0) {
      seen++;
      totalCorrect += s.correct;
      totalAttempts += s.correct + s.wrong;
    }
    if (status === 'mastered') mastered++;
    if (status === 'weak') weak++;
  });
  const avgPct = totalAttempts > 0 ? Math.round(totalCorrect / totalAttempts * 100) : 0;
  return { seen, mastered, weak, avgPct };
}

// ======== SPEAK MODES ========
function startSpeakMode(mode, type) {
  const pool = type ? SPEAKING_QUESTIONS.filter(q => q.type === type) : SPEAKING_QUESTIONS;
  var questions = [];
  if (mode === 'full') {
    questions = [...pool];
  } else if (mode === 'random30') {
    questions = shuffleArray([...pool]).slice(0, 30);
  } else if (mode === 'smart') {
    questions = getSpeakSmartQuestions(30, type);
  }
  startSpeakQuiz(questions);
}

function getSpeakSmartQuestions(count, type) {
  const filtered = type ? SPEAKING_QUESTIONS.filter(q => q.type === type) : SPEAKING_QUESTIONS;
  const weights = { unseen: 10, weak: 8, learning: 3, mastered: 1 };
  const weighted = filtered.map(q => ({
    question: q,
    weight: weights[getSpeakQuestionStatus(q.id)] || 5
  }));
  const selected = [];
  const pool = [...weighted];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let rand = Math.random() * totalWeight;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].weight;
      if (rand <= 0) { idx = j; break; }
    }
    selected.push(pool[idx].question);
    pool.splice(idx, 1);
  }
  return shuffleArray(selected);
}

// ======== SPEAK SELECT MODE ========
var selectedSpeaking = new Set();
var speakSelectTypeFilter = 'all';

function showSpeakSelect(type) {
  speakSelectTypeFilter = type || 'all';
  showView('speak-select');
}

function renderSpeakSelect() {
  selectedSpeaking = new Set();
  document.querySelectorAll('#speak-select-type-tabs .filter-tab').forEach(t => t.classList.toggle('active', t.dataset.type === speakSelectTypeFilter));
  renderSpeakSelectList();
  updateSpeakSelectCount();
}

function renderSpeakSelectList() {
  const list = document.getElementById('speak-question-list');
  const items = SPEAKING_QUESTIONS.filter(q => speakSelectTypeFilter === 'all' || q.type === speakSelectTypeFilter);
  list.innerHTML = items.map(q => {
    const status = getSpeakQuestionStatus(q.id);
    const label = q.type === 'qa' ? q.id.replace('qa', 'V') : q.id.replace('av', 'A');
    const selectedClass = selectedSpeaking.has(q.id) ? ' selected' : '';
    return `<button class="q-select-btn ${status}${selectedClass}" data-qid="${q.id}" onclick="toggleSpeakSelect('${q.id}', this)">${label}</button>`;
  }).join('');
}

function filterSpeakSelectType(type, btn) {
  speakSelectTypeFilter = type;
  document.querySelectorAll('#speak-select-type-tabs .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderSpeakSelectList();
}

function toggleSpeakSelect(qId, btn) {
  if (selectedSpeaking.has(qId)) {
    selectedSpeaking.delete(qId);
    btn.classList.remove('selected');
  } else {
    selectedSpeaking.add(qId);
    btn.classList.add('selected');
  }
  updateSpeakSelectCount();
}

function selectSpeakAll() {
  const items = SPEAKING_QUESTIONS.filter(q => speakSelectTypeFilter === 'all' || q.type === speakSelectTypeFilter);
  items.forEach(q => selectedSpeaking.add(q.id));
  renderSpeakSelectList();
  updateSpeakSelectCount();
}

function selectSpeakNone() {
  selectedSpeaking.clear();
  renderSpeakSelectList();
  updateSpeakSelectCount();
}

function selectSpeakWeak() {
  selectedSpeaking.clear();
  const pool = SPEAKING_QUESTIONS.filter(q => speakSelectTypeFilter === 'all' || q.type === speakSelectTypeFilter);
  pool.forEach(q => {
    const s = getSpeakQuestionStatus(q.id);
    if (s === 'weak' || s === 'learning') selectedSpeaking.add(q.id);
  });
  renderSpeakSelectList();
  updateSpeakSelectCount();
}

function selectSpeakUnseen() {
  selectedSpeaking.clear();
  const pool = SPEAKING_QUESTIONS.filter(q => speakSelectTypeFilter === 'all' || q.type === speakSelectTypeFilter);
  pool.forEach(q => {
    if (getSpeakQuestionStatus(q.id) === 'unseen') selectedSpeaking.add(q.id);
  });
  renderSpeakSelectList();
  updateSpeakSelectCount();
}

function updateSpeakSelectCount() {
  document.getElementById('speak-select-count').textContent = `${selectedSpeaking.size} geselecteerd`;
  document.getElementById('speak-start-selected-btn').disabled = selectedSpeaking.size === 0;
}

function startSpeakSelected() {
  const selected = [...selectedSpeaking];
  if (selected.length === 0) return;
  const questions = SPEAKING_QUESTIONS.filter(q => selected.includes(q.id));
  startSpeakQuiz(shuffleArray(questions));
}

// ======== SPEAK QUIZ ENGINE ========
var speakQuiz = null;
const recordingSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
var mediaRecorderInstance = null;
var recordedChunks = [];
var recordingState = 'idle';
var recordTimerInterval = null;
var recordStartTime = null;
var currentAudioUrl = null;

// ======== WHISPER (client-side transcription via Transformers.js) ========
const WHISPER_MODEL_ID = 'onnx-community/whisper-base';
const TRANSFORMERS_JS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
var asrPipelinePromise = null;

function getASRPipeline(onProgress) {
  if (!asrPipelinePromise) {
    asrPipelinePromise = import(TRANSFORMERS_JS_URL).then(({ pipeline }) =>
      pipeline('automatic-speech-recognition', WHISPER_MODEL_ID, {
        dtype: 'q8',
        progress_callback: onProgress
      })
    );
  }
  return asrPipelinePromise;
}

async function decodeAudioTo16kMono(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  var audioCtx;
  try {
    audioCtx = new AudioCtx({ sampleRate: 16000 });
  } catch (e) {
    audioCtx = new AudioCtx();
  }
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  const channelData = decoded.getChannelData(0);
  const pcm = decoded.sampleRate === 16000 ? channelData : resampleTo16k(channelData, decoded.sampleRate);
  audioCtx.close();
  return pcm;
}

function resampleTo16k(samples, fromRate) {
  const ratio = fromRate / 16000;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = srcIndex - i0;
    result[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return result;
}

async function transcribeWithWhisper(pcm) {
  const statusEl = document.getElementById('speak-transcribing-text');
  const transcriber = await getASRPipeline((progress) => {
    if (statusEl && progress.status === 'progress' && progress.file) {
      const pct = Math.round(progress.progress || 0);
      statusEl.textContent = `Spraakmodel wordt gedownload (eenmalig, ~75MB)... ${pct}%`;
    }
  });
  if (statusEl) statusEl.textContent = 'Antwoord wordt getranscribeerd...';
  const output = await transcriber(pcm, { language: 'dutch', task: 'transcribe' });
  return (output && output.text) || '';
}

var dutchVoice = null;
function pickDutchVoice() {
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  dutchVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('nl')) || null;
}
if (window.speechSynthesis) {
  pickDutchVoice();
  window.speechSynthesis.onvoiceschanged = pickDutchVoice;
}

function playSpeakQuestion() {
  if (!window.speechSynthesis || !speakQuiz) return;
  window.speechSynthesis.cancel();
  const q = speakQuiz.questions[speakQuiz.index];
  const utterance = new SpeechSynthesisUtterance(q.text);
  utterance.lang = 'nl-NL';
  if (dutchVoice) utterance.voice = dutchVoice;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function startSpeakQuiz(questions) {
  speakQuiz = { questions, index: 0, answers: [] };
  showView('speak-quiz');
  renderSpeakQuestion();
}

function renderSpeakQuestion() {
  const q = speakQuiz.questions[speakQuiz.index];
  const total = speakQuiz.questions.length;
  const idx = speakQuiz.index;

  document.getElementById('speak-progress-text').textContent = `Vraag ${idx + 1} / ${total}`;
  document.getElementById('speak-progress-bar').style.width = `${(idx / total) * 100}%`;
  document.getElementById('speak-q-badge').textContent = q.type === 'qa' ? 'Vraag - Antwoord' : 'Aanvulzin';
  document.getElementById('speak-q-text').textContent = q.text;

  resetRecordingUI();
  playSpeakQuestion();
}

function resetRecordingUI() {
  recordingState = 'idle';
  recordedChunks = [];
  if (currentAudioUrl) { URL.revokeObjectURL(currentAudioUrl); currentAudioUrl = null; }
  document.getElementById('speak-transcript').value = '';
  document.getElementById('speak-typed-answer').value = '';
  const audioEl = document.getElementById('speak-audio-playback');
  audioEl.style.display = 'none';
  audioEl.src = '';

  const recordUi = document.getElementById('speak-record-ui');
  const transcribingUi = document.getElementById('speak-transcribing-ui');
  const transcriptUi = document.getElementById('speak-transcript-ui');
  const notypeUi = document.getElementById('speak-notype-ui');
  transcribingUi.style.display = 'none';

  if (!recordingSupported) {
    recordUi.style.display = 'none';
    transcriptUi.style.display = 'none';
    notypeUi.style.display = 'block';
  } else {
    recordUi.style.display = 'block';
    transcriptUi.style.display = 'none';
    notypeUi.style.display = 'none';
    const btn = document.getElementById('speak-record-btn');
    btn.classList.remove('recording');
    btn.textContent = '🎙️';
    document.getElementById('speak-record-label').textContent = 'Tik om te beginnen met opnemen';
    document.getElementById('speak-record-timer').style.display = 'none';
  }
}

async function toggleRecording() {
  if (recordingState === 'idle') {
    await startRecording();
  } else if (recordingState === 'recording') {
    stopRecording();
  }
}

async function startRecording() {
  recordedChunks = [];

  var stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    alert('Microfoontoegang is geweigerd. Sta microfoongebruik toe in uw browserinstellingen.');
    return;
  }

  mediaRecorderInstance = new MediaRecorder(stream);
  mediaRecorderInstance.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorderInstance.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    handleRecordingStopped();
  };
  mediaRecorderInstance.start();

  recordingState = 'recording';
  recordStartTime = Date.now();
  const btn = document.getElementById('speak-record-btn');
  btn.classList.add('recording');
  btn.textContent = '⏹️';
  document.getElementById('speak-record-label').textContent = 'Tik om te stoppen';
  const timerEl = document.getElementById('speak-record-timer');
  timerEl.style.display = 'block';
  timerEl.textContent = '0:00';
  recordTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    timerEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }, 250);
}

function stopRecording() {
  recordingState = 'transcribing';
  clearInterval(recordTimerInterval);

  document.getElementById('speak-record-ui').style.display = 'none';
  document.getElementById('speak-transcribing-text').textContent = 'Antwoord wordt getranscribeerd...';
  document.getElementById('speak-transcribing-ui').style.display = 'block';

  if (mediaRecorderInstance && mediaRecorderInstance.state !== 'inactive') {
    mediaRecorderInstance.stop();
  }
}

async function handleRecordingStopped() {
  var transcript = '';

  if (recordedChunks.length > 0) {
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    currentAudioUrl = URL.createObjectURL(blob);
    const audioEl = document.getElementById('speak-audio-playback');
    audioEl.src = currentAudioUrl;
    audioEl.style.display = 'block';

    try {
      const pcm = await decodeAudioTo16kMono(blob);
      transcript = await transcribeWithWhisper(pcm);
    } catch (e) {
      console.error('Whisper transcriptie mislukt:', e);
    }
  }

  recordingState = 'recorded';
  document.getElementById('speak-transcribing-ui').style.display = 'none';
  document.getElementById('speak-transcript-ui').style.display = 'block';
  document.getElementById('speak-transcript').value = transcript.trim();
}

function redoRecording() {
  resetRecordingUI();
}

function skipSpeakQuestion() {
  const q = speakQuiz.questions[speakQuiz.index];
  speakQuiz.answers.push({ question: q, transcript: '', skipped: true });
  advanceSpeakQuiz();
}

function submitTypedAnswer() {
  const q = speakQuiz.questions[speakQuiz.index];
  const text = document.getElementById('speak-typed-answer').value.trim();
  speakQuiz.answers.push({ question: q, transcript: text, skipped: text.length === 0 });
  advanceSpeakQuiz();
}

function nextSpeakQuestion() {
  const q = speakQuiz.questions[speakQuiz.index];
  const text = document.getElementById('speak-transcript').value.trim();
  speakQuiz.answers.push({ question: q, transcript: text, skipped: text.length === 0 });
  advanceSpeakQuiz();
}

function advanceSpeakQuiz() {
  speakQuiz.index++;
  if (speakQuiz.index >= speakQuiz.questions.length) {
    finishSpeakQuiz();
  } else {
    renderSpeakQuestion();
  }
}

function confirmSpeakQuit() { document.getElementById('speak-quit-modal').classList.add('show'); }
function hideSpeakQuitModal() { document.getElementById('speak-quit-modal').classList.remove('show'); }
function doSpeakQuit() {
  hideSpeakQuitModal();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (speakQuiz && speakQuiz.answers.length > 0) finishSpeakQuiz();
  else showView('home');
}

// ======== SETTINGS (API KEY / MODEL) ========
function getApiKey() { return localStorage.getItem('kns_speaking_openai_key') || ''; }
function getModel() { return localStorage.getItem('kns_speaking_model') || 'gpt-4o'; }

function openSettings() {
  document.getElementById('settings-api-key').value = getApiKey();
  document.getElementById('settings-model').value = getModel();
  document.getElementById('settings-modal').classList.add('show');
}
function hideSettings() { document.getElementById('settings-modal').classList.remove('show'); }
function saveSettings() {
  const key = document.getElementById('settings-api-key').value.trim();
  const model = document.getElementById('settings-model').value;
  localStorage.setItem('kns_speaking_openai_key', key);
  localStorage.setItem('kns_speaking_model', model);
  hideSettings();
}

// ======== AI GRADING ========
const GRADING_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          verdict: { type: 'string', enum: ['correct', 'partial', 'incorrect'] },
          feedback: { type: 'string' },
          correctedAnswer: { type: 'string' }
        },
        required: ['index', 'verdict', 'feedback', 'correctedAnswer'],
        additionalProperties: false
      }
    }
  },
  required: ['results'],
  additionalProperties: false
};

const GRADING_SYSTEM_PROMPT = 'You are a Dutch-language examiner grading the "Spreken" (speaking) part of the Dutch civic integration exam (Inburgeringsexamen KNS) at A1 level. You will receive a numbered list of exam prompts in Dutch and a candidate\'s spoken answer, transcribed automatically by speech recognition (minor transcription glitches are expected and should not be penalized). For each item, judge whether the answer is an appropriate, understandable response in Dutch at A1 level: does it answer what was asked (or complete the sentence naturally, for "aanvulzinnen" items), and is the grammar/word order roughly appropriate for A1. Be lenient about accent-related transcription artifacts and about which specific words are chosen, as long as the answer is sensible. If a transcript is empty or says "(geen antwoord / overgeslagen)", the verdict is "incorrect" and the feedback should say no answer was given. Write "feedback" in English, 1-3 concise sentences covering what was right, what was wrong, and how to improve. Write "correctedAnswer" as a short, natural, correct Dutch model answer to that specific question. Return your assessment for every item using the given JSON schema.';

const GRADE_CHUNK_SIZE = 25;

async function callAIGrading(items) {
  const apiKey = getApiKey();
  const model = getModel();
  const payload = items.map((a, i) => ({
    index: i,
    type: a.question.type,
    question: a.question.text,
    transcript: a.skipped ? '(geen antwoord / overgeslagen)' : a.transcript
  }));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: GRADING_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'grading',
          strict: true,
          schema: GRADING_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.error && errBody.error.message) message = errBody.error.message;
    } catch (e) {}
    throw new Error(message);
  }

  const data = await response.json();
  const parsed = JSON.parse(data.choices[0].message.content);
  return parsed.results;
}

async function finishSpeakQuiz() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  showView('speak-results');
  document.getElementById('speak-results-loading').style.display = 'block';
  document.getElementById('speak-results-error').style.display = 'none';
  document.getElementById('speak-results-content').style.display = 'none';

  const apiKey = getApiKey();
  if (!apiKey) {
    document.getElementById('speak-results-loading').style.display = 'none';
    document.getElementById('speak-results-error').style.display = 'block';
    document.getElementById('speak-results-error').innerHTML = `
      <div class="error-banner">U hebt nog geen AI-sleutel ingesteld. Ga naar instellingen (⚙️) om uw OpenAI API-sleutel toe te voegen.</div>
      <div style="text-align:center;"><button class="btn btn-primary" onclick="openSettings()">Instellingen openen</button> <button class="btn btn-secondary" onclick="showView('home')">Naar Home</button></div>
    `;
    return;
  }

  const answers = speakQuiz.answers;
  const chunks = [];
  for (let i = 0; i < answers.length; i += GRADE_CHUNK_SIZE) {
    chunks.push(answers.slice(i, i + GRADE_CHUNK_SIZE));
  }

  const allResults = [];
  try {
    for (let c = 0; c < chunks.length; c++) {
      document.getElementById('speak-loading-text').textContent =
        chunks.length > 1 ? `Antwoorden worden geanalyseerd... (${c + 1}/${chunks.length})` : 'Antwoorden worden geanalyseerd door AI...';
      const results = await callAIGrading(chunks[c]);
      results.forEach(r => { allResults[c * GRADE_CHUNK_SIZE + r.index] = r; });
    }
  } catch (err) {
    document.getElementById('speak-results-loading').style.display = 'none';
    document.getElementById('speak-results-error').style.display = 'block';
    document.getElementById('speak-results-error').innerHTML = `
      <div class="error-banner">De AI-analyse is mislukt: ${escapeHtml(err.message)}</div>
      <div style="text-align:center;"><button class="btn btn-primary" onclick="retryGrading()">Probeer opnieuw</button> <button class="btn btn-secondary" onclick="showView('home')">Naar Home</button></div>
    `;
    return;
  }

  renderSpeakResults(answers, allResults);
}

function retryGrading() {
  finishSpeakQuiz();
}

function renderSpeakResults(answers, results) {
  var correctCount = 0, partialCount = 0, incorrectCount = 0;
  var weightedScore = 0;

  answers.forEach((a, i) => {
    const r = results[i] || { verdict: 'incorrect', feedback: 'No result returned.', correctedAnswer: '' };
    recordSpeakAnswer(a.question.id, r.verdict);
    if (r.verdict === 'correct') { correctCount++; weightedScore += 1; }
    else if (r.verdict === 'partial') { partialCount++; weightedScore += 0.5; }
    else { incorrectCount++; }
  });

  const total = answers.length;
  const pct = total > 0 ? Math.round(weightedScore / total * 100) : 0;
  const pass = pct >= 70;

  speakData.testHistory.unshift({
    date: Date.now(),
    total,
    correctCount,
    partialCount,
    incorrectCount,
    pct,
    mode: total === SPEAKING_QUESTIONS.length ? 'Volledig' : `${total} vragen`
  });
  if (speakData.testHistory.length > 50) speakData.testHistory.length = 50;
  saveSpeakData(speakData);

  document.getElementById('speak-results-loading').style.display = 'none';
  document.getElementById('speak-results-content').style.display = 'block';

  const circle = document.getElementById('speak-result-circle');
  circle.className = `score-circle ${pass ? 'pass' : 'fail'}`;
  document.getElementById('speak-result-pct').textContent = `${pct}%`;
  document.getElementById('speak-result-label').textContent = `${correctCount}/${total}`;
  document.getElementById('speak-result-title').textContent = pass ? 'Goed gedaan!' : 'Blijf oefenen';
  document.getElementById('speak-result-sub').textContent =
    `${correctCount} goed, ${partialCount} gedeeltelijk goed, ${incorrectCount} fout van de ${total} vragen.`;

  const reviewHtml = answers.map((a, i) => {
    const r = results[i] || { verdict: 'incorrect', feedback: 'No result returned.', correctedAnswer: '' };
    const q = a.question;
    const verdictLabel = r.verdict === 'correct' ? '✓ Goed' : r.verdict === 'partial' ? '± Deels goed' : '✗ Fout';
    const yourAnswer = a.skipped ? '(overgeslagen)' : a.transcript;
    return `
      <div class="review-item">
        <div class="review-item-body">
          <div class="q-num">${q.type === 'qa' ? 'Vraag-Antwoord' : 'Aanvulzin'} · ${q.id}</div>
          <div class="q-text">${escapeHtml(q.text)}</div>
          <div class="q-your-answer">Uw antwoord: <em>${escapeHtml(yourAnswer)}</em></div>
          <span class="verdict-badge ${r.verdict}">${verdictLabel}</span>
          <div class="q-feedback">${escapeHtml(r.feedback)}</div>
          ${r.correctedAnswer ? `<div class="q-corrected">Voorbeeldantwoord: ${escapeHtml(r.correctedAnswer)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('speak-review-list').innerHTML = reviewHtml;
}

// ======== SPEAK HISTORY ========
function renderSpeakHistory(type) {
  const tabsId = type + '-filter-tabs';
  filterSpeakHistory('all', document.querySelector('#' + tabsId + ' [data-filter="all"]'), type);
  renderSpeakTestHistory(type);

  const pool = SPEAKING_QUESTIONS.filter(q => q.type === type);
  const counts = { all: pool.length, mastered: 0, learning: 0, weak: 0, unseen: 0 };
  pool.forEach(q => { counts[getSpeakQuestionStatus(q.id)]++; });
  document.querySelectorAll('#' + tabsId + ' .filter-tab').forEach(tab => {
    const f = tab.dataset.filter;
    if (f !== 'all') tab.textContent = `${f === 'mastered' ? 'Geleerd' : f === 'learning' ? 'Bezig' : f === 'weak' ? 'Zwak' : 'Niet gezien'} (${counts[f]})`;
    else tab.textContent = `Alles (${pool.length})`;
  });
}

function filterSpeakHistory(filter, btn, type) {
  const tabsId = type + '-filter-tabs';
  document.querySelectorAll('#' + tabsId + ' .filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const pool = SPEAKING_QUESTIONS.filter(q => q.type === type);
  const tbody = document.getElementById(type + '-history-tbody');
  const rows = pool
    .filter(q => filter === 'all' || getSpeakQuestionStatus(q.id) === filter)
    .map(q => {
      const s = speakData.questionStats[q.id] || { correct: 0, wrong: 0 };
      const total = s.correct + s.wrong;
      const pct = total > 0 ? Math.round(s.correct / total * 100) : '-';
      const status = getSpeakQuestionStatus(q.id);
      const dotClass = status === 'mastered' ? 'green' : status === 'learning' ? 'orange' : status === 'weak' ? 'red' : 'gray';
      const statusLabel = status === 'mastered' ? 'Geleerd' : status === 'learning' ? 'Bezig' : status === 'weak' ? 'Zwak' : 'Niet gezien';
      const shortText = q.text.length > 50 ? q.text.substring(0, 47) + '...' : q.text;
      return `<tr>
        <td>${q.id}</td>
        <td title="${escapeHtml(q.text)}">${escapeHtml(shortText)}</td>
        <td>${s.correct}</td>
        <td>${s.wrong}</td>
        <td>${pct === '-' ? '-' : pct + '%'}</td>
        <td><span class="mastery-dot ${dotClass}"></span>${statusLabel}</td>
      </tr>`;
    }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:20px;">Geen vragen in deze categorie</td></tr>';
}

function renderSpeakTestHistory(type) {
  const list = document.getElementById(type + '-test-history-list');
  if (speakData.testHistory.length === 0) {
    list.innerHTML = '<p style="color:var(--gray-400);font-size:13px;">Nog geen tests gemaakt.</p>';
    return;
  }
  list.innerHTML = speakData.testHistory.slice(0, 20).map(t => {
    const d = new Date(t.date);
    const dateStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const pass = t.pct >= 70;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100);font-size:13px;">
      <span>${dateStr} · ${t.mode}</span>
      <span style="font-weight:600;color:${pass ? 'var(--green)' : 'var(--red)'}">${t.correctCount}✓ ${t.partialCount}± ${t.incorrectCount}✗ (${t.pct}%)</span>
    </div>`;
  }).join('');
}
