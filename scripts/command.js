class CommandPalette {
  constructor() {
      this.commands = [
          { id: 'newFile', title: 'New File', shortcut: '', action: () => newFile() },
          { id: 'toggleTheme', title: 'Toggle Theme', shortcut: '', action: () => toggleTheme() },
          { id: 'togglePreview', title: 'Toggle Preview', shortcut: 'Alt+E', action: () => togglePreview() },
          { id: 'toggleFocus', title: 'Toggle Focus Mode', shortcut: 'Ctrl+M', action: () => toggleFocusMode() },
          { id: 'formatJson', title: 'Format JSON', shortcut: '', action: () => formatJSON() },
          { id: 'wordWrap', title: 'Toggle Word Wrap', shortcut: '', action: () => toggleWordWrap() },
          { id: 'downloadFile', title: 'Download File', shortcut: '', action: () => downloadCurrentFile() },
          { id: 'convertTS', title: 'Convert Timestamp', shortcut: '', action: () => convertTimestamp() },
      ];
      
      this.createPalette();
      this.selectedIndex = 0;
  }

  createPalette() {
      this.element = document.createElement('div');
      this.element.className = 'command-palette';
      this.element.innerHTML = `
          <input type="text" class="command-input" placeholder="Type a command...">
          <div class="command-list"></div>
      `;
      
      document.body.appendChild(this.element);
      
      this.input = this.element.querySelector('.command-input');
      this.list = this.element.querySelector('.command-list');
      
      this.setupEventListeners();
  }

  setupEventListeners() {
      this.input.addEventListener('input', () => this.filterCommands());
      this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
      
      document.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === 'k') {
              e.preventDefault();
              this.toggle();
          }
      });
      
      // Close on click outside
      document.addEventListener('click', (e) => {
          if (!this.element.contains(e.target)) {
              this.hide();
          }
      });
  }

  filterCommands() {
      const query = this.input.value.toLowerCase();
      const filtered = this.commands.filter(cmd => 
          cmd.title.toLowerCase().includes(query)
      );
      
      this.renderCommands(filtered);
  }

  renderCommands(commands) {
      this.list.innerHTML = commands.map((cmd, index) => `
          <div class="command-item ${index === this.selectedIndex ? 'selected' : ''}" 
               data-index="${index}">
              <span>${cmd.title}</span>
              <span class="command-shortcut">${cmd.shortcut}</span>
          </div>
      `).join('');
      
      this.list.querySelectorAll('.command-item').forEach(item => {
          item.addEventListener('click', () => {
              const index = parseInt(item.dataset.index);
              this.executeCommand(commands[index]);
          });
      });
  }

  handleKeydown(e) {
      const commands = Array.from(this.list.children);
      
      switch(e.key) {
          case 'ArrowDown':
              e.preventDefault();
              this.selectedIndex = Math.min(this.selectedIndex + 1, commands.length - 1);
              break;
          case 'ArrowUp':
              e.preventDefault();
              this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
              break;
          case 'Enter':
              e.preventDefault();
              const selectedCmd = this.commands[this.selectedIndex];
              if (selectedCmd) {
                  this.executeCommand(selectedCmd);
              }
              break;
          case 'Escape':
              this.hide();
              break;
      }
      
      this.filterCommands();
  }

  executeCommand(command) {
      command.action();
      this.hide();
  }

  toggle() {
      if (this.element.classList.contains('show')) {
          this.hide();
      } else {
          this.show();
      }
  }

  show() {
      this.element.classList.add('show');
      this.input.value = '';
      this.selectedIndex = 0;
      this.filterCommands();
      this.input.focus();
  }

  hide() {
      this.element.classList.remove('show');
  }
}

// Initialize command palette
const commandPalette = new CommandPalette();