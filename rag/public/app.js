const uploadForm = document.querySelector("#upload-form");
const fileInput = document.querySelector("#pdf-file");
const fileLabel = document.querySelector("#file-label");
const uploadButton = document.querySelector("#upload-button");
const uploadStatus = document.querySelector("#upload-status");
const documentList = document.querySelector("#document-list");
const documentCount = document.querySelector("#document-count");
const activeTitle = document.querySelector("#active-title");
const activeSubtitle = document.querySelector("#active-subtitle");
const messages = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const chatForm = document.querySelector("#chat-form");
const questionInput = document.querySelector("#question");
const sendButton = document.querySelector("#send-button");

const documents = [];
let activeDocumentId = null;
let isSending = false;

fileInput.addEventListener("change", () => {
  fileLabel.textContent = fileInput.files[0]?.name || "Choose a PDF file";
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    questionInput.value = button.dataset.question || "";
    resizeTextarea();
    questionInput.focus();
    updateChatControls();
  });
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return setStatus("Choose a PDF first.", "error");
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return setStatus("Only PDF files are supported.", "error");
  }

  const formData = new FormData();
  formData.append("pdf", file);
  uploadButton.disabled = true;
  uploadButton.textContent = "Processing PDF…";
  setStatus("Extracting text, creating chunks, and indexing embeddings. Larger PDFs may take a while.");

  try {
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed.");

    documents.unshift(data.document);
    activeDocumentId = data.document.documentId;
    renderDocuments();
    setActiveDocument(data.document);
    clearMessages();
    setStatus(`Ready: ${data.document.chunkCount} chunks indexed.`, "success");
    fileInput.value = "";
    fileLabel.textContent = "Choose a PDF file";
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = "Upload and process";
  }
});

documentList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-document-id]");
  if (!item) return;
  const document = documents.find((doc) => doc.documentId === item.dataset.documentId);
  if (!document) return;
  activeDocumentId = document.documentId;
  setActiveDocument(document);
  renderDocuments();
  clearMessages();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question || !activeDocumentId || isSending) return;

  appendMessage("user", question);
  questionInput.value = "";
  resizeTextarea();
  isSending = true;
  updateChatControls();
  const typing = appendTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, documentId: activeDocumentId })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Chat request failed.");
    typing.remove();
    appendMessage("assistant", data.answer, data.sources || []);
  } catch (error) {
    typing.remove();
    appendMessage("assistant", `Sorry, something went wrong: ${error.message}`);
  } finally {
    isSending = false;
    updateChatControls();
    questionInput.focus();
  }
});

questionInput.addEventListener("input", () => {
  resizeTextarea();
  updateChatControls();
});
questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

function setStatus(message, type = "") {
  uploadStatus.textContent = message;
  uploadStatus.className = `status ${type}`;
}

function renderDocuments() {
  documentCount.textContent = String(documents.length);
  if (!documents.length) {
    documentList.innerHTML = '<p class="empty-docs">Your PDFs will appear here.</p>';
    return;
  }

  documentList.innerHTML = documents.map((doc) => `
    <button type="button" class="document-item ${doc.documentId === activeDocumentId ? "active" : ""}"
      data-document-id="${escapeAttribute(doc.documentId)}">
      <span class="pdf-icon">PDF</span>
      <span class="document-info">
        <strong title="${escapeAttribute(doc.fileName)}">${escapeHtml(doc.fileName)}</strong>
        <small>${doc.chunkCount} chunks · ${doc.pageCount} pages</small>
      </span>
    </button>
  `).join("");
}

function setActiveDocument(doc) {
  activeTitle.textContent = doc.fileName;
  activeSubtitle.textContent = `${doc.pageCount} pages · ${doc.chunkCount} chunks · answers are scoped to this PDF`;
  questionInput.disabled = false;
  questionInput.placeholder = "Ask anything about this PDF…";
  updateChatControls();
}

function clearMessages() {
  messages.innerHTML = "";
  welcome?.remove();
  const empty = document.createElement("div");
  empty.className = "welcome";
  empty.innerHTML = `
    <div class="welcome-symbol">✳</div>
    <h2>Ask this document.</h2>
    <p>Answers will be generated from relevant passages retrieved from <strong>${escapeHtml(activeTitle.textContent)}</strong>.</p>
    <div class="suggestions">
      <button type="button" class="suggestion" data-question="Summarize this PDF in simple terms.">Summarize this PDF</button>
      <button type="button" class="suggestion" data-question="What are the key points in this document?">Find key points</button>
    </div>`;
  messages.appendChild(empty);
  empty.querySelectorAll(".suggestion").forEach((button) => {
    button.addEventListener("click", () => {
      questionInput.value = button.dataset.question || "";
      resizeTextarea();
      updateChatControls();
      questionInput.focus();
    });
  });
}

function appendMessage(role, text, sources = []) {
  messages.querySelector(".welcome")?.remove();

  const wrapper = document.createElement("article");
  wrapper.className = `message ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "AI";
  const content = document.createElement("div");
  content.className = "message-content";
  const roleLabel = document.createElement("div");
  roleLabel.className = "message-role";
  roleLabel.textContent = role === "user" ? "YOU" : "GEMINI · PDF GROUNDED";
  const body = document.createElement("div");
  body.className = "message-text";
  body.textContent = text;
  content.append(roleLabel, body);

  if (role === "assistant" && sources.length) {
    const details = document.createElement("details");
    details.className = "source-box";
    const summary = document.createElement("summary");
    summary.textContent = `Retrieved sources (${sources.length})`;
    details.appendChild(summary);

    sources.forEach((source) => {
      const item = document.createElement("div");
      item.className = "source";
      const title = document.createElement("div");
      title.className = "source-title";
      const name = document.createElement("span");
      name.textContent = `Source ${source.source} · chunk ${source.chunkIndex}`;
      const score = document.createElement("span");
      score.className = "source-score";
      score.textContent = `score ${source.score}`;
      const excerpt = document.createElement("p");
      excerpt.textContent = source.excerpt;
      title.append(name, score);
      item.append(title, excerpt);
      details.appendChild(item);
    });
    content.appendChild(details);
  }

  wrapper.append(avatar, content);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return wrapper;
}

function appendTyping() {
  const wrapper = appendMessage("assistant", "Searching the selected PDF and preparing an answer…");
  wrapper.querySelector(".message-role").textContent = "GEMINI IS THINKING";
  wrapper.querySelector(".message-text").classList.add("typing");
  return wrapper;
}

function resizeTextarea() {
  questionInput.style.height = "auto";
  questionInput.style.height = `${Math.min(questionInput.scrollHeight, 150)}px`;
}

function updateChatControls() {
  sendButton.disabled = !activeDocumentId || !questionInput.value.trim() || isSending;
  questionInput.disabled = !activeDocumentId || isSending;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function escapeAttribute(value) { return escapeHtml(value); }
