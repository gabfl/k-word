const MAX_ATTEMPTS = 3;
const savedTheme = localStorage.getItem('theme') || 'auto';
let korean;
let definition;
let romanizations;
let currentAttempt;
let csvEntries = [];

/**
 * Load CSV data from a file.
 * This function uses XMLHttpRequest to fetch the CSV file.
 * @returns {Promise} - A promise that resolves with the CSV data as a string.
 * If the request fails, it rejects with an error.
 */
function loadCSV() {
  // Load CSV and store it in a variable
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', './assets/dict.csv', true);
    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`Failed to load CSV: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send();
  });
}

/**
 * Play a new round of the game.
 * This function selects a random entry from the CSV data,
 * displays the Korean word and its definition, and resets the game state.
 * It also handles the input field and attempts.
 */
function play() {
  // Example usage
  const result = getCurrentOrNewEntry();
  // console.log('Word →', result.korean);
  // console.log('Definition →', result.definition);
  document.getElementById('output').textContent = result.korean;
  document.getElementById('definition').textContent = result.definition;

  romanizations = [
    Aromanize.romanize(result.korean, 'rr-translit').trim(),
    Aromanize.romanize(result.korean).trim(), // rr
    Aromanize.romanize(result.korean, 'skats').trim(),
    Aromanize.romanize(result.korean, 'ebi').trim(),
    Aromanize.romanize(result.korean, 'konsevich').trim(),
  ]
  // console.log('Romanizations →', romanizations);

  // Delete input value
  document.getElementById('word-input').value = '';

  // Unlock input
  lockInput(false);

  // Render streaks
  renderStreaks();

  // Hide elements
  correctAnswerShowOrHide(false);
  showOrHide('play-again', false);
  showOrHide('correct-answer', false);
  showOrHide('result-ok', false);
  showOrHide('result-error', false);
  showOrHide('definition', false);
  showOrHide('submit-button', true);
  showOrHide('attempt-display', true);

  korean = result.korean;
  definition = result.definition;
}

/**
 * Parse CSV data into an array of entries.
 * Each entry is an array with the first element being the Korean word
 * and the second element being the English definition.
 * @param {string} csv - The CSV data as a string.
 * @returns {Array} - An array of entries, each entry is an array of [korean, definition].
  * The first element is the Korean word and the second element is the English definition.
  */
function parseCSV(data) {
  return data.trim().split('\n').map(line => {
    const firstCommaIndex = line.indexOf(',');
    if (firstCommaIndex === -1) return [line, ''];

    const korean = line.slice(0, firstCommaIndex);
    let definition = line.slice(firstCommaIndex + 1);

    // Remove leading/trailing whitespace
    definition = definition.trim();

    // Remove leading/trailing quotes
    if (definition.startsWith('"') && definition.endsWith('"')) {
      definition = definition.slice(1, -1);
    }

    // Capitalize the first letter
    definition = definition.charAt(0).toUpperCase() + definition.slice(1);

    return [korean, definition];
  });
}

/**
 * Get the current or new entry from local storage.
 * If an entry is already stored, it returns that entry.
 * Otherwise, it generates a new random entry,
 * stores it in local storage, and returns it.
 * @returns {Object} - The current or new entry.
 */
function getCurrentOrNewEntry() {
  // Check if an entry is already stored
  const stored = localStorage.getItem('currentEntry');

  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // If corrupted, fallback to a new one
      console.warn('Stored entry is invalid JSON, generating new one.');
    }
  }

  // Otherwise, get a new random one
  const newEntry = getRandomEntry(); // should return an object like { korean: ..., definition: ... }
  localStorage.setItem('currentEntry', JSON.stringify(newEntry));
  return newEntry;
}

/**
 * Clear the current entry from local storage.
 * This function is called when the user plays again or when the game is reset.
 * It removes the stored entry from local storage.
 */
function clearCurrentEntry() {
  // Clear the stored entry
  localStorage.removeItem('currentEntry');
}

/**
 * Get a random entry from the CSV data.
 * @param {string} csv - The CSV data as a string.
 */
function getRandomEntry() {
  const index = Math.floor(Math.random() * csvEntries.length);
  const [korean, definition] = csvEntries[index];
  return { korean, definition };
}

/**
 * Sanitize the text by removing leading/trailing whitespace,
 * converting to lowercase, and removing special characters.
 * @param {string} input - Text.
 * @returns {string} - The sanitized text.
 */
function sanitizeText(input) {
  return input
    .trim()
    .toLowerCase()
    // Normalize accents (like ö → o)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Remove most symbols/punctuation but keep letters (including Korean, Cyrillic, etc.)
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Check if the answer is correct.
 * @param {string} input - The user's answer.
 * @returns {boolean} - True if the answer is correct, false otherwise.
 */
function checkAnswer(input) {
  // Sanitize the input
  input = sanitizeText(input);

  console.log('Sanitized input →', input);
  console.log('Possible answers → ', romanizations);

  // Check if the input matches any of the romanizations
  let isCorrect = input !== "" && romanizations.some(value => sanitizeText(value) === input);

  if (isCorrect) {
    console.log('Correct!');
    showOrHide('play-again', true);
    showOrHide('result-ok', true);
    showOrHide('result-error', false);
    showOrHide('correct-answer', false);
    showOrHide('submit-button', false);
    showOrHide('attempt-display', false);
    showOrHide('definition', true);
    lockInput(true);

    // Clear the current entry from local storage
    clearCurrentEntry();

    // Update the statistics
    updateStats(true);

    // Reset attempts
    resetAttempts();

    // Re-render the streak
    renderStreaks();

    return true;
  } else {
    console.log('Incorrect!');
    showOrHide('play-again', false);
    showOrHide('result-ok', false);
    showOrHide('result-error', true);

    if (currentAttempt >= MAX_ATTEMPTS) {
      // Disable the input and show the correct answer
      correctAnswerShowOrHide();
      showOrHide('play-again', true);
      showOrHide('submit-button', false);
      showOrHide('result-error', false);
      showOrHide('attempt-display', false);
      showOrHide('definition', true);
      lockInput(true);

      // Reset current streak
      resetStreak();

      // Reset attempts
      resetAttempts();

      // Clear the current entry from local storage
      clearCurrentEntry();

      // Update the statistics
      updateStats(false);
    } else {
      // Increase the attempt count
      recordAttempt();
    }

    return false;
  }
}

/**
 * Help the user by showing or hiding specific sections of the page.
 * @param {string} section - The section to show or hide.
 * @param {boolean} show - Whether to show or hide the section.
 */
function showOrHide(section, show = true) {
  if (section === 'play-again') {
    document.getElementById('play-again-offer').style.display = show ? 'block' : 'none';
  } else if (section === 'correct-answer') {
    document.getElementById('correct-answer').style.display = show ? 'block' : 'none';
  } else if (section === 'result-ok') {
    document.getElementById('result-ok').style.display = show ? 'block' : 'none';
  } else if (section === 'result-error') {
    document.getElementById('result-error').style.display = show ? 'block' : 'none';
  } else if (section === 'submit-button') {
    document.getElementById('submit-button').style.display = show ? 'block' : 'none';
  } else if (section === 'attempt-display') {
    document.getElementById('attempt-display').style.display = show ? 'block' : 'none';
  } else if (section === 'definition') {
    document.getElementById('definition').style.display = show ? 'block' : 'none';
  }
}

/**
 * Show or hide the correct answer on the page.
 * @param {boolean} show - Whether to show or hide the correct answer.
 */
function correctAnswerShowOrHide(show = true) {
  if (show) {
    document.getElementById('correct-answer-text').textContent = `Correct answer: ${romanizations[0]}`;
    document.getElementById('correct-answer').style.display = 'block';
    document.getElementById('play-again-offer').style.display = 'block';
  } else {
    document.getElementById('correct-answer').style.display = 'none';
  }
}

/**
 * Disable/Enable the input field.
 * @param {boolean} disable - Whether to disable or enable the input field.
 */
function lockInput(disable = true) {
  const inputField = document.getElementById('word-input');
  if (disable) {
    inputField.setAttribute('disabled', 'true');
  } else {
    inputField.removeAttribute('disabled');
  }
}

/**
 * Get the current and maximum streaks from local storage.
 * @returns {Object} - An object containing the current and maximum streaks.
 */
function getStreaks() {
  return {
    current: parseInt(localStorage.getItem('currentStreak') || '0'),
    max: parseInt(localStorage.getItem('maxStreak') || '0'),
  };
}

/**
 * Reset the current streak to 0.
 * This function updates the local storage and renders the streaks on the page.
 */
function resetStreak() {
  localStorage.setItem('currentStreak', '0');
  renderStreaks();
}

/**
 * Render the current and maximum streaks on the page.
 * This function retrieves the streaks from local storage and updates the DOM elements.
 */
function renderStreaks() {
  const { current, max } = getStreaks();
  console.log(`Current Streak → ${current}, Max Streak → ${max}`);
  document.getElementById('currentStreak').textContent = current;
  document.getElementById('maxStreak').textContent = max;
}

/**
 * Update the attempt display on the page.
 * This function updates the DOM element that shows the number of attempts left.
 * @param {number} attempt - The current attempt number.
 */
function recordAttempt() {
  console.log('Record attempt');
  let attempt = parseInt(localStorage.getItem('currentAttempt') || '0');

  if (attempt < 3) {
    attempt++;
    localStorage.setItem('currentAttempt', attempt);
    updateAttemptDisplay(attempt);
  }

  return attempt;
}

/**
 * Update the attempt display on the page.
 * This function updates the DOM element that shows the number of attempts left.
 */
function resetAttempts() {
  console.log('Resetting attempts');
  localStorage.setItem('currentAttempt', 1);
  updateAttemptDisplay(1);
}

/**
 * Update the attempt display on the page.
 * This function updates the DOM element that shows the number of attempts left.
 * @param {number} attempt - The current attempt number.
 */
function updateAttemptDisplay(attempt) {
  currentAttempt = attempt;
  console.log(`Attempt → ${currentAttempt}/${MAX_ATTEMPTS}`);
  document.getElementById('attempt-display').textContent = `Attempt ${currentAttempt}/${MAX_ATTEMPTS}`;
}

/**
 * Apply the selected theme to the page.
 * This function updates the body class and theme attributes based on the selected theme.
 * It also updates the table header class for the streak table.
 * @param {string} theme - The selected theme ('dark', 'light', or 'auto').
 */
function applyTheme(theme) {
  console.log('Theme → ', savedTheme);

  const body = document.body;
  body.classList.remove('light-mode', 'dark-mode'); // Optional: if you had custom classes

  const tableHead = document.querySelector('#streakTable thead');

  if (theme === 'dark') {
    body.setAttribute('data-bs-theme', 'dark');
    body.classList.remove('bg-light');
    body.classList.add('bg-dark', 'text-light');

    // Header of streak table
    tableHead.classList.remove('table-light');
    tableHead.classList.add('table-dark');
  } else if (theme === 'light') {
    body.setAttribute('data-bs-theme', 'light');
    body.classList.remove('bg-dark', 'text-light');
    body.classList.add('bg-light');

    // Header of streak table
    tableHead.classList.remove('table-dark');
    tableHead.classList.add('table-light');
  } else if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const systemTheme = prefersDark ? 'dark' : 'light';
    applyTheme(systemTheme); // Reuse logic for actual mode
  }
}

/**
 * Save the selected theme to local storage and apply it.
 * This function updates the local storage with the selected theme
 * and applies the theme to the page.
 * @param {string} theme - The selected theme ('dark', 'light', or 'auto').
 */
function saveTheme(theme) {
  localStorage.setItem('theme', theme);
  applyTheme(theme);
}

/**
 * Show a welcome modal to the user.
 */
function welcomeModal() {
  const hasDisabledModal = localStorage.getItem('kword-modal-disabled');

  if (!hasDisabledModal) {
    const modal = new bootstrap.Modal(document.getElementById('helpModal'));
    modal.show();
  }

  document.getElementById('dont-show').addEventListener('click', function () {
    localStorage.setItem('kword-modal-disabled', 'true');
  });
}

/**
 * Render the statistics in the modal.
 * This function retrieves the current streak, maximum streak,
 * total attempts, correct answers, and win rate from local storage
 * and updates the DOM elements in the modal.
 */
function renderStatsInModal() {
  const currentStreak = localStorage.getItem('currentStreak') || '0';
  const maxStreak = localStorage.getItem('maxStreak') || '0';
  const total = parseInt(localStorage.getItem('totalAttempts') || '0');
  const correct = parseInt(localStorage.getItem('correctAnswers') || '0');
  const winRate = total > 0 ? ((correct / total) * 100).toFixed(1) + '%' : '0%';

  document.getElementById('modalCurrentStreak').textContent = currentStreak;
  document.getElementById('modalMaxStreak').textContent = maxStreak;
  document.getElementById('modalWinRate').textContent = winRate;
}

/**
 * Update the statistics in local storage.
 * This function increments the total attempts and correct answers
 * if the answer is correct.
 * It also updates the current streak and maximum streak.
 * @param {boolean} isCorrect - Whether the answer is correct or not.
 */
function updateStats(isCorrect) {
  let currentStreak = parseInt(localStorage.getItem('currentStreak') || '0');
  let maxStreak = parseInt(localStorage.getItem('maxStreak') || '0');
  let totalAttempts = parseInt(localStorage.getItem('totalAttempts') || '0');
  let correctAnswers = parseInt(localStorage.getItem('correctAnswers') || '0');

  totalAttempts++;

  if (isCorrect) {
    currentStreak++;
    correctAnswers++;
    if (currentStreak > maxStreak) maxStreak = currentStreak;
  } else {
    currentStreak = 0;
  }

  localStorage.setItem('currentStreak', currentStreak);
  localStorage.setItem('maxStreak', maxStreak);
  localStorage.setItem('totalAttempts', totalAttempts);
  localStorage.setItem('correctAnswers', correctAnswers);
}

/**
 * Reset the statistics event listener.
 * This function adds an event listener to the reset button
 * that confirms the action and resets the statistics in local storage.
 * It also refreshes the modal display and updates the streak display.
 */
function resetStatsEventListener() {
    document.getElementById('resetStatsBtn').addEventListener('click', function () {
    const confirmed = confirm("Are you sure you want to delete all your stats?");
    if (confirmed) {
      localStorage.removeItem('currentStreak');
      localStorage.removeItem('maxStreak');
      localStorage.removeItem('totalAttempts');
      localStorage.removeItem('correctAnswers');

      renderStatsInModal(); // Refresh modal display
      renderStreaks(); // Optional: refresh main UI
    }
  });
}

/**
 * Render the current year on the page.
 * This function retrieves the current year and updates the DOM element.
 */
function renderYear() {
  const year = new Date().getFullYear();
  document.getElementById('year').textContent = year;
}

// load CSV
loadCSV()
  .then(data => {
    // Parse CSV data into entries
    csvEntries = parseCSV(data);
    console.log('Dictionary data loaded successfully');
    play();
    welcomeModal();
  })
  .catch(error => {
    console.error('Error loading CSV:', error);
  });

// Show the current year
renderYear()

// Check result
// if the form is submitted, check the answer
document.getElementById('word-form').addEventListener('submit', function(event) {
  event.preventDefault();
  const word = document.getElementById('word-input').value;
  checkAnswer(word);
});

// Play again
document.getElementById('play-again-form').addEventListener('submit', function(event) {
  event.preventDefault();
  play();
});

// Theme toggle
const selected = document.querySelector(`input[name="themeToggle"][value="${savedTheme}"]`);
if (selected) selected.checked = true;

document.querySelectorAll('input[name="themeToggle"]').forEach(btn => {
  btn.addEventListener('change', (e) => {
    saveTheme(e.target.value);
  });
});

// Re-apply on system theme change if in auto mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (localStorage.getItem('theme') === 'auto') {
    applyTheme('auto');
  }
});

// Initial theme load
applyTheme(savedTheme);

// Stats rendering when modal is shown
const settingsModal = document.getElementById('settingsModal');
settingsModal.addEventListener('show.bs.modal', renderStatsInModal);

// Reset stats event listener
resetStatsEventListener();

// Update attempt display
currentAttempt = parseInt(localStorage.getItem('currentAttempt') || recordAttempt())
updateAttemptDisplay(currentAttempt);
