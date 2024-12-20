let tabs = [];
let activeTabId = null;
let currentTheme = "dark";
let jsonEditors = new Map();
let isJsonEditorMode = false;

// Add this at the start of your JavaScript code
const dbName = "EditorDB";
const dbVersion = 1;
let db;

// Initialize IndexedDB
async function initDB() {
  // Set word wrap enabled by default if not already set
  if (localStorage.getItem("wordWrap") === null) {
    localStorage.setItem("wordWrap", "true");
  }
  
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

// Mobile detection utility
function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches || 
         ('ontouchstart' in window) ||
         (navigator.maxTouchPoints > 0);
}

// Initialize mobile-specific features
function initMobileFeatures() {
  if (isMobile()) {
    // Enable word wrap by default on mobile
    document.querySelector('.editor').classList.add('word-wrap');
    
    // Add touch event handlers for better mobile scrolling
    const editor = document.querySelector('.editor');
    let touchStartY = 0;
    
    editor.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    editor.addEventListener('touchmove', (e) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      
      editor.scrollTop += deltaY;
      touchStartY = touchY;
    }, { passive: true });
  }
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
  name = "Untitled.md",
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

  // If this is the only tab, activate it immediately
  if (tabs.length === 1) {
    setActiveTab(id);
    // Force focus on the editor after a short delay to ensure DOM is ready
    setTimeout(() => {
      tab.editor.focus();
    }, 0);
  }

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

  // Clean up JSON editor if it exists
  const jsonEditor = jsonEditors.get(id);
  if (jsonEditor) {
    jsonEditor.destroy();
    jsonEditors.delete(id);
    const container = document.getElementById('jsoneditor-' + id);
    if (container) {
      container.remove();
    }
  }

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

async function openFile(event) {
  const files = event.target.files;
  if (files.length > 0) {
    const file = files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
      const id = Date.now().toString();
      const tabData = {
        id: id,
        name: file.name,
        content: e.target.result
      };

      try {
        const transaction = db.transaction(["tabs"], "readwrite");
        const store = transaction.objectStore("tabs");
        await store.put(tabData);

        createTab(file.name, e.target.result, id);
        setActiveTab(id);
      } catch (error) {
        console.error("Error saving to IndexedDB:", error);
      }
    };

    reader.readAsText(file);
  }
  event.target.value = '';
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
  
  // Update status bar color for PWA
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
  }
  
  // Update theme for all JSON editors
  for (let [tabId, jsonEditor] of jsonEditors) {
    if (jsonEditor) {
      try {
        // Get the ace editor instance from the JSON editor
        const aceEditor = jsonEditor.aceEditor;
        if (aceEditor) {
          aceEditor.setTheme(theme === 'dark' ? 'ace/theme/monokai' : 'ace/theme/chrome');
        }
      } catch (error) {
        console.error('Error updating JSON editor theme:', error);
      }
    }
  }
}

