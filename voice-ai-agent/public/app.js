const chat = document.querySelector('#chat');
const welcome = document.querySelector('#welcome');
const form = document.querySelector('#chatForm');
const input = document.querySelector('#messageInput');
const sendButton = document.querySelector('#sendButton');
const micButton = document.querySelector('#micButton');
const micIcon = document.querySelector('#micIcon');
const statusText = document.querySelector('#statusText');
const apiStatus = document.querySelector('#apiStatus');
const speakToggle = document.querySelector('#speakToggle');
const stopButton = document.querySelector('#stopButton');
const clearButton = document.querySelector('#clearButton');

let recognition = null;
let isListening = false;
let isBusy = false;

function setStatus(message) {
  statusText.textContent = message;
}

function addMessage(role, text) {
  welcome?.remove();
  const bubble = document.createElement('div');
  bubble.className = `message ${role}`;
  const roleLabel = document.createElement('span');
  roleLabel.className = 'role';
  roleLabel.textContent = role === 'user' ? 'You' : 'AI assistant';
  const content = document.createElement('span');
  content.textContent = text;
  bubble.append(roleLabel, content);
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
}

function speak(text) {
  if (!speakToggle.checked || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.onstart = () => setStatus('AI is speaking…');
  utterance.onend = () => setStatus('Ready when you are.');
  utterance.onerror = () => setStatus('Could not play voice. You can still read the answer.');
  window.speechSynthesis.speak(utterance);
}

async function sendMessage(rawMessage) {
  const message = rawMessage.trim();
  if (!message || isBusy) return;

  addMessage('user', message);
  input.value = '';
  isBusy = true;
  sendButton.disabled = true;
  micButton.disabled = true;
  setStatus('Thinking…');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    addMessage('assistant', data.answer);
    speak(data.answer);
    if (!speakToggle.checked) setStatus('Ready when you are.');
  } catch (error) {
    addMessage('assistant', `Sorry, something went wrong: ${error.message}`);
    setStatus('Request failed. Check the server terminal and API key.');
  } finally {
    isBusy = false;
    sendButton.disabled = false;
    micButton.disabled = false;
    input.focus();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void sendMessage(input.value);
});

function stopListening() {
  if (recognition && isListening) recognition.stop();
}

function startListening() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setStatus('Speech recognition is not supported in this browser. Try a recent Chrome or Edge.');
    return;
  }
  if (isBusy) return;
  if (isListening) {
    stopListening();
    return;
  }

  window.speechSynthesis?.cancel();
  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  let finalTranscript = '';

  recognition.onstart = () => {
    isListening = true;
    micButton.classList.add('listening');
    micIcon.textContent = '⏹️';
    micButton.title = 'Stop listening';
    setStatus('Listening… speak now.');
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += transcript;
      else interimTranscript += transcript;
    }
    input.value = `${finalTranscript} ${interimTranscript}`.trim();
  };

  recognition.onerror = (event) => {
    const messages = {
      'not-allowed': 'Microphone permission was denied. Allow microphone access in your browser.',
      'no-speech': 'I did not hear anything. Please try again.',
      'network': 'Speech recognition network error. Check your connection and try again.'
    };
    setStatus(messages[event.error] || `Speech recognition error: ${event.error}`);
  };

  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove('listening');
    micIcon.textContent = '🎙️';
    micButton.title = 'Speak';
    const transcript = input.value.trim();
    if (transcript) {
      setStatus('Sending what you said…');
      void sendMessage(transcript);
    } else if (statusText.textContent === 'Listening… speak now.') {
      setStatus('Ready when you are.');
    }
  };

  try {
    recognition.start();
  } catch (error) {
    setStatus(`Could not start microphone: ${error.message}`);
  }
}

micButton.addEventListener('click', startListening);
stopButton.addEventListener('click', () => {
  window.speechSynthesis?.cancel();
  setStatus('Speech stopped.');
});
clearButton.addEventListener('click', () => {
  window.speechSynthesis?.cancel();
  stopListening();
  chat.replaceChildren();
  const welcomeNode = document.createElement('div');
  welcomeNode.className = 'welcome';
  welcomeNode.id = 'welcome';
  welcomeNode.innerHTML = '<div class="welcome-icon">🎙️</div><h2>What would you like to talk about?</h2><p>Press the microphone and speak, or type a message below.</p>';
  chat.appendChild(welcomeNode);
  setStatus('Chat cleared. Ready when you are.');
});

async function checkServer() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    if (data.apiKeyConfigured) {
      apiStatus.textContent = 'API configured';
      apiStatus.classList.remove('offline');
    } else {
      apiStatus.textContent = 'API key missing';
      apiStatus.classList.add('offline');
    }
  } catch {
    apiStatus.textContent = 'Server unavailable';
    apiStatus.classList.add('offline');
  }
}

checkServer();
