let tabs = [];
let activeTabId = null;
let currentTheme = "dark";

// Add this at the start of your JavaScript code
const dbName = "EditorDB";
const dbVersion = 1;
let db;

// Initialize IndexedDB
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("tabs")) {
        db.createObjectStore("tabs", { keyPath: "id" });
      }
    };
  });
}



async function initEditor() {
  try {
    await initDB();

    const transaction = db.transaction(["tabs"], "readonly");
    const store = transaction.objectStore("tabs");

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const savedTabs = request.result;
        if (savedTabs && savedTabs.length > 0) {
          savedTabs.forEach((tabData) => {
            createTab(tabData.name, tabData.content, tabData.id);
          });
          setActiveTab(savedTabs[0].id);
        } else {
          createTab();
        }

        const savedTheme = localStorage.getItem("theme") || "dark";
        setTheme(savedTheme);
        resolve();
      };

      request.onerror = () => {
        console.error("Error loading tabs:", request.error);
        createTab();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("Database initialization failed:", error);
    createTab();
  }
}

function createTab(
  name = "Untitled",
  content = "",
  id = Date.now().toString()
) {
  // Reset preview mode when creating a new tab
  const contentContainer = document.querySelector(".content-container");
  if (contentContainer.classList.contains("preview-mode")) {
    togglePreview(); // Switch back to edit mode
  }

  // Create tab button
  const tabButton = document.createElement("button");
  tabButton.className = "tab";
  tabButton.innerHTML = `<span class="tab-name" data-tab-id="${id}">${name}</span>
    <button class="tab-close" onclick="closeTab('${id}', event)">×</button>`;
  tabButton.onclick = () => setActiveTab(id);
  document.getElementById("tabsContainer").appendChild(tabButton);

  // Create new tab instance
  const tab = new Tab(id, name, content);
  tabs.push({ id, tab, button: tabButton });

  return id;
}

function setActiveTab(id) {
  // Reset preview mode when switching tabs
  const contentContainer = document.querySelector(".content-container");
  if (contentContainer.classList.contains("preview-mode")) {
    togglePreview(); // Switch back to edit mode
  }

  // Deactivate current tab
  if (activeTabId) {
    const currentTab = tabs.find((t) => t.id === activeTabId);
    if (currentTab) {
      currentTab.tab.deactivate();
      currentTab.button.classList.remove("active");
    }
  }

  // Activate new tab
  const newTab = tabs.find((t) => t.id === id);
  if (newTab) {
    newTab.tab.activate();
    newTab.button.classList.add("active");
    activeTabId = id;
  }
}

async function closeTab(id, event) {
  event.stopPropagation();
  if (tabs.length === 1) {
    alert("Cannot close the last tab");
    return;
  }

  const tabIndex = tabs.findIndex((t) => t.id === id);
  if (tabIndex === -1) return;

  // Remove tab from IndexedDB
  const transaction = db.transaction(["tabs"], "readwrite");
  const store = transaction.objectStore("tabs");
  await store.delete(id);

  // Rest of the closeTab function remains the same
  const tab = tabs[tabIndex];
  tab.button.remove();
  tab.tab.editorWrapper.remove();
  tabs.splice(tabIndex, 1);

  if (activeTabId === id) {
    const newTabId = tabs[Math.min(tabIndex, tabs.length - 1)].id;
    setActiveTab(newTabId);
  }
}

function getCurrentTab() {
  return tabs.find((t) => t.id === activeTabId)?.tab;
}

// File operations
function newFile() {
  const id = createTab();
  setActiveTab(id);
}

function saveCurrentFile() {
  const tab = getCurrentTab();
  if (tab) {
    tab.saveToLocalStorage();
    alert("File saved to browser storage");
  }
}

