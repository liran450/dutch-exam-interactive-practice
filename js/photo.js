// ======== PHOTO QUIZ STATE ========
var currentQuiz = null;

// ======== HOME ========
function renderHome() {
  const stats = computeOverallStats();
  document.getElementById('home-stats').innerHTML = `
    <div class="stat-item"><div class="stat-value">${stats.seen}</div><div class="stat-label">Gezien</div></div>
    <div class="stat-item"><div class="stat-value">${stats.mastered}</div><div class="stat-label">Geleerd</div></div>
    <div class="stat-item"><div class="stat-value">${stats.weak}</div><div class="stat-label">Zwak</div></div>
    <div class="stat-item"><div class="stat-value">${stats.avgPct}%</div><div class="stat-label">Gemiddeld</div></div>
  `;
}

function computeOverallStats() {
  var seen = 0, mastered = 0, weak = 0, totalCorrect = 0, totalAttempts = 0;
  ALL_Q.forEach(q => {
    const status = getQuestionStatus(q.id);
    const s = appData.questionStats[q.id];
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

// ======== MODES ========
function startMode(mode) {
  var questions = [];
  if (mode === 'full') {
    questions = [...ALL_Q];
  } else if (mode === 'random30') {
    questions = shuffleArray([...ALL_Q]).slice(0, 30);
  } else if (mode === 'smart') {
    questions = getSmartQuestions(30);
  }
  startQuiz(questions);
}

function getSmartQuestions(count) {
  const weights = { unseen: 10, weak: 8, learning: 3, mastered: 1 };
  const weighted = ALL_Q.map(q => ({
    question: q,
    weight: weights[getQuestionStatus(q.id)] || 5
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

function startSelected() {
  const selected = [...selectedQuestions];
  if (selected.length === 0) return;
  const questions = ALL_Q.filter(q => selected.includes(q.id));
  startQuiz(shuffleArray(questions));
}

// ======== QUIZ ENGINE ========
function startQuiz(questions) {
  currentQuiz = { questions, index: 0, score: 0, answers: [] };
  showView('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = currentQuiz.questions[currentQuiz.index];
  const total = currentQuiz.questions.length;
  const idx = currentQuiz.index;

  document.getElementById('quiz-progress-text').textContent = `Vraag ${idx + 1} / ${total}`;
  document.getElementById('quiz-score-text').textContent = `Score: ${currentQuiz.score}/${idx}`;
  document.getElementById('quiz-progress-bar').style.width = `${(idx / total) * 100}%`;

  document.getElementById('q-image').src = q.image || '';
  document.getElementById('q-image').style.display = q.image ? 'block' : 'none';
  document.getElementById('q-number').textContent = `Vraag ${q.id}`;
  document.getElementById('q-text').textContent = q.text;
  document.getElementById('btn-a-text').textContent = q.a;
  document.getElementById('btn-b-text').textContent = q.b;

  const btnA = document.getElementById('btn-a');
  const btnB = document.getElementById('btn-b');
  btnA.className = 'answer-btn';
  btnB.className = 'answer-btn';
  btnA.disabled = false;
  btnB.disabled = false;

  document.getElementById('feedback-bar').className = 'feedback-bar';
}

function answer(choice) {
  const q = currentQuiz.questions[currentQuiz.index];
  const isCorrect = choice === q.correct;

  recordAnswer(q.id, isCorrect);
  currentQuiz.answers.push({ question: q, userAnswer: choice, correct: isCorrect });
  if (isCorrect) currentQuiz.score++;

  const btnA = document.getElementById('btn-a');
  const btnB = document.getElementById('btn-b');
  btnA.disabled = true;
  btnB.disabled = true;

  if (q.correct === 'A') btnA.classList.add('correct');
  else btnB.classList.add('correct');
  if (!isCorrect) {
    if (choice === 'A') btnA.classList.add('wrong');
    else btnB.classList.add('wrong');
  }

  const fb = document.getElementById('feedback-bar');
  fb.className = `feedback-bar show ${isCorrect ? 'is-correct' : 'is-wrong'}`;
  document.getElementById('feedback-text').textContent = isCorrect ? '✓ Goed!' : '✗ Fout!';

  document.getElementById('quiz-score-text').textContent = `Score: ${currentQuiz.score}/${currentQuiz.index + 1}`;
}

function nextQuestion() {
  currentQuiz.index++;
  if (currentQuiz.index >= currentQuiz.questions.length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
}

function finishQuiz() {
  const total = currentQuiz.questions.length;
  const score = currentQuiz.score;
  const pct = Math.round(score / total * 100);
  const pass = pct >= 70;

  appData.testHistory.unshift({
    date: Date.now(),
    total,
    score,
    pct,
    mode: total === 100 ? 'Volledig' : `${total} vragen`
  });
  if (appData.testHistory.length > 50) appData.testHistory.length = 50;
  saveData(appData);

  const circle = document.getElementById('result-circle');
  circle.className = `score-circle ${pass ? 'pass' : 'fail'}`;
  document.getElementById('result-pct').textContent = `${pct}%`;
  document.getElementById('result-label').textContent = `${score}/${total}`;
  document.getElementById('result-title').textContent = pass ? 'Geslaagd!' : 'Niet geslaagd';
  document.getElementById('result-sub').textContent = `U had ${score} van de ${total} vragen goed.`;

  const wrong = currentQuiz.answers.filter(a => !a.correct);
  document.getElementById('review-wrong-btn').style.display = wrong.length > 0 ? '' : 'none';
  document.getElementById('review-list').style.display = 'none';

  const reviewHtml = wrong.map(a => {
    const q = a.question;
    const userAns = a.userAnswer === 'A' ? q.a : q.b;
    const correctAns = q.correct === 'A' ? q.a : q.b;
    return `
      <div class="review-item">
        ${q.image ? `<img src="${q.image}" alt="Foto vraag ${q.id}">` : ''}
        <div class="review-item-body">
          <div class="q-num">Vraag ${q.id}</div>
          <div class="q-text">${q.text}</div>
          <div class="q-answer wrong">Uw antwoord: ${a.userAnswer}. ${userAns}</div>
          <div class="q-answer right">Juiste antwoord: ${q.correct}. ${correctAns}</div>
        </div>
      </div>
    `;
  }).join('');
  document.getElementById('review-list').innerHTML = reviewHtml;

  showView('results');
}

function toggleReview() {
  const el = document.getElementById('review-list');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ======== SELECT MODE ========
var selectedQuestions = new Set();

function renderSelect() {
  selectedQuestions = new Set();
  const list = document.getElementById('question-list');
  list.innerHTML = ALL_Q.map(q => {
    const status = getQuestionStatus(q.id);
    return `<button class="q-select-btn ${status}" data-qid="${q.id}" onclick="toggleSelect('${q.id}', this)">${q.id}</button>`;
  }).join('');
  updateSelectCount();
}

function toggleSelect(qId, btn) {
  if (selectedQuestions.has(qId)) {
    selectedQuestions.delete(qId);
    btn.classList.remove('selected');
  } else {
    selectedQuestions.add(qId);
    btn.classList.add('selected');
  }
  updateSelectCount();
}

function selectAll() {
  ALL_Q.forEach(q => selectedQuestions.add(q.id));
  document.querySelectorAll('.q-select-btn').forEach(b => b.classList.add('selected'));
  updateSelectCount();
}

function selectNone() {
  selectedQuestions.clear();
  document.querySelectorAll('.q-select-btn').forEach(b => b.classList.remove('selected'));
  updateSelectCount();
}

function selectWeak() {
  selectNone();
  ALL_Q.forEach(q => {
    const s = getQuestionStatus(q.id);
    if (s === 'weak' || s === 'learning') {
      selectedQuestions.add(q.id);
    }
  });
  document.querySelectorAll('.q-select-btn').forEach(b => {
    if (selectedQuestions.has(b.dataset.qid)) b.classList.add('selected');
  });
  updateSelectCount();
}

function selectUnseen() {
  selectNone();
  ALL_Q.forEach(q => {
    if (getQuestionStatus(q.id) === 'unseen') selectedQuestions.add(q.id);
  });
  document.querySelectorAll('.q-select-btn').forEach(b => {
    if (selectedQuestions.has(b.dataset.qid)) b.classList.add('selected');
  });
  updateSelectCount();
}

function updateSelectCount() {
  document.getElementById('select-count').textContent = `${selectedQuestions.size} geselecteerd`;
  document.getElementById('start-selected-btn').disabled = selectedQuestions.size === 0;
}

// ======== HISTORY ========
var currentFilter = 'all';

function renderHistory() {
  filterHistory('all', document.querySelector('[data-filter="all"]'));
  renderTestHistory();

  const counts = { all: 100, mastered: 0, learning: 0, weak: 0, unseen: 0 };
  ALL_Q.forEach(q => { counts[getQuestionStatus(q.id)]++; });
  document.querySelectorAll('.filter-tab').forEach(tab => {
    const f = tab.dataset.filter;
    if (f !== 'all') tab.textContent = `${f === 'mastered' ? 'Geleerd' : f === 'learning' ? 'Bezig' : f === 'weak' ? 'Zwak' : 'Niet gezien'} (${counts[f]})`;
    else tab.textContent = `Alles (100)`;
  });
}

function filterHistory(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const tbody = document.getElementById('history-tbody');
  const rows = ALL_Q
    .filter(q => filter === 'all' || getQuestionStatus(q.id) === filter)
    .map(q => {
      const s = appData.questionStats[q.id] || { correct: 0, wrong: 0 };
      const total = s.correct + s.wrong;
      const pct = total > 0 ? Math.round(s.correct / total * 100) : '-';
      const status = getQuestionStatus(q.id);
      const dotClass = status === 'mastered' ? 'green' : status === 'learning' ? 'orange' : status === 'weak' ? 'red' : 'gray';
      const statusLabel = status === 'mastered' ? 'Geleerd' : status === 'learning' ? 'Bezig' : status === 'weak' ? 'Zwak' : 'Niet gezien';
      const shortText = q.text.length > 50 ? q.text.substring(0, 47) + '...' : q.text;
      return `<tr>
        <td>${q.id}</td>
        <td title="${q.text}">${shortText}</td>
        <td>${s.correct}</td>
        <td>${s.wrong}</td>
        <td>${pct === '-' ? '-' : pct + '%'}</td>
        <td><span class="mastery-dot ${dotClass}"></span>${statusLabel}</td>
      </tr>`;
    }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--gray-400);padding:20px;">Geen vragen in deze categorie</td></tr>';
}

function renderTestHistory() {
  const list = document.getElementById('test-history-list');
  if (appData.testHistory.length === 0) {
    list.innerHTML = '<p style="color:var(--gray-400);font-size:13px;">Nog geen tests gemaakt.</p>';
    return;
  }
  list.innerHTML = appData.testHistory.slice(0, 20).map(t => {
    const d = new Date(t.date);
    const dateStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const pass = t.pct >= 70;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--gray-100);font-size:13px;">
      <span>${dateStr} · ${t.mode}</span>
      <span style="font-weight:600;color:${pass ? 'var(--green)' : 'var(--red)'}">${t.score}/${t.total} (${t.pct}%)</span>
    </div>`;
  }).join('');
}
