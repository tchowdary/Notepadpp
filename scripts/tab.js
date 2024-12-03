// Tab class to manage individual tabs
class Tab {
  constructor(id, name = "Untitled", content = "") {
    this.id = id;
    this.name = name;
    this.content = content;
    this.wordWrap = localStorage.getItem("wordWrap") === "true";
    this.createElements();
    this.setupTabNameEditing(); 
    this.setupSelectionPopup();
    //this.addCopyButton();
    this.addFocusModeButtons();

    // Add keyboard shortcut handling to the editor
    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        this.handleTabKey(e);
      }

      // Ctrl + Enter for bullet list
      if (e.ctrlKey && e.key === ".") {
        e.preventDefault();
        this.convertToBulletList();
      }

      // Alt + Arrow Up/Down to move lines
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        this.moveLine(e.key === "ArrowUp" ? -1 : 1);
      }

      // Escape to exit focus mode
      if (e.key === "Escape") {
        if (document.body.classList.contains('focus-mode')) {
          e.preventDefault();
          toggleFocusMode();
        }
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
      if (e.ctrlKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleFocusMode();
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

    // Add list continuation and indentation handler
    this.editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const cursorPos = this.editor.selectionStart;
        const content = this.editor.value;
        let currentLineStart = content.lastIndexOf('\n', cursorPos - 1) + 1;
        let currentLine = content.substring(currentLineStart, cursorPos);
        
        // Check for bullet points
        const bulletMatch = currentLine.match(/^(\s*)[-*+]\s+/);
        if (bulletMatch) {
          e.preventDefault();
          const [fullMatch, spaces] = bulletMatch;
          const marker = currentLine[spaces.length]; // Get the actual marker used (-, *, or +)
          const textAfterCursor = content.substring(cursorPos);
          this.editor.value = content.substring(0, cursorPos) + '\n' + spaces + marker + ' ' + textAfterCursor;
          this.editor.selectionStart = this.editor.selectionEnd = cursorPos + spaces.length + 3;
          this.updateLineNumbers();
          this.saveToLocalStorage();
          return;
        }

        // Check for numbered lists with sub-numbering (e.g., 1a, 1b, 2a)
        const numberedMatch = currentLine.match(/^(\s*)(\d+)([a-z]?)[\.\)]\s+/);
        if (numberedMatch) {
          e.preventDefault();
          const [fullMatch, spaces, number, subLetter] = numberedMatch;
          let nextMarker;
          
          // If there's a sub-letter, increment it
          if (subLetter) {
            nextMarker = number + String.fromCharCode(subLetter.charCodeAt(0) + 1);
          } else {
            // If no sub-letter and line is indented, start sub-numbering with 'a'
            if (spaces.length > 0) {
              nextMarker = number + 'a';
            } else {
              // Otherwise increment the number
              nextMarker = (parseInt(number) + 1).toString();
            }
          }
          
          const textAfterCursor = content.substring(cursorPos);
          this.editor.value = content.substring(0, cursorPos) + '\n' + spaces + nextMarker + '. ' + textAfterCursor;
          this.editor.selectionStart = this.editor.selectionEnd = cursorPos + spaces.length + nextMarker.toString().length + 3;
          this.updateLineNumbers();
          this.saveToLocalStorage();
          return;
        }
      }
      
      // Handle Tab key for list indentation
      if (e.key === "Tab") {
        const cursorPos = this.editor.selectionStart;
        const content = this.editor.value;
        const currentLineStart = content.lastIndexOf('\n', cursorPos - 1) + 1;
        const currentLine = content.substring(currentLineStart, cursorPos);
        
        // Check if we're on a list item
        const listMatch = currentLine.match(/^(\s*)(?:[-*+]|\d+(?:[a-z]?)[\.\)])\s+(.*)$/);
        if (listMatch) {
          e.preventDefault();
          const [fullMatch, spaces, text] = listMatch;
          
          if (e.shiftKey) {
            // Handle unindent (shift+tab)
            if (spaces.length >= 2) {
              // Check if it's a numbered sub-list item (e.g., "3a.")
              const numberedSubMatch = currentLine.match(/^(\s*)(\d+)([a-z])[\.\)]\s+(.*)$/);
              if (numberedSubMatch) {
                const [, , number, subLetter, text] = numberedSubMatch;
                // Convert back to regular numbered item by removing sub-letter
                const newIndent = spaces.slice(2);
                const newLine = newIndent + number + '. ' + text;
                this.editor.value = content.substring(0, currentLineStart) + newLine + content.substring(currentLineStart + currentLine.length);
                this.editor.selectionStart = this.editor.selectionEnd = currentLineStart + newLine.length;
              } else {
                // For bullet points and regular numbered items, just remove indentation
                const newIndent = spaces.slice(2);
                const newLine = newIndent + currentLine.trim();
                this.editor.value = content.substring(0, currentLineStart) + newLine + content.substring(currentLineStart + currentLine.length);
                this.editor.selectionStart = this.editor.selectionEnd = currentLineStart + newLine.length;
              }
              this.updateLineNumbers();
              this.saveToLocalStorage();
            }
            return;
          } else {
            // Handle indent (tab)
            // If it's a numbered list without sub-letter, convert to sub-numbering
            const numberedMatch = currentLine.match(/^(\s*)(\d+)[\.\)]\s+(.*)$/);
            if (numberedMatch) {
              const [, , number, text] = numberedMatch;
              // Replace current line's indentation with 2 spaces
              const newLine = '  ' + number + 'a. ' + text;
              this.editor.value = content.substring(0, currentLineStart) + newLine + content.substring(currentLineStart + currentLine.length);
              this.editor.selectionStart = this.editor.selectionEnd = currentLineStart + newLine.length;
            } else {
              // For bullet points and other cases, add 2 spaces to indentation
              const bulletMatch = currentLine.match(/^(\s*)([-*+])\s+(.*)$/);
              if (bulletMatch) {
                const [, , marker, text] = bulletMatch;
                const newIndent = spaces + '  ';
                const newLine = newIndent + marker + ' ' + text;
                this.editor.value = content.substring(0, currentLineStart) + newLine + content.substring(currentLineStart + currentLine.length);
                this.editor.selectionStart = this.editor.selectionEnd = currentLineStart + newLine.length;
              }
            }
            this.updateLineNumbers();
            this.saveToLocalStorage();
            return;
          }
        }
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
  }

  addFocusModeButtons() {
    // Add exit button
    //const exitButton = document.createElement('button');
    // exitButton.className = 'focus-mode-exit';
    // exitButton.innerHTML = `
    //     <svg viewBox="0 0 24 24">
    //         <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
    //     </svg>`;
    // exitButton.addEventListener('click', () => toggleFocusMode());
        
    // Add enter button to toolbar if it doesn't exist
    if (!document.querySelector('.focus-mode-enter')) {
        const enterButton = document.createElement('button');
        enterButton.className = 'focus-mode-enter';
        enterButton.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>`;
        enterButton.addEventListener('click', () => toggleFocusMode());
        document.querySelector('.toolbar').appendChild(enterButton);
    }

    //this.editorWrapper.appendChild(exitButton);
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
    
    // Apply word wrap setting
    if (this.wordWrap) {
      this.editor.classList.add("word-wrap");
    }

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
    const currentLineCount = this.lineNumbers.children.length;

    // Only update if line count changed
    if (lineCount !== currentLineCount) {
      // Clear existing line numbers
      this.lineNumbers.innerHTML = "";
      
      // Create a document fragment for better performance
      const fragment = document.createDocumentFragment();
      
      // Create line number elements
      for (let i = 0; i < lineCount; i++) {
        const div = document.createElement("div");
        div.textContent = i + 1;
        fragment.appendChild(div);
      }
      
      // Append all line numbers at once
      this.lineNumbers.appendChild(fragment);
    }

    // Ensure scroll synchronization
    this.lineNumbers.scrollTop = this.editor.scrollTop;
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

  // Add new method for moving lines up/down
  moveLine(direction) {
    const text = this.editor.value;
    let start = this.editor.selectionStart;
    let end = this.editor.selectionEnd;

    // Find the boundaries of the selected lines
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const selectionStart = text.lastIndexOf('\n', start - 1) + 1;
    let selectionEnd = text.indexOf('\n', end);
    if (selectionEnd === -1) selectionEnd = text.length;

    // Get the selected lines content
    const selectedLines = text.slice(selectionStart, selectionEnd);

    if (direction < 0 && lineStart > 0) {
      // Moving up: Find the previous line
      const prevLineStart = text.lastIndexOf('\n', selectionStart - 2) + 1;
      const prevLine = text.slice(prevLineStart, selectionStart - 1);

      // Swap lines
      this.editor.value = text.slice(0, prevLineStart) +
        selectedLines + '\n' +
        prevLine +
        text.slice(selectionEnd);

      // Update selection to moved block
      this.editor.selectionStart = prevLineStart;
      this.editor.selectionEnd = prevLineStart + selectedLines.length;

    } else if (direction > 0 && selectionEnd < text.length) {
      // Moving down: Find the next line
      const nextLineEnd = text.indexOf('\n', selectionEnd + 1);
      const nextLine = text.slice(selectionEnd + 1, nextLineEnd === -1 ? text.length : nextLineEnd);

      // Swap lines
      this.editor.value = text.slice(0, selectionStart) +
        nextLine + '\n' +
        selectedLines +
        text.slice(nextLineEnd === -1 ? text.length : nextLineEnd);

      // Update selection to moved block
      const newLineStart = selectionStart + nextLine.length + 1;
      this.editor.selectionStart = newLineStart;
      this.editor.selectionEnd = newLineStart + selectedLines.length;
    }

    this.updateLineNumbers();
    this.saveToLocalStorage();
  }
}