// Tab class to manage individual tabs
class Tab {
  constructor(id, name = "Untitled", content = "") {
    this.id = id;
    this.name = name;
    this.content = content;
    this.wordWrap = localStorage.getItem("wordWrap") === "true";
    this.createElements();
    this.setupTabNameEditing(); // Add this line
    this.setupSelectionPopup();

    // Add keyboard shortcut handling to the editor
    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        this.handleTabKey(e);
      }
    });

    // Apply word wrap setting
    if (this.wordWrap) {
      this.editor.classList.add("word-wrap");
    }

    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        this.handleTabKey(e);
      }

      // Ctrl + Enter for bullet list
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        this.convertToBulletList();
      }

      // Add horizontal line shortcut (Ctrl + -)
      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        this.insertHorizontalLine();
      }
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        this.toggleDoneStatus();
      }
    });

    document.addEventListener('keydown', (e) => {
      // Add this case to existing keyboard shortcuts
      if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        togglePreview();
      }
    });

    // Add preview update to input event
    this.editor.addEventListener("input", () => {
      this.updateLineNumbers();
      this.saveToLocalStorage();
      if (
        document
          .querySelector(".content-container")
          .classList.contains("preview-mode")
      ) {
        updatePreview();
      }
    });


    // Add copy button to the editor wrapper
    this.addCopyButton();
  }

  addCopyButton() {
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.title = 'Copy to clipboard';
    copyButton.innerHTML = `
        <svg viewBox="0 0 24 24">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
    `;

    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.editor.value);

        // Add visual feedback
        copyButton.classList.add('copy-feedback');
        setTimeout(() => {
          copyButton.classList.remove('copy-feedback');
        }, 300);

      } catch (err) {
        showError('Failed to copy to clipboard');
      }
    });

    this.editorWrapper.appendChild(copyButton);
  }

  insertHorizontalLine() {
    const pos = this.editor.selectionStart;
    const value = this.editor.value;
    const horizontalLine =
      "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

    this.editor.value =
      value.slice(0, pos) + horizontalLine + value.slice(pos);
    this.editor.selectionStart = this.editor.selectionEnd =
      pos + horizontalLine.length;
    this.updateLineNumbers();
    this.saveToLocalStorage();
  }

  async saveToIndexedDB() {
    const transaction = db.transaction(["tabs"], "readwrite");
    const store = transaction.objectStore("tabs");
    await store.put({
      id: this.id,
      name: this.name,
      content: this.editor.value,
    });
  }

  setupTabNameEditing() {
    const nameSpan = document.querySelector(`.tab-name[data-tab-id="${this.id}"]`);
    nameSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const input = document.createElement("input");
      input.value = this.name;
      input.className = "tab-name-input";
      nameSpan.replaceWith(input);
      input.focus();
      input.select();

      const handleRename = () => {
        let newName = input.value.trim() || "Untitled";
        // Add .md extension if not present
        if (!newName.endsWith('.md')) {
          newName += '.md';
        }
        this.name = newName;
        const newSpan = document.createElement("span");
        newSpan.className = "tab-name";
        newSpan.setAttribute("data-tab-id", this.id);
        newSpan.textContent = newName;
        input.replaceWith(newSpan);
        document.getElementById("statusFileName").textContent = newName;
        this.saveToLocalStorage();
        this.setupTabNameEditing();
      };

      input.addEventListener("blur", handleRename);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          handleRename();
        }
      });
    });
  }

  toggleDoneStatus() {
    const start = this.editor.selectionStart;
    const text = this.editor.value;
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = text.indexOf("\n", start);
    const currentLine = text.slice(
      lineStart,
      lineEnd === -1 ? text.length : lineEnd
    );

    const doneEmoji = "- ✅";
    const notDoneEmoji = "- ⬜";

    let newLine;
    if (currentLine.startsWith(doneEmoji)) {
      newLine = currentLine.replace(doneEmoji, notDoneEmoji);
    } else if (currentLine.startsWith(notDoneEmoji)) {
      newLine = currentLine.replace(notDoneEmoji, doneEmoji);
    } else {
      newLine = notDoneEmoji + " " + currentLine;
    }

    this.editor.value =
      text.slice(0, lineStart) +
      newLine +
      text.slice(lineEnd === -1 ? text.length : lineEnd);
    this.editor.selectionStart = this.editor.selectionEnd = lineStart;
    this.updateLineNumbers();
    this.saveToLocalStorage();
  }

  setupSelectionPopup() {
    const popup = document.getElementById("selectionPopup");
    let selectionTimeout;

    const updatePopupPosition = () => {
      const selectedText = this.editor.value.substring(
        this.editor.selectionStart,
        this.editor.selectionEnd
      );

      if (selectedText) {
        // Get the coordinates of the cursor/selection
        const editorRect = this.editor.getBoundingClientRect();

        // Create a temporary div to measure text dimensions
        const div = document.createElement("div");
        div.style.font = window.getComputedStyle(this.editor).font;
        div.style.position = "absolute";
        div.style.whiteSpace = "pre";
        div.style.visibility = "hidden";
        div.textContent = this.editor.value.substring(
          0,
          this.editor.selectionStart
        );
        document.body.appendChild(div);

        // Calculate position based on text measurements
        const textWidth = div.offsetWidth;
        const lines = div.textContent.split("\\n").length;
        const lineHeight = parseInt(
          window.getComputedStyle(this.editor).lineHeight
        );

        document.body.removeChild(div);

        // Calculate coordinates
        const x = editorRect.left + (textWidth % this.editor.clientWidth);
        const y =
          editorRect.top + lines * lineHeight - this.editor.scrollTop;

        // Position the popup
        popup.style.display = "block";
        popup.style.left =
          Math.min(x, editorRect.right - popup.offsetWidth - 10) + "px";
        popup.style.top = y - popup.offsetHeight - 10 + "px";
      } else {
        popup.style.display = "none";
      }
    };

    this.editor.addEventListener("mouseup", () => {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(updatePopupPosition, 100);
    });

    this.editor.addEventListener("keyup", (e) => {
      if (
        e.shiftKey &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(updatePopupPosition, 100);
      }
    });

    // Hide popup when clicking outside
    document.addEventListener("mousedown", (e) => {
      if (!popup.contains(e.target) && e.target !== this.editor) {
        popup.style.display = "none";
      }
    });

    // Update popup position on scroll
    this.editor.addEventListener("scroll", () => {
      if (popup.style.display === "block") {
        updatePopupPosition();
      }
    });

    // Handle window resize
    window.addEventListener("resize", () => {
      if (popup.style.display === "block") {
        updatePopupPosition();
      }
    });
  }

  createElements() {
    // Create editor wrapper
    this.editorWrapper = document.createElement("div");
    this.editorWrapper.className = "editor-wrapper";
    this.editorWrapper.id = `editor-wrapper-${this.id}`;

    // Create line numbers
    this.lineNumbers = document.createElement("div");
    this.lineNumbers.className = "line-numbers";

    // Create editor
    this.editor = document.createElement("textarea");
    this.editor.className = "editor";
    this.editor.value = this.content;
    this.editor.spellcheck = false;

    // Add event listeners
    this.editor.addEventListener("input", () => {
      this.updateLineNumbers();
      this.saveToLocalStorage();
    });
    this.editor.addEventListener("scroll", () => {
      this.lineNumbers.scrollTop = this.editor.scrollTop;
    });
    this.editor.addEventListener("keyup", () => this.updateStatusBar());
    this.editor.addEventListener("click", () => this.updateStatusBar());
    this.editor.addEventListener("scroll", () => this.updateStatusBar());
    this.editor.addEventListener("keydown", this.handleTabKey.bind(this));

    // Assemble elements
    this.editorWrapper.appendChild(this.lineNumbers);
    this.editorWrapper.appendChild(this.editor);
    document
      .getElementById("editorContainer")
      .appendChild(this.editorWrapper);

    this.updateLineNumbers();
  }

  updateLineNumbers() {
    const lines = this.editor.value.split("\n");
    const lineCount = lines.length;
    const lineNumbersContent = Array.from(
      { length: lineCount },
      (_, i) => {
        const div = document.createElement("div");
        div.textContent = i + 1;
        return div;
      }
    );
    this.lineNumbers.innerHTML = "";
    lineNumbersContent.forEach((div) =>
      this.lineNumbers.appendChild(div)
    );
  }

  updateStatusBar() {
    const text = this.editor.value;
    const position = this.editor.selectionStart;
    const lines = text.substr(0, position).split("\n");
    const currentLine = lines.length;
    const currentColumn = lines[lines.length - 1].length + 1;

    document.getElementById(
      "statusInfo"
    ).textContent = `Ln ${currentLine}, Col ${currentColumn}`;

    // Get selected text length
    const selectionStart = this.editor.selectionStart;
    const selectionEnd = this.editor.selectionEnd;
    const selectedText = this.editor.value.substring(
      selectionStart,
      selectionEnd
    );
    const selectedLength = selectedText.length;
    const selectedWords = selectedText
      ? selectedText
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length
      : 0;

    // Update selection info
    const selectionInfo = document.getElementById("selectionInfo");
    if (selectedLength > 0) {
      selectionInfo.textContent = `Sel ${selectedLength} chr, ${selectedWords} words`;
    } else {
      selectionInfo.textContent = "";
    }
  }

  handleTabKey(e) {
    if (e.key !== "Tab") return;

    e.preventDefault();
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const text = this.editor.value;

    // Simple tab insertion if no text is selected
    if (start === end) {
      this.editor.value = text.slice(0, start) + "  " + text.slice(end);
      this.editor.selectionStart = this.editor.selectionEnd = start + 2;
      this.updateLineNumbers();
      this.saveToLocalStorage();
      return;
    }

    // Handle selected text
    let startLine = text.lastIndexOf("\n", start - 1) + 1;
    let endLine = text.indexOf("\n", end);
    if (endLine === -1) endLine = text.length;

    const selectedLines = text.slice(startLine, endLine).split("\n");

    if (e.shiftKey) {
      const unindentedLines = selectedLines.map((line) => {
        return line.startsWith("  ") ? line.slice(2) : line;
      });

      this.editor.value =
        text.slice(0, startLine) +
        unindentedLines.join("\n") +
        text.slice(endLine);

      this.editor.selectionStart = startLine;
      this.editor.selectionEnd =
        startLine + unindentedLines.join("\n").length;
    } else {
      const indentedLines = selectedLines.map((line) => "  " + line);

      this.editor.value =
        text.slice(0, startLine) +
        indentedLines.join("\n") +
        text.slice(endLine);

      this.editor.selectionStart = startLine;
      this.editor.selectionEnd =
        startLine + indentedLines.join("\n").length;
    }

    this.updateLineNumbers();
    this.saveToLocalStorage();
  }

  activate() {
    this.editorWrapper.classList.add("active");
    document.getElementById("statusFileName").textContent = this.name;
    this.updateStatusBar();
  }

  deactivate() {
    this.editorWrapper.classList.remove("active");
  }

  saveToLocalStorage() {
    this.saveToIndexedDB().catch(console.error);
  }

  // Add new method for bullet list conversion
  convertToBulletList() {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const text = this.editor.value;

    // Find the start of the first line of selection
    let lineStart = text.lastIndexOf('\n', start - 1) + 1;
    if (lineStart === -1) lineStart = 0;

    // Find the end of the last line of selection
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = text.length;

    // Get the selected lines
    const selectedLines = text.slice(lineStart, lineEnd).split('\n');

    // Convert each line to bullet point
    const bulletLines = selectedLines.map(line => {
      // If line already starts with bullet point, leave it as is
      if (line.trim().startsWith('- ')) {
        return line;
      }
      // If line is empty, don't add bullet point
      if (line.trim() === '') {
        return line;
      }
      // Add bullet point
      return `- ${line.trim()}`;
    });

    // Replace the text
    this.editor.value = text.slice(0, lineStart) + bulletLines.join('\n') + text.slice(lineEnd);

    // Update editor state
    this.updateLineNumbers();
    this.saveToLocalStorage();

    // Maintain selection
    this.editor.selectionStart = lineStart;
    this.editor.selectionEnd = lineStart + bulletLines.join('\n').length;
  }
}