// Converter System
const converters = {
  timestamp: {
    name: 'Timestamp to Date',
    convert: function(input) {
      // Find all numbers that could be timestamps
      const timestamps = input.match(/\d+/g);
      if (!timestamps) {
        throw new Error("No timestamps found in the text. Please enter a number like 1699893347 or 1699893347000");
      }

      let results = [];
      let validCount = 0;
      for (const ts of timestamps) {
        try {
          const timestamp = parseInt(ts);
          if (isNaN(timestamp)) continue;

          // Only process numbers that could reasonably be timestamps
          // Ignore very small numbers or very large numbers
          if (timestamp < 1000000000 || timestamp > 9999999999999) continue;

          // Try both milliseconds and seconds
          let dates = [];
          // Try as milliseconds if number is large enough
          if (ts.length >= 13) {
            const msDate = new Date(timestamp);
            if (msDate.getTime() > 0 && msDate.getFullYear() > 1970 && msDate.getFullYear() < 2100) {
              dates.push({
                format: "milliseconds",
                date: msDate
              });
            }
          }
          // Try as seconds
          const secsDate = new Date(timestamp * 1000);
          if (secsDate.getTime() > 0 && secsDate.getFullYear() > 1970 && secsDate.getFullYear() < 2100) {
            dates.push({
              format: "seconds",
              date: secsDate
            });
          }

          if (dates.length > 0) {
            validCount++;
            results.push(`\nTimestamp: ${ts}`);
            dates.forEach(({format, date}) => {
              results.push(`Format: ${format}`);
              results.push(`UTC: ${date.toUTCString()}`);
              results.push(`Local: ${date.toString()}`);
            });
            results.push("---");
          }
        } catch (e) {
          continue; // Skip invalid timestamps
        }
      }

      if (validCount === 0) {
        throw new Error("No valid timestamps found. Please enter a Unix timestamp (e.g., 1699893347 or 1699893347000)");
      }

      return `\n\n---\n${results.join('\n')}\n---\n\n`;
    }
  },
  hexToBase64: {
    name: 'Hex to Base64',
    convert: function(hexString) {
      try {
        // Clean up hex string
        const cleanHex = hexString.replace(/0x/g, '').replace(/\s/g, '');
        if (!/^[0-9A-Fa-f]+$/.test(cleanHex)) {
          throw new Error("Invalid hex string");
        }
        
        const bytes = cleanHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
        const byteArray = new Uint8Array(bytes);
        const base64 = btoa(String.fromCharCode.apply(null, byteArray));
        
        return `\n\n---\nHex Input:\n${hexString}\n\nBase64 Output:\n${base64}\n---\n\n`;
      } catch (error) {
        throw new Error(`Hex to Base64 conversion failed: ${error.message}`);
      }
    }
  },
  base64ToHex: {
    name: 'Base64 to Hex',
    convert: function(encodedString) {
      try {
        const binaryString = atob(encodedString);
        const hexArray = Array.from(binaryString).map(char => {
          const hex = char.charCodeAt(0).toString(16).padStart(2, '0');
          return '0x' + hex.toUpperCase();
        });
        
        return `\n\n---\nBase64 Input:\n${encodedString}\n\nHex Output:\n${hexArray.join(' ')}\n---\n\n`;
      } catch (error) {
        throw new Error(`Base64 to Hex conversion failed: ${error.message}`);
      }
    }
  },
  jsonToCsv: {
    name: 'JSON to CSV',
    convert: function(input) {
      try {
        const json = JSON.parse(input);
        
        // Handle case where data is wrapped in an object
        const data = Array.isArray(json) ? json : (json.people || Object.values(json)[0]);
        
        if (!Array.isArray(data)) {
          throw new Error("Input must contain an array of objects");
        }
        if (data.length === 0) {
          throw new Error("Input array is empty");
        }

        // Function to flatten nested objects
        function flattenObject(obj, prefix = '') {
          return Object.keys(obj).reduce((acc, key) => {
            const value = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;
            
            if (value === null) {
              acc[newKey] = 'null';
            } else if (Array.isArray(value)) {
              acc[newKey] = JSON.stringify(value);
            } else if (typeof value === 'object') {
              Object.assign(acc, flattenObject(value, newKey));
            } else {
              acc[newKey] = value;
            }
            
            return acc;
          }, {});
        }

        // Flatten all objects in the array
        const flattenedData = data.map(item => flattenObject(item));

        // Get all unique headers
        const headers = [...new Set(
          flattenedData.reduce((acc, item) => [...acc, ...Object.keys(item)], [])
        )].sort();

        // Create CSV rows
        const csvRows = [headers.join(',')];
        
        for (const row of flattenedData) {
          const values = headers.map(header => {
            const val = row[header] ?? '';
            // Handle values that need quotes
            if (typeof val === 'string') {
              // Escape quotes and wrap in quotes
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          });
          csvRows.push(values.join(','));
        }

        return `\n\n---\nCSV Output:\n${csvRows.join('\n')}\n---\n\n`;
      } catch (error) {
        throw new Error(`JSON to CSV conversion failed: ${error.message}`);
      }
    }
  },
  jwt: {
    name: 'JWT Parser',
    convert: function(input) {
      try {
        const jwt = input.trim();
        if (!jwt) {
          throw new Error('Empty JWT token');
        }

        const [headerB64, payloadB64] = jwt.split('.');
        if (!headerB64 || !payloadB64) {
          throw new Error('Invalid JWT format');
        }
        
        const header = JSON.parse(atob(headerB64));
        const payload = JSON.parse(atob(payloadB64));

        return `\n\n---\nJWT Header:\n${JSON.stringify(header, null, 2)}\n\nJWT Payload:\n${JSON.stringify(payload, null, 2)}`;
      } catch (e) {
        throw new Error('Invalid JWT format: ' + e.message);
      }
    }
  },
  timestamp: {
    name: 'Timestamp to Date',
    convert: function(input) {
      const timestamp = parseInt(input);
      if (isNaN(timestamp)) throw new Error("Invalid timestamp");

      const format = timestamp.toString().length === 13 ? "milliseconds" : "seconds";
      const ms = format === "seconds" ? timestamp * 1000 : timestamp;
      const date = new Date(ms);

      if (date.toString() === "Invalid Date") throw new Error("Invalid timestamp");

      return `\n\n---\nFormat: ${format}\nUTC: ${date.toUTCString()}\nLocal: ${date.toString()}\n---\n\n`;
    }
  }
};

// Converter menu toggle
function toggleConverterMenu() {
  const menu = document.querySelector('.converter-menu');
  const button = document.querySelector('.converter-btn');
  const isVisible = menu.style.display === 'block';
  
  menu.style.display = isVisible ? 'none' : 'block';
  button.classList.toggle('active', !isVisible);
  
  // Close menu when clicking outside
  if (!isVisible) {
    document.addEventListener('click', function closeMenu(e) {
      if (!e.target.closest('.converter-dropdown')) {
        menu.style.display = 'none';
        button.classList.remove('active');
        document.removeEventListener('click', closeMenu);
      }
    });
  }
}

function applyConverter(converterKey) {
  const tab = getCurrentTab();
  if (!tab) return;

  // Get selected text or entire content if no selection
  const start = tab.editor.selectionStart;
  const end = tab.editor.selectionEnd;
  const selectedText = start !== end ? 
    tab.editor.value.substring(start, end).trim() : 
    tab.editor.value.trim();

  if (!selectedText) {
    showError("No content to convert");
    return;
  }

  try {
    const converter = converters[converterKey];
    if (!converter) throw new Error("Converter not found");

    const result = converter.convert(selectedText);

    // Always append the result at the cursor position or end of selection
    const insertPosition = end;
    const before = tab.editor.value.substring(0, insertPosition);
    const after = tab.editor.value.substring(insertPosition);
    tab.editor.value = before + result + after;

    // Move cursor to end of inserted text
    const newPosition = insertPosition + result.length;
    tab.editor.setSelectionRange(newPosition, newPosition);

    // Update editor state
    tab.updateLineNumbers();
    tab.saveToLocalStorage();
  } catch (error) {
    showError(error.message);
  }
}

function parseJWT() {
  applyConverter('jwt');
}

// Update existing converter functions to use the new system
function convertHexToBase64() {
  applyConverter('hexToBase64');
}

function convertBase64ToHex() {
  applyConverter('base64ToHex');
}

function convertTimestamp() {
  applyConverter('timestamp');
}

function convertJsonToCsv() {
  applyConverter('jsonToCsv');
}

// Add new function for JSON formatting
function formatJSON() {
  const tab = getCurrentTab();
  if (!tab) return;

  try {
    // Parse the current content as JSON
    let content = tab.editor.value.trim();
    if (!content) {
      showError("No content to format");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      showError("Invalid JSON: " + parseError.message);
      return;
    }

    // Get or create container for this tab
    let container = document.getElementById('jsoneditor-' + tab.id);
    if (!container) {
      container = document.createElement('div');
      container.id = 'jsoneditor-' + tab.id;
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.display = 'none';
      // Insert the container in the editor wrapper instead of body
      tab.editor.parentNode.appendChild(container);
    }

    // Get or create JSON editor for this tab
    let jsonEditor = jsonEditors.get(tab.id);
    if (!jsonEditor) {
      try {
        // Create the editor with improved options
        const options = {
          mode: 'code',
          modes: ['code', 'tree', 'preview'],
          onChangeText: (jsonString) => {
            tab.editor.value = jsonString;
            tab.saveToLocalStorage();
          },
          onModeChange: (newMode) => {
            tab.saveToLocalStorage();
          },
          theme: currentTheme === 'dark' ? 'ace/theme/monokai' : 'ace/theme/chrome',
          navigationBar: true,
          statusBar: true,
          mainMenuBar: true,
          search: true
        };

        jsonEditor = new JSONEditor(container, options);
        jsonEditors.set(tab.id, jsonEditor);
      } catch (editorError) {
        console.error('Error creating JSON editor:', editorError);
        showError("Error initializing JSON editor. Please check console for details.");
        return;
      }
    }

    // Set the JSON content
    jsonEditor.set(parsed);
    
    // Show JSON editor container and hide original editor
    container.style.display = 'block';
    tab.editor.style.display = 'none';
    
    // Update flags
    tab.isJsonEditorMode = true;
    
    // Save the formatted content to the original editor
    tab.editor.value = JSON.stringify(parsed, null, 2);
    tab.saveToLocalStorage();

    showError("JSON formatted successfully");
  } catch (error) {
    console.error('JSON formatting error:', error);
    showError("Error formatting JSON: " + error.message);
  }
}

// Update switchTab to handle JSON editor visibility
function switchTab(tabId) {
  if (activeTabId) {
    const currentTab = tabs.find((t) => t.id === activeTabId);
    if (currentTab) {
      currentTab.tab.classList.remove("active");
      currentTab.editor.style.display = "none";
      
      // Hide JSON editor if it exists for current tab
      const currentJsonContainer = document.getElementById('jsoneditor-' + currentTab.id);
      if (currentJsonContainer) {
        currentJsonContainer.style.display = 'none';
      }
    }
  }

  const newTab = tabs.find((t) => t.id === tabId);
  if (newTab) {
    newTab.tab.classList.add("active");
    
    // Show appropriate editor based on mode
    if (newTab.isJsonEditorMode) {
      const jsonContainer = document.getElementById('jsoneditor-' + newTab.id);
      if (jsonContainer) {
        jsonContainer.style.display = 'block';
        newTab.editor.style.display = 'none';
      } else {
        newTab.editor.style.display = "block";
      }
    } else {
      newTab.editor.style.display = "block";
    }
    
    newTab.editor.focus();
  }
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


// Update keyboard shortcuts for mobile
document.addEventListener("keydown", (e) => {
  // Handle list continuation
  if (e.key === "Enter") {
    const editor = document.querySelector(".editor");
    if (editor && document.activeElement === editor) {
      const cursorPos = editor.selectionStart;
      const content = editor.value;
      const lines = content.split('\n');
      let currentLineStart = content.lastIndexOf('\n', cursorPos - 1) + 1;
      let currentLine = content.substring(currentLineStart, cursorPos);

      // Check for bullet points
      const bulletMatch = currentLine.match(/^(\s*)[-*+]\s+/);
      if (bulletMatch) {
        e.preventDefault();
        const [fullMatch, spaces] = bulletMatch;
        const textAfterCursor = content.substring(cursorPos);
        editor.value = content.substring(0, cursorPos) + '\n' + spaces + '- ' + textAfterCursor;
        editor.selectionStart = editor.selectionEnd = cursorPos + fullMatch.length + 1;
        return;
      }

      // Check for numbered lists
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);
      if (numberedMatch) {
        e.preventDefault();
        const [fullMatch, spaces, number] = numberedMatch;
        const nextNumber = parseInt(number) + 1;
        const textAfterCursor = content.substring(cursorPos);
        editor.value = content.substring(0, cursorPos) + '\n' + spaces + nextNumber + '. ' + textAfterCursor;
        editor.selectionStart = editor.selectionEnd = cursorPos + spaces.length + nextNumber.toString().length + 3;
        return;
      }
    }
  }

  // Only apply Ctrl shortcuts on desktop
  if (!isMobile()) {
    if (e.ctrlKey && e.key === "w") {
      e.preventDefault();
      const currentTab = getCurrentTab();
      if (currentTab) {
        closeTab(currentTab.id);
      }
    } else if (e.ctrlKey && e.shiftKey && e.key === "J") {
      e.preventDefault();
      formatJSON();
    } else if (e.ctrlKey && e.shiftKey && e.key === "T") {
      e.preventDefault();
      toggleJsonEditor();
    } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "u") {
      e.preventDefault();
      convertToLowerCase();
    } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "u") {
      e.preventDefault();
      convertToUpperCase();
    }
  }
  
  // Handle Escape key for both mobile and desktop
  if (e.key === "Escape") {
    const selectionPopup = document.getElementById("selectionPopup");
    if (selectionPopup.style.display === "block") {
      selectionPopup.style.display = "none";
    }
  }
});

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

