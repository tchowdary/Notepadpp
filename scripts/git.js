// Add GitHub integration code to existing JavaScript
class GitHubIntegration {
  constructor() {
    this.syncInterval = 30 * 60 * 1000; // 30 minutes
    this.pendingChanges = new Set();
    this.status = 'disconnected';
    this.setupUI();
    this.loadSettings();
    this.startSyncInterval();
  }

  setupUI() {
    // Add GitHub status to status bar
    const statusBar = document.querySelector('.status-bar');
    const githubStatus = document.createElement('div');
    githubStatus.className = 'github-status';
    githubStatus.innerHTML = `
          <span class="github-indicator disconnected"></span>
          <span>GitHub: Disconnected</span>
      `;
    statusBar.appendChild(githubStatus);

    // Add GitHub sync button to toolbar
    const toolbar = document.querySelector('.toolbar');
    const syncButton = document.createElement('button');
    syncButton.className = 'github-sync-btn';
    syncButton.title = 'Sync with GitHub';
    syncButton.innerHTML = `
          <svg viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
          </svg>
      `;
    syncButton.onclick = () => this.manualSync();
    toolbar.appendChild(syncButton);
  }

  loadSettings() {
    this.settings = {
      token: localStorage.getItem('github_token'),
      repo: localStorage.getItem('github_repo'),
      branch: localStorage.getItem('github_branch') || 'main'
    };
    this.updateStatus();
  }

  updateStatus(newStatus = null) {
    if (newStatus) this.status = newStatus;

    const indicator = document.querySelector('.github-indicator');
    const statusText = document.querySelector('.github-status span:last-child');
    const syncButton = document.querySelector('.github-sync-btn');

    indicator.className = `github-indicator ${this.status}`;
    statusText.textContent = `GitHub: ${this.status.charAt(0).toUpperCase() + this.status.slice(1)}`;

    if (this.settings.token && this.settings.repo) {
      syncButton.classList.add('enabled');
    } else {
      syncButton.classList.remove('enabled');
    }
  }

  async manualSync() {
    if (this.status === 'syncing') return;
    await this.syncFiles();
  }

  async syncFiles() {
    if (!this.settings.token || !this.settings.repo) return;

    this.updateStatus('syncing');

    try {
      const filesToSync = Array.from(tabs)
        .filter(tab => tab.tab.name !== 'Untitled.md' && tab.tab.editor.value.trim());

      for (const tab of filesToSync) {
        const path = this.getFilePath(tab.tab.name);
        await this.uploadFile(path, tab.tab.editor.value);
      }

      this.showNotification('Files synced successfully!');
      this.updateStatus('connected');
    } catch (error) {
      console.error('Sync failed:', error);
      this.showNotification('Sync failed: ' + error.message, true);
      this.updateStatus('disconnected');
    }
  }

  getFilePath(filename) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    // Keep original extension if it exists
    const extension = filename.includes('.') ? '' : '.md';
    const finalFilename = filename + extension;
    return `${year}/${month}/${finalFilename}`;
  }


  async uploadFile(path, content) {
    const apiUrl = `https://api.github.com/repos/${this.settings.repo}/contents/${path}`;

    // First check if file exists
    let existingFile;
    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${this.settings.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (response.ok) {
        existingFile = await response.json();
      }
    } catch (error) {
      // File doesn't exist, continue with creation
    }

    const body = {
      message: `Update ${path}`,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: this.settings.branch
    };

    if (existingFile) {
      body.sha = existingFile.sha;
    }

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${this.settings.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
  }

  showNotification(message, isError = false) {
    const notification = document.querySelector('.sync-notification');
    notification.textContent = message;
    notification.style.display = 'block';
    notification.style.backgroundColor = isError ? '#dc3545' : 'var(--toolbar-bg)';

    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }

  startSyncInterval() {
    setInterval(() => this.syncFiles(), this.syncInterval);
  }
}

// GitHub settings modal functions
function openGitHubSettings() {
  document.querySelector('.modal-backdrop').style.display = 'block';
  document.querySelector('.github-settings-modal').style.display = 'block';

  // Load current settings
  document.getElementById('githubToken').value = localStorage.getItem('github_token') || '';
  document.getElementById('githubRepo').value = localStorage.getItem('github_repo') || '';
  document.getElementById('githubBranch').value = localStorage.getItem('github_branch') || 'main';
}

function closeGitHubSettings() {
  document.querySelector('.modal-backdrop').style.display = 'none';
  document.querySelector('.github-settings-modal').style.display = 'none';
}

function saveGitHubSettings() {
  const token = document.getElementById('githubToken').value;
  const repo = document.getElementById('githubRepo').value;
  const branch = document.getElementById('githubBranch').value || 'main';

  localStorage.setItem('github_token', token);
  localStorage.setItem('github_repo', repo);
  localStorage.setItem('github_branch', branch);

  closeGitHubSettings();
  github.loadSettings();
}

// Initialize GitHub integration
let github;
document.addEventListener('DOMContentLoaded', () => {
  github = new GitHubIntegration();
});