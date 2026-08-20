(() => {
  "use strict";

  const LABELS = ["ক", "খ", "গ", "ঘ"];
  const STORAGE = {
    answers: "islam_mcq_answers_v2",
    bookmarks: "islam_mcq_bookmarks_v2",
    best: "islam_mcq_best_v2",
    theme: "islam_mcq_theme_v2"
  };

  const $ = (selector) => document.querySelector(selector);

  const state = {
    questions: [],
    pool: [],
    index: 0,
    mode: "all",
    attemptAnswers: new Map(),
    bookmarks: new Set(loadJSON(STORAGE.bookmarks, [])),
    savedAnswers: loadJSON(STORAGE.answers, {}),
    best: Number(localStorage.getItem(STORAGE.best) || 0),
    settings: {
      shuffleQuestions: false,
      shuffleOptions: false,
      instantFeedback: true
    },
    autoNextTimer: null
  };

  const el = {
    home: $("#home-screen"),
    quiz: $("#quiz-screen"),
    result: $("#result-screen"),
    total: $("#total-count"),
    answered: $("#answered-count"),
    best: $("#best-score"),
    counter: $("#counter"),
    percent: $("#percent"),
    progress: $("#progress"),
    question: $("#question"),
    options: $("#options"),
    feedback: $("#feedback"),
    previous: $("#prev"),
    next: $("#next"),
    bookmark: $("#bookmark-btn"),
    grid: $("#question-grid"),
    navigator: $("#navigator-toggle"),
    modeBadge: $("#mode-badge"),
    resultScore: $("#result-score"),
    resultPercent: $("#result-percent"),
    resultCorrect: $("#result-correct"),
    resultWrong: $("#result-wrong"),
    resultUnanswered: $("#result-unanswered"),
    theme: $("#theme-btn"),
    reset: $("#reset-progress"),
    homeQuiz: $("#home-from-quiz"),
    homeResult: $("#back-home"),
    retry: $("#retry"),
    wrongOnly: $("#wrong-only"),
    shuffleQuestions: $("#shuffle-questions"),
    shuffleOptions: $("#shuffle-options"),
    instantFeedback: $("#instant-feedback"),
    searchPanel: $("#search-panel"),
    searchInput: $("#search-input"),
    searchResults: $("#search-results"),
    closeSearch: $("#close-search")
  };

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function bn(value) {
    return String(value).replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
  }

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function show(screen) {
    [el.home, el.quiz, el.result].forEach(x => { if (x) x.hidden = true; });
    screen.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function normalizeQuestion(item) {
    return {
      id: String(item.id),
      question: String(item.question ?? "").trim(),
      options: {
        "ক": String(item.options?.["ক"] ?? ""),
        "খ": String(item.options?.["খ"] ?? ""),
        "গ": String(item.options?.["গ"] ?? ""),
        "ঘ": String(item.options?.["ঘ"] ?? "")
      },
      answer: LABELS.includes(item.answer) ? item.answer : null
    };
  }

  async function loadDatabase() {
    const response = await fetch("app.json", { cache: "no-store" });
    if (!response.ok) throw new Error("app.json could not be loaded.");

    const data = await response.json();
    const raw = Array.isArray(data) ? data : data.questions;

    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("No questions found in app.json.");
    }

    state.questions = raw.map(normalizeQuestion).filter(q => q.question);
    el.total.textContent = bn(state.questions.length);
    updateHomeStats();
  }

  function updateHomeStats() {
    const answeredIds = new Set(Object.keys(state.savedAnswers));
    const count = state.questions.filter(q => answeredIds.has(q.id)).length;
    el.answered.textContent = bn(count);
    el.best.textContent = `${bn(state.best)}%`;
  }

  function getWrongQuestions() {
    return state.questions.filter(q => {
      const saved = state.savedAnswers[q.id];
      return saved && q.answer && saved.selected !== q.answer;
    });
  }

  function buildPool(mode) {
    let pool = [...state.questions];

    if (mode === "wrong") pool = getWrongQuestions();
    if (mode === "bookmarks") pool = pool.filter(q => state.bookmarks.has(q.id));
    if (mode === "review") pool = [...state.questions];
    if (mode === "random") pool = shuffle(pool).slice(0, Math.min(20, pool.length));

    if (state.settings.shuffleQuestions && mode !== "random") {
      pool = shuffle(pool);
    }

    return pool;
  }

  function startQuiz(mode) {
    if (state.autoNextTimer) { clearTimeout(state.autoNextTimer); state.autoNextTimer = null; }
    const pool = buildPool(mode);

    if (!pool.length) {
      const message =
        mode === "wrong" ? "এখনো কোনো ভুল প্রশ্ন নেই।" :
        mode === "bookmarks" ? "এখনো কোনো প্রশ্ন bookmark করা হয়নি।" :
        "কোনো প্রশ্ন পাওয়া যায়নি।";
      alert(message);
      return;
    }

    state.mode = mode;
    state.pool = pool;
    state.index = 0;
    state.attemptAnswers = new Map();

    show(el.quiz);
    renderQuestion();
  }

  function currentQuestion() {
    return state.pool[state.index];
  }

  function getModeLabel() {
    return {
      all: "ALL QUIZ",
      random: "RANDOM",
      wrong: "WRONG QUESTIONS",
      bookmarks: "BOOKMARKS",
      review: "REVIEW"
    }[state.mode] || "QUIZ";
  }

  function renderQuestion() {
    const q = currentQuestion();
    if (!q) return;

    const position = state.index + 1;
    const total = state.pool.length;
    const saved = state.attemptAnswers.get(q.id);
    const review = state.mode === "review";

    el.counter.textContent = `প্রশ্ন ${bn(position)} / ${bn(total)}`;
    el.percent.textContent = `${bn(Math.round(position / total * 100))}%`;
    el.progress.style.width = `${position / total * 100}%`;
    el.question.textContent = q.question;
    el.modeBadge.textContent = getModeLabel();
    el.bookmark.textContent = state.bookmarks.has(q.id) ? "★" : "☆";

    let labels = LABELS;
    if (state.settings.shuffleOptions) labels = shuffle(labels);

    el.options.innerHTML = "";

    labels.forEach(label => {
      if (!q.options[label]) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.dataset.option = label;

      const key = document.createElement("span");
      key.className = "option-key";
      key.textContent = label;

      const text = document.createElement("span");
      text.className = "option-text";
      text.textContent = q.options[label];

      button.append(key, text);
      if (!review) button.addEventListener("click", () => selectAnswer(label));
      else button.disabled = true;

      el.options.append(button);
    });

    el.previous.disabled = state.index === 0;
    el.next.textContent = state.index === total - 1 ? "ফলাফল →" : "পরের →";

    if (review) {
      const savedReview = state.savedAnswers[q.id];
      if (savedReview?.selected) paintAnswer(q, savedReview.selected);
      else paintReviewAnswer(q);
    } else if (saved) {
      paintAnswer(q, saved.selected);
    } else {
      el.feedback.hidden = true;
      el.feedback.textContent = "";
      el.feedback.className = "feedback";
    }

    renderNavigator();
  }

  function selectAnswer(label) {
    const q = currentQuestion();
    if (state.autoNextTimer) { clearTimeout(state.autoNextTimer); state.autoNextTimer = null; }
    if (!q || state.attemptAnswers.has(q.id)) return;

    state.attemptAnswers.set(q.id, {
      selected: label,
      correct: q.answer ? label === q.answer : null
    });

    // Save only the latest actual answer for study progress.
    state.savedAnswers[q.id] = { selected: label };
    saveJSON(STORAGE.answers, state.savedAnswers);
    updateHomeStats();

    renderQuestion();

    // Automatically move to the next question exactly 2 seconds after answering.
    state.autoNextTimer = setTimeout(() => {
      state.autoNextTimer = null;
      if (state.index < state.pool.length - 1) {
        state.index++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }, 2000);
  }

  function paintReviewAnswer(q) {
    el.options.querySelectorAll(".option").forEach(button => {
      const option = button.dataset.option;
      button.disabled = true;
      if (q.answer && option === q.answer) button.classList.add("correct");
    });
    el.feedback.hidden = false;
    el.feedback.className = q.answer ? "feedback correct" : "feedback";
    el.feedback.textContent = q.answer
      ? `সঠিক উত্তর: ${q.answer}. ${q.options[q.answer]}`
      : "এই প্রশ্নের answer key database-এ নেই।";
  }

  function paintAnswer(q, selected) {
    el.options.querySelectorAll(".option").forEach(button => {
      const option = button.dataset.option;
      button.disabled = true;

      if (option === selected) button.classList.add("selected");
      if (q.answer && option === q.answer) button.classList.add("correct");
      if (q.answer && option === selected && selected !== q.answer) {
        button.classList.add("wrong");
      }
    });

    if (!state.settings.instantFeedback) {
      el.feedback.hidden = true;
      return;
    }

    el.feedback.hidden = false;

    if (!q.answer) {
      el.feedback.className = "feedback";
      el.feedback.textContent = "এই প্রশ্নের answer key database-এ নেই।";
    } else if (selected === q.answer) {
      el.feedback.className = "feedback correct";
      el.feedback.textContent = "✓ সঠিক উত্তর!";
    } else {
      el.feedback.className = "feedback wrong";
      el.feedback.textContent =
        `✕ ভুল। সঠিক উত্তর: ${q.answer}. ${q.options[q.answer]}`;
    }
  }

  function renderNavigator() {
    el.grid.innerHTML = "";

    state.pool.forEach((q, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "qnum";
      if (i === state.index) button.classList.add("current");
      if (state.attemptAnswers.has(q.id)) button.classList.add("answered");

      button.textContent = bn(i + 1);
      button.addEventListener("click", () => {
        state.index = i;
        renderQuestion();
      });

      el.grid.append(button);
    });
  }

  function finishQuiz() {
    const total = state.pool.length;
    const answered = [...state.attemptAnswers.values()];
    const correct = answered.filter(a => a.correct === true).length;
    const wrong = answered.filter(a => a.correct === false).length;
    const unanswered = total - answered.length;
    const percent = total ? Math.round(correct / total * 100) : 0;

    if (percent > state.best) {
      state.best = percent;
      localStorage.setItem(STORAGE.best, String(percent));
    }

    el.resultScore.textContent = `${bn(correct)} / ${bn(total)}`;
    el.resultPercent.textContent = `${bn(percent)}%`;
    el.resultCorrect.textContent = bn(correct);
    el.resultWrong.textContent = bn(wrong);
    el.resultUnanswered.textContent = bn(unanswered);

    updateHomeStats();
    show(el.result);
  }

  function toggleBookmark() {
    const q = currentQuestion();
    if (!q) return;

    if (state.bookmarks.has(q.id)) state.bookmarks.delete(q.id);
    else state.bookmarks.add(q.id);

    saveJSON(STORAGE.bookmarks, [...state.bookmarks]);
    el.bookmark.textContent = state.bookmarks.has(q.id) ? "★" : "☆";
  }

  function goHome() {
    if (state.autoNextTimer) { clearTimeout(state.autoNextTimer); state.autoNextTimer = null; }
    show(el.home);
    updateHomeStats();
  }

  function retryCurrent() {
    startQuiz(state.mode);
  }

  function retryWrong() {
    startQuiz("wrong");
  }

  function resetProgress() {
    if (!confirm("সব saved progress ও answers মুছে ফেলবে?")) return;

    localStorage.removeItem(STORAGE.answers);
    localStorage.removeItem(STORAGE.bookmarks);
    localStorage.removeItem(STORAGE.best);

    state.savedAnswers = {};
    state.bookmarks.clear();
    state.best = 0;
    state.attemptAnswers.clear();

    updateHomeStats();
  }

  function applyTheme() {
    const theme = localStorage.getItem(STORAGE.theme) || "light";
    document.documentElement.dataset.theme = theme;
    if (el.theme) el.theme.textContent = theme === "dark" ? "☀" : "☾";
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE.theme, next);
    applyTheme();
  }

  function openSearch() {
    if (!el.searchPanel) return;
    el.searchPanel.hidden = false;
    el.searchInput?.focus();
  }

  function closeSearch() {
    if (el.searchPanel) el.searchPanel.hidden = true;
  }

  function runSearch() {
    if (!el.searchResults || !el.searchInput) return;

    const term = el.searchInput.value.trim().toLowerCase();
    el.searchResults.innerHTML = "";

    if (!term) return;

    state.questions
      .filter(q => {
        const haystack = [
          q.question,
          ...Object.values(q.options)
        ].join(" ").toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, 50)
      .forEach(q => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "search-result";
        item.innerHTML = `<b>প্রশ্ন ${bn(q.id)}</b><p></p>`;
        item.querySelector("p").textContent = q.question;

        item.addEventListener("click", () => {
          state.mode = "search";
          state.pool = [q];
          state.index = 0;
          state.attemptAnswers = new Map();
          closeSearch();
          show(el.quiz);
          renderQuestion();
        });

        el.searchResults.append(item);
      });
  }

  function clearAutoNext() {
    if (state.autoNextTimer) {
      clearTimeout(state.autoNextTimer);
      state.autoNextTimer = null;
    }
  }

  function bindEvents() {
    document.querySelectorAll("[data-mode]").forEach(button => {
      button.addEventListener("click", () => startQuiz(button.dataset.mode));
    });

    el.previous?.addEventListener("click", () => {
      clearAutoNext();
      if (state.index > 0) {
        state.index--;
        renderQuestion();
      }
    });

    el.next?.addEventListener("click", () => {
      clearAutoNext();
      if (state.index < state.pool.length - 1) {
        state.index++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    });

    el.bookmark?.addEventListener("click", toggleBookmark);
    el.homeQuiz?.addEventListener("click", goHome);
    el.homeResult?.addEventListener("click", goHome);
    el.retry?.addEventListener("click", retryCurrent);
    el.wrongOnly?.addEventListener("click", retryWrong);
    el.reset?.addEventListener("click", resetProgress);
    el.theme?.addEventListener("click", toggleTheme);

    el.navigator?.addEventListener("click", () => {
      el.grid.hidden = !el.grid.hidden;
    });

    el.shuffleQuestions?.addEventListener("change", e => {
      state.settings.shuffleQuestions = e.target.checked;
    });

    el.shuffleOptions?.addEventListener("change", e => {
      state.settings.shuffleOptions = e.target.checked;
      renderQuestion();
    });

    el.instantFeedback?.addEventListener("change", e => {
      state.settings.instantFeedback = e.target.checked;
      renderQuestion();
    });

    document.querySelectorAll("#search-open, #search-open-home, [data-open-search]").forEach(button => {
      button.addEventListener("click", openSearch);
    });

    el.closeSearch?.addEventListener("click", closeSearch);
    el.searchInput?.addEventListener("input", runSearch);

    document.addEventListener("keydown", e => {
      if (el.quiz.hidden) return;
      if (e.key === "ArrowLeft") el.previous?.click();
      if (e.key === "ArrowRight") el.next?.click();
    });
  }

  async function init() {
    applyTheme();
    bindEvents();

    try {
      await loadDatabase();
    } catch (error) {
      console.error(error);
      alert("app.json লোড হয়নি। চারটি file একই folder-এ আছে কি না দেখো।");
    }
  }

  init();
})();