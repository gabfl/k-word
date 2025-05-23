const MAX_ATTEMPTS = 3;
let korean;
let definition;
let romanizations;
let currentAttempts = 0;
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
  console.log(`Word → ${result.korean}`);
  console.log(`Definition → ${result.definition}`);
  document.getElementById('output').textContent = result.korean;
  document.getElementById('definition').textContent = 'Definition: ' + result.definition;

  romanizations = [
    Aromanize.romanize(result.korean, 'rr-translit').trim(),
    Aromanize.romanize(result.korean).trim(), // rr
    Aromanize.romanize(result.korean, 'skats').trim(),
    Aromanize.romanize(result.korean, 'ebi').trim(),
    Aromanize.romanize(result.korean, 'konsevich').trim(),
  ]
  console.log('Romanizations →', romanizations);

  // Delete input value
  document.getElementById('word-input').value = '';

  // Unlock input
  lockInput(false);

  // Reset attempts
  resetAttempts();

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
 * Sanitize the input by removing leading/trailing whitespace,
 * converting to lowercase, and removing special characters.
 * @param {string} input - The user's input.
 * @returns {string} - The sanitized input.
 */
function sanitizeInput(input) {
  // Remove leading/trailing whitespace
  input = input.trim();

  // Convert to lowercase
  input = input.toLowerCase();

  // Remove special characters
  input = input.replace(/[^a-zA-Z0-9]/g, '');

  return input;
}

/**
 * Check if the answer is correct.
 * @param {string} input - The user's answer.
 * @returns {boolean} - True if the answer is correct, false otherwise.
 */
function checkAnswer(input) {
  // Sanitize the input
  input = sanitizeInput(input);

  console.log('Sanitized input → ', input);
  console.log('Possible answers → ', romanizations);

  // Check if the input matches any of the romanizations
  let isCorrect = romanizations.some(value => value.toLowerCase() === input);

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

    // Update the streak
    handleStreak();

    // Clear the current entry from local storage
    clearCurrentEntry();

    return true;
  } else {
    console.log('Incorrect!');
    showOrHide('play-again', false);
    showOrHide('result-ok', false);
    showOrHide('result-error', true);

    // Increase the attempt count
    recordAttempt();

    if (currentAttempts >= MAX_ATTEMPTS) {
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

      // Clear the current entry from local storage
      clearCurrentEntry();
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
 * Update the current and maximum streaks in local storage.
 * The current streak is incremented by 1.
 * If the current streak exceeds the maximum streak, update the maximum streak.
 */
function updateStreak() {
  let current = parseInt(localStorage.getItem('currentStreak') || '0');
  let max = parseInt(localStorage.getItem('maxStreak') || '0');

  current += 1;
  if (current > max) {
    max = current;
  }

  localStorage.setItem('currentStreak', current);
  localStorage.setItem('maxStreak', max);
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
 * Handle the streak when the user answers correctly.
 * This function updates the streak and renders it on the page.
 */
function handleStreak() {
  updateStreak();
  renderStreaks();
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
  console.log(`Current Streak →  ${current}, Max Streak: ${max}`);
  document.getElementById('currentStreak').textContent = current;
  document.getElementById('maxStreak').textContent = max;
}

/**
 * Update the attempt display on the page.
 * This function updates the DOM element that shows the number of attempts left.
 */
function resetAttempts() {
  console.log('Resetting attempts');
  currentAttempts = 0;
  updateAttemptDisplay();
}

/**
 * Update the attempt display on the page.
 * This function updates the DOM element that shows the number of attempts left.
 */
function recordAttempt() {
  if (currentAttempts < MAX_ATTEMPTS) {
    currentAttempts++;
    updateAttemptDisplay();
    // if (currentAttempts === MAX_ATTEMPTS) {
    //   alert("No attempts left. Try again later.");
    //   // Optionally disable input or show correct answer
    // }
  }
}

/**
 * Update the attempt display on the page.
 * This function updates the DOM element that shows the number of attempts left.
 */
function updateAttemptDisplay() {
  console.log(`Attempt → ${currentAttempts + 1}/${MAX_ATTEMPTS}`);
  document.getElementById('attempt-display').textContent =
    `Attempt ${currentAttempts + 1}/${MAX_ATTEMPTS}`;
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
    console.log('CSV data loaded successfully');
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