function downloadCurrentFile() {
  const tab = getCurrentTab();
  if (tab) {
    const blob = new Blob([tab.editor.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Add .md extension if not already present
    const fileName = tab.name.endsWith(".md")
      ? tab.name
      : `${tab.name}.md`;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

function openFile(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const id = createTab(file.name, e.target.result);
      setActiveTab(id);
    };
    reader.readAsText(file);
  }
  event.target.value = ""; // Reset file input
}

// Theme switching
function toggleTheme() {
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  currentTheme = theme;
  localStorage.setItem("theme", theme);
}

// Add new function for JSON formatting
function formatJSON() {
  const tab = getCurrentTab();
  if (!tab) return;

  try {
    const content = tab.editor.value.trim();
    if (!content) {
      showError("Editor is empty");
      return;
    }

    // Parse and stringify with indentation
    const parsed = JSON.parse(content);
    const formatted = JSON.stringify(parsed, null, 4);

    // Update editor content
    tab.editor.value = formatted;
    tab.updateLineNumbers();
    tab.saveToLocalStorage();

    // Set cursor position to start
    tab.editor.scrollTop = 0;
    tab.editor.scrollLeft = 0;
  } catch (error) {
    showError("Invalid JSON: " + error.message);
  }
}

// Add error message handling
function showError(message) {
  const errorElement = document.getElementById("errorMessage");
  errorElement.textContent = message;
  errorElement.style.display = "block";

  // Hide after 3 seconds
  setTimeout(() => {
    errorElement.style.display = "none";
  }, 3000);
}

// API Key management
function setAPIKey() {
  const currentKey = localStorage.getItem("anthropic_api_key") || "";
  const apiKey = prompt("Enter your Anthropic API key:", currentKey);
  if (apiKey !== null) {
    localStorage.setItem("anthropic_api_key", apiKey);
    showError("API key saved");
    updateAPIKeyButtonVisibility();
  }
}

function updateAPIKeyButtonVisibility() {
  const apiKeyButton = document.getElementById("apiKeyButton");
  const hasApiKey = !!localStorage.getItem("anthropic_api_key");
  apiKeyButton.style.display = hasApiKey ? "none" : "inline-block";
}

// Add context menu for Improve Text button to change API key
document.addEventListener("DOMContentLoaded", () => {
  const improveButton = document.querySelector(".improve-text");
  improveButton.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    setAPIKey();
  });
  updateAPIKeyButtonVisibility();
});