function updateMarkdownPreview() {
  const currentTab = getCurrentTab();
  if (!currentTab) return;

  const previewPanel = document.getElementById('previewPanel');
  const markdownDiv = previewPanel.querySelector('.markdown-preview');
  if (markdownDiv) {
    // Convert markdown to HTML and update the preview
    markdownDiv.innerHTML = '';  // Clear existing content
    const html = convertMarkdownToHtml(currentTab.editor.value);
    markdownDiv.innerHTML = html;
  }
}

function togglePreview() {
  const contentContainer = document.querySelector('.content-container');
  const previewPanel = document.getElementById('previewPanel');
  const isPreviewMode = contentContainer.classList.toggle('preview-mode');
  const previewButtons = document.querySelectorAll('[title*="Preview"], [title*="Edit Mode"]');
  const currentTab = getCurrentTab();

  if (!currentTab) return;

  // Clear previous preview content
  previewPanel.innerHTML = '';

  if (isPreviewMode) {
    if (currentTab.name.toLowerCase().endsWith('.md')) {
      // Create div for markdown preview
      const markdownDiv = document.createElement('div');
      markdownDiv.className = 'markdown-preview';
      previewPanel.appendChild(markdownDiv);
      updateMarkdownPreview();
    } else if (currentTab.name.toLowerCase().endsWith('.html')) {
      const iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      previewPanel.appendChild(iframe);
      iframe.srcdoc = currentTab.editor.value;
    }

    previewButtons.forEach(button => {
      button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
      button.title = 'Edit Mode';
    });
  } else {
    previewButtons.forEach(button => {
      button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>`;
      button.title = 'Toggle Preview';
    });
  }

  if (isPreviewMode) {
    currentTab.editor.addEventListener('input', updatePreview);
  } else {
    currentTab.editor.removeEventListener('input', updatePreview);
  }
}

function updatePreview() {
  const currentTab = getCurrentTab();
  if (!currentTab) return;

  const previewPanel = document.getElementById('previewPanel');

  if (currentTab.name.toLowerCase().endsWith('.md')) {
    const markdownDiv = previewPanel.querySelector('.markdown-preview');
    if (markdownDiv) {
      markdownDiv.innerHTML = convertMarkdownToHtml(currentTab.editor.value);
    }
  } else if (currentTab.name.toLowerCase().endsWith('.html')) {
    const iframe = previewPanel.querySelector('iframe');
    if (iframe) {
      iframe.srcdoc = currentTab.editor.value;
    }
  }
}

function convertMarkdownToHtml(markdown) {
  // Process Mermaid diagrams first
  markdown = markdown.replace(/```mermaid\n([\s\S]*?)\n```/g, (match, content) => {
    const id = 'mermaid-' + Math.random().toString(36).substring(2);
    const cleanContent = content.trim();
    try {
      // Create a temporary container for the diagram
      const tempDiv = document.createElement('div');
      tempDiv.className = 'mermaid';
      tempDiv.id = id;
      tempDiv.textContent = cleanContent;
      
      // Queue the rendering for after the element is in the DOM
      setTimeout(() => {
        mermaid.init(undefined, `#${id}`);
      }, 0);
      
      return tempDiv.outerHTML;
    } catch (error) {
      console.error('Mermaid rendering error:', error);
      return `<pre class="mermaid-error">Error rendering diagram: ${error.message}</pre>`;
    }
  });

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

  // Process tables
  let inTable = false;
  let tableRows = [];
  let processedLines2 = [];

  for (let line of processedLines) {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) {
        inTable = true;
      }
      tableRows.push(line);
    } else {
      if (inTable) {
        // Process the collected table
        if (tableRows.length >= 2) {
          let table = '<table class="markdown-table">\n';
          
          // Process header
          let headerCells = tableRows[0].split('|').slice(1, -1);
          table += '<thead>\n<tr>\n';
          headerCells.forEach(cell => {
            table += `<th>${cell.trim()}</th>\n`;
          });
          table += '</tr>\n</thead>\n';
          
          // Process body
          if (tableRows.length > 2) {
            table += '<tbody>\n';
            for (let i = 2; i < tableRows.length; i++) {
              let cells = tableRows[i].split('|').slice(1, -1);
              table += '<tr>\n';
              cells.forEach(cell => {
                table += `<td>${cell.trim()}</td>\n`;
              });
              table += '</tr>\n';
            }
            table += '</tbody>\n';
          }
          
          table += '</table>';
          processedLines2.push(table);
        }
        
        inTable = false;
        tableRows = [];
      }
      processedLines2.push(line);
    }
  }

  // Handle case where file ends with a table
  if (inTable && tableRows.length >= 2) {
    let table = '<table class="markdown-table">\n';
    
    // Process header
    let headerCells = tableRows[0].split('|').slice(1, -1);
    table += '<thead>\n<tr>\n';
    headerCells.forEach(cell => {
      table += `<th>${cell.trim()}</th>\n`;
    });
    table += '</tr>\n</thead>\n';
    
    // Process body
    if (tableRows.length > 2) {
      table += '<tbody>\n';
      for (let i = 2; i < tableRows.length; i++) {
        let cells = tableRows[i].split('|').slice(1, -1);
        table += '<tr>\n';
        cells.forEach(cell => {
          table += `<td>${cell.trim()}</td>\n`;
        });
        table += '</tr>\n';
      }
      table += '</tbody>\n';
    }
    
    table += '</table>';
    processedLines2.push(table);
  }

  let html = processedLines2
    .join('\n')
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
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => {
          console.log('ServiceWorker registration successful');
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
    });
  }

  initEditor().catch(console.error);
  initMobileFeatures();
  
  // Add viewport height fix for mobile browsers
  function setVH() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  setVH();
  window.addEventListener('resize', setVH);
});