async function improveSelectedText() {
  const tab = getCurrentTab();
  if (!tab) return;

  const apiKey = localStorage.getItem("anthropic_api_key");
  if (!apiKey) {
    showError("Please set your API key first");
    return;
  }

  // Get selected text
  const start = tab.editor.selectionStart;
  const end = tab.editor.selectionEnd;
  const selectedText = tab.editor.value.substring(start, end);

  if (!selectedText) {
    showError("Please select some text to improve");
    return;
  }

  try {
    const response = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "You are an expert in writing and grammar, tasked with improving the clarity and correctness of a given text. Your goal is to rewrite the provided text, making it grammatically correct and well-formatted while preserving its original meaning.\n\nHere is the text to rewrite:\n\n<text_to_rewrite>\n" +
                    selectedText +
                    "\n</text_to_rewrite>\n\nPlease follow these steps to improve the text:\n\n1. Read and analyze the provided text carefully.\n\n2. In your internal analysis, consider the following aspects:\n   - Spelling mistakes\n   - Punctuation errors\n   - Verb tense issues\n   - Word choice problems\n   - Other grammatical mistakes\n   - Formatting needs (e.g., paragraphs, bullet points)\n   - Tone and style of the original text\n\n3. List out specific examples of errors found in the text.\n\n4. Plan your approach for rewriting the text, including any necessary reorganization.\n\n5. Create a brief outline of the rewritten text.\n\n6. Rewrite the text, making the necessary corrections and improvements. Ensure that you:\n   - Correct all spelling, punctuation, and grammatical errors\n   - Improve clarity and readability\n   - Use appropriate formatting, including paragraphs and bullet points where needed\n   - Preserve the original meaning of the text\n   - Maintain the original tone and style as much as possible\n\n7. Review your rewritten version to ensure it accurately reflects the content and intent of the original text.\n\n8. Present only the final, improved text in your response. Do not include any commentary, explanations, or notes about the changes made.",
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "API request failed");
    }

    const data = await response.json();
    const improvedText = data.content[0].text
      .replace(/^"/, "") // Remove leading quote if present
      .replace(/"$/, "") // Remove trailing quote if present
      .replace(/^Here'?s the improved text:?\s*/i, "") // Remove "Here's the improved text:" prefix
      .trim(); // Remove any extra whitespace

    try {
      await navigator.clipboard.writeText(improvedText);
      showError("Improved text copied to clipboard!");
    } catch (clipboardError) {
      showError("Failed to copy to clipboard: " + clipboardError.message);
    }

    // Insert improved text below the selection with a separator
    const before = tab.editor.value.substring(0, end);
    const after = tab.editor.value.substring(end);
    tab.editor.value =
      before + "\n\n---\n" + improvedText + "\n---\n\n" + after;

    // Update editor state
    tab.updateLineNumbers();
    tab.saveToLocalStorage();
    showError("Text improved successfully");
  } catch (error) {
    showError("API Error: " + error.message);
  }
}

function convertTimestamp() {
  const tab = getCurrentTab();
  if (!tab) return;

  // Get selected text
  const start = tab.editor.selectionStart;
  const end = tab.editor.selectionEnd;
  const selectedText = tab.editor.value.substring(start, end).trim();

  if (!selectedText) {
    showError("Please select a timestamp to convert");
    return;
  }

  try {
    const timestamp = parseInt(selectedText);
    if (isNaN(timestamp)) throw new Error("Invalid timestamp");

    // Detect format (milliseconds or seconds) based on length
    const format =
      timestamp.toString().length === 13 ? "milliseconds" : "seconds";
    const ms = format === "seconds" ? timestamp * 1000 : timestamp;
    const date = new Date(ms);

    if (date.toString() === "Invalid Date")
      throw new Error("Invalid timestamp");

    // Create formatted result
    const result = `\n\n---\nFormat: ${format}\nUTC: ${date.toUTCString()}\nLocal: ${date.toString()}\n---\n\n`;

    // Insert result after the selected timestamp
    const before = tab.editor.value.substring(0, end);
    const after = tab.editor.value.substring(end);
    tab.editor.value = before + result + after;

    // Update editor state
    tab.updateLineNumbers();
    tab.saveToLocalStorage();
  } catch (error) {
    showError("Invalid timestamp format");
    const convertButton = document.querySelector(".convert-timestamp");
    convertButton.classList.add("error");
    setTimeout(() => {
      convertButton.classList.remove("error");
    }, 2000);
  }
}

/* Add keyboard shortcuts handler for Ctrl + W and Escape to clear Text
document.addEventListener("keydown", (e) => {
  // Ctrl+W to close current tab
  if (e.ctrlKey && e.key === "w") {
    e.preventDefault();
    if (activeTabId) {
      closeTab(activeTabId, new Event("dummy"));
    }
  }

  // Escape to clear editor content
  if (e.key === "Escape") {
    const tab = getCurrentTab();
    if (tab) {
      tab.editor.value = "";
      tab.updateLineNumbers();
      tab.saveToLocalStorage();
    }
  }
}); 
*/

// Add double-click handler for new tab creation
document
  .querySelector(".tabs-container")
  .addEventListener("dblclick", (e) => {
    // Only create new tab if clicking on the tabs container itself, not on existing tabs
    if (e.target === document.querySelector(".tabs-container")) {
      newFile();
    }
  });

// Add word wrap toggle function
function toggleWordWrap() {
  const wordWrap = localStorage.getItem("wordWrap") === "true";
  const newWordWrap = !wordWrap;
  localStorage.setItem("wordWrap", newWordWrap);

  // Apply to all tabs
  tabs.forEach((tab) => {
    if (newWordWrap) {
      tab.tab.editor.classList.add("word-wrap");
    } else {
      tab.tab.editor.classList.remove("word-wrap");
    }
  });

  // Show feedback
  showError(newWordWrap ? "Word wrap enabled" : "Word wrap disabled");
}

function togglePreview() {
  const contentContainer = document.querySelector(".content-container");
  const previewPanel = document.getElementById("previewPanel");
  const isPreviewMode = contentContainer.classList.toggle("preview-mode");
  const previewButton = document.querySelector(
    '[title="Toggle Preview"]'
  );

  if (isPreviewMode) {
    updatePreview();
    previewButton.innerHTML = `
                  <svg viewBox="0 0 24 24">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>`;
    previewButton.title = "Edit Mode";
  } else {
    previewButton.innerHTML = `
                  <svg viewBox="0 0 24 24">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>`;
    previewButton.title = "Toggle Preview";
  }
}
function updatePreview() {
  const tab = getCurrentTab();
  if (!tab) return;

  const markdown = tab.editor.value;
  const html = convertMarkdownToHtml(markdown);
  document.getElementById("previewPanel").innerHTML = html;
}

function convertMarkdownToHtml(markdown) {
  // First, process the markdown line by line to handle nested lists
  let lines = markdown.split("\n");
  let inList = false;
  let listType = null; // 'ul' or 'ol'
  let listStack = [];
  let processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)/);

    if (match) {
      // This is a list item
      let [, indent, bullet, content] = match;
      let indentLevel = Math.floor(indent.length / 2);
      let isOrdered = /^\d+\./.test(bullet);
      let currentListType = isOrdered ? "ol" : "ul";

      if (!inList) {
        // Start a new list
        inList = true;
        listType = currentListType;
        listStack = [listType];
        processedLines.push(`<${listType}>`);
      }

      // Handle indent level changes
      while (listStack.length - 1 > indentLevel) {
        processedLines.push(`</li></${listStack.pop()}>`);
      }

      while (listStack.length - 1 < indentLevel) {
        let newListType = currentListType;
        processedLines[processedLines.length - 1] += `<${newListType}>`;
        listStack.push(newListType);
      }

      if (
        listStack[listStack.length - 1] !== currentListType &&
        indentLevel > 0
      ) {
        processedLines[
          processedLines.length - 1
        ] += `<${currentListType}>`;
        listStack[listStack.length - 1] = currentListType;
      }

      processedLines.push(`<li>${content}`);
    } else {
      // Not a list item
      if (inList) {
        // Close all open lists
        while (listStack.length > 0) {
          processedLines.push(`</li></${listStack.pop()}>`);
        }
        inList = false;
      }
      processedLines.push(line);
    }
  }

  // Close any remaining open lists
  if (inList) {
    while (listStack.length > 0) {
      processedLines.push(`</li></${listStack.pop()}>`);
    }
  }

  let html = processedLines
    .join("\n")
    // Headers
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^#### (.*$)/gm, "<h4>$1</h4>")
    .replace(/^##### (.*$)/gm, "<h5>$1</h5>")
    .replace(/^###### (.*$)/gm, "<h6>$1</h6>")

    // Bold and Italic
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<em>$1</em>")

    // Code blocks
    .replace(/```([^`]+)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")

    // Process lists with proper nesting
    .replace(
      /@(\d+)@[-*+]\s+(.*?)(?=(\n|$))/g,
      (match, level, content) => {
        const indent = "  ".repeat(parseInt(level));
        return `${indent}<li>${content}</li>`;
      }
    )
    .replace(
      /@(\d+)@(\d+)\.\s+(.*?)(?=(\n|$))/g,
      (match, level, num, content) => {
        const indent = "  ".repeat(parseInt(level));
        return `${indent}<li>${content}</li>`;
      }
    )

    // Wrap lists in proper ul/ol tags
    .replace(/(<li>.*?<\/li>(\n|$))+/g, (match) => {
      const isOrdered = /\d+\.\s/.test(match);
      return `<${isOrdered ? "ol" : "ul"}>${match}</${isOrdered ? "ol" : "ul"
        }>`;
    })

    // Links - Handle both markdown links and plain URLs
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank">$1</a>'
    )
    .replace(
      /(?<!["'=])(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
      '<a href="$1" target="_blank">$1</a>'
    )

    // Images
    .replace(/!\[([^\]]+)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')

    // Blockquotes
    .replace(/^\> (.*$)/gm, "<blockquote>$1</blockquote>")

    // Horizontal rules
    .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "<hr>")

    // Paragraphs
    .replace(
      /^(?!<[^>]+>)((?:[^<]|<(?!\/?(h[1-6]|ul|ol|li|blockquote|pre|code)>))+)$/gm,
      "<p>$1</p>"
    );

  // Clean up list nesting
  html = html
    .replace(/<\/ul>\s*<ul>/g, "")
    .replace(/<\/ol>\s*<ol>/g, "")
    // Fix any remaining list markers
    .replace(/@\d+@/g, "");

  // Handle task lists
  html = html.replace(/\[ \]/g, "☐").replace(/\[x\]/g, "☒");

  return html;
}

// Add to your initialization code
document.addEventListener('DOMContentLoaded', () => {
  initEditor().then(() => {
      initOutlinePanel();
  });
});

// // Add focus mode toggle button
// const focusModeBtn = document.createElement('button');
// focusModeBtn.className = 'focus-mode-btn';
// focusModeBtn.innerHTML = 'Exit Focus Mode (Ctrl + M)';
// document.body.appendChild(focusModeBtn);

// Add focus mode toggle functionality
function toggleFocusMode() {
  document.body.classList.toggle('focus-mode');
  updateLocalStorage();
}

// Update focus mode state in localStorage
function updateLocalStorage() {
  localStorage.setItem('focusMode', document.body.classList.contains('focus-mode'));
}

// Initialize focus mode from localStorage
function initFocusMode() {
  const focusMode = localStorage.getItem('focusMode') === 'true';
  if (focusMode) {
    document.body.classList.add('focus-mode');
  }
}

// Add keyboard shortcut handler
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    toggleFocusMode();
  }
});

// Add click handler for focus mode button
focusModeBtn.addEventListener('click', toggleFocusMode);

// Initialize focus mode on load
document.addEventListener('DOMContentLoaded', initFocusMode);