// Add focus mode toggle button
// const focusModeBtn = document.createElement('button');
// focusModeBtn.className = 'focus-mode-btn';
// focusModeBtn.innerHTML = 'Exit Focus Mode (Ctrl + M)';
// document.body.appendChild(focusModeBtn);

// Initialize focus mode settings
function initFocusMode() {
  const focusMode = localStorage.getItem('focusMode');
  if (focusMode === 'true') {
    document.body.classList.add('focus-mode');
  }
}

// Toggle focus mode on/off
function toggleFocusMode() {
  const body = document.body;
  const wasInFocusMode = body.classList.contains('focus-mode');
  
  body.classList.toggle('focus-mode');
  
  // Update theme color meta tag based on focus mode state
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = body.classList.contains('focus-mode') ? '#000000' : getComputedStyle(document.body).getPropertyValue('--title-bar-bg').trim();
  }

  // Notify the user of mode change
  showNotification(wasInFocusMode ? 'Exited focus mode' : 'Entered focus mode', 2000);
  
  // Save the focus mode state
  localStorage.setItem('focusMode', body.classList.contains('focus-mode'));
}

// Add keyboard shortcut for focus mode (Ctrl + M)
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    toggleFocusMode();
  }
  
  // Allow Escape key to exit focus mode
  if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) {
    toggleFocusMode();
  }
});

// Restore focus mode state on page load
document.addEventListener('DOMContentLoaded', function() {
  const focusMode = localStorage.getItem('focusMode') === 'true';
  if (focusMode) {
    document.body.classList.add('focus-mode');
  }
});

function copyToClipboard() {
  const editor = document.querySelector('.CodeMirror').CodeMirror;
  const content = editor.getValue();
  
  navigator.clipboard.writeText(content).then(() => {
    showNotification('Content copied to clipboard', 2000);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showNotification('Failed to copy content', 2000);
  });
}

// Initialize focus mode on load
document.addEventListener('DOMContentLoaded', () => {
  initFocusMode();
  
  // Enable focus mode by default for PWA
  if (isPWA()) {
    const focusMode = localStorage.getItem('focusMode');
    if (focusMode === null) {
      toggleFocusMode();
    }
  }
});

// Function to check if app is running in PWA mode
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches || 
         window.navigator.standalone || 
         document.referrer.includes('android-app://');
}

// Initialize focus mode and other features on load
document.addEventListener('DOMContentLoaded', () => {
  initFocusMode();
  
  // Enable focus mode by default for PWA
  if (isPWA()) {
    const focusMode = localStorage.getItem('focusMode');
    if (focusMode === null) {
      toggleFocusMode();
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === "Escape") {
    const contentContainer = document.querySelector(".content-container");
    if (contentContainer.classList.contains("preview-mode")) {
      togglePreview();
    }
  }
});

function showNotification(message, duration = 3000) {
  const notification = document.querySelector('.notification');
  notification.textContent = message;
  notification.style.display = 'block';

  setTimeout(() => {
    notification.style.display = 'none';
  }, duration);
}

function showError(message) {
  showNotification(message);
}

function convertToLowerCase() {
  const editor = document.querySelector(".editor");
  if (editor) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    
    if (start !== end) {
      const selectedText = editor.value.substring(start, end);
      const lowerCaseText = selectedText.toLowerCase();
      editor.setRangeText(lowerCaseText, start, end, 'select');
      
      // Save changes using the Tab's save method
      const currentTab = getCurrentTab();
      if (currentTab) {
        currentTab.saveToLocalStorage();
      }
      
      showNotification('Text converted to lowercase');
    }
  }
}

function convertToUpperCase() {
  const editor = document.querySelector(".editor");
  if (editor) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    
    if (start !== end) {
      const selectedText = editor.value.substring(start, end);
      const upperCaseText = selectedText.toUpperCase();
      editor.setRangeText(upperCaseText, start, end, 'select');
      
      // Save changes using the Tab's save method
      const currentTab = getCurrentTab();
      if (currentTab) {
        currentTab.saveToLocalStorage();
      }
      
      showNotification('Text converted to uppercase');
    }
  }
}