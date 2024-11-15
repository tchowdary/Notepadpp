# Advanced Web Notepad

A feature-rich, browser-based text editor with modern capabilities and a clean interface. Built with vanilla JavaScript and designed for both casual users and developers.

## Features

### Core Functionality
- **Multi-tab Support**: Create and manage multiple documents simultaneously
- **Auto-save**: All changes are automatically saved to browser's local storage
- **Line Numbers**: Dynamic line numbering with automatic updates
- **Status Bar**: Shows current cursor position (line and column) and selection info
- **Word Wrap**: Toggle word wrapping for better text visibility
- **Theme Support**: Switch between light and dark themes

### File Operations
- **New File**: Create new documents in separate tabs
- **Open File**: Import existing text files from your computer
- **Save**: Automatically saves to browser storage
- **Download**: Export your documents as text files
- **Close Tab**: Close unwanted tabs (preserves at least one tab)

### Developer Tools
- **JSON Formatting**: Automatically format and validate JSON content
- **Timestamp Conversion**: Convert Unix timestamps to human-readable dates
- **Tab Indentation**: Smart tab handling with 4-space indentation
- **Text Selection Info**: Shows character count and word count for selected text

### AI-Powered Features
- **Text Improvement**: Integrate with Claude AI to improve selected text
- **Automatic Clipboard Copy**: Improved text is automatically copied to clipboard
- **API Key Management**: Securely store and manage your Anthropic API key

### User Interface
- **Selection Popup**: Context-sensitive popup menu for selected text
- **Error Notifications**: Temporary error messages with automatic dismissal
- **Custom Scrollbars**: Styled scrollbars for better visual integration
- **Responsive Design**: Works well on different screen sizes

### Keyboard Shortcuts
- `Ctrl + W`: Close current tab
- `Escape`: Clear editor content
- `Tab`: Insert 4 spaces for indentation
- Double-click tabs area to create new tab

## Technical Features

### Storage
- **Local Storage**: 
  - Saves all document content
  - Preserves theme preference
  - Stores API keys securely
  - Maintains word wrap settings

### Editor Capabilities
- **Unicode Support**: Full Unicode text handling
- **Large File Handling**: Efficiently handles large text files
- **Syntax Highlighting**: Basic syntax highlighting for code
- **Custom Font**: Uses JetBrains Mono for better code readability

### Performance
- **Efficient DOM Updates**: Optimized line number rendering
- **Lazy Loading**: Tabs load content only when activated
- **Memory Management**: Proper cleanup of closed tabs

## Integration Features

### Claude AI Integration
- **Text Improvement**: Direct integration with Claude AI
- **Smart Formatting**: Removes unnecessary formatting from AI responses
- **Error Handling**: Graceful handling of API errors
- **Automatic Clipboard Copy**: Copies improved text automatically

### Security
- **API Key Storage**: Secure local storage of API keys
- **No External Dependencies**: Self-contained application
- **Content Isolation**: Each tab maintains its own state

## Technical Requirements
- Modern web browser with JavaScript enabled
- Local storage access
- Clipboard API support
- Internet connection (for AI features)

## Setup
1. Clone or download the HTML file
2. Open in a modern web browser
3. For AI features, set up your Anthropic API key:
   - Click the key icon in the toolbar
   - Enter your API key when prompted
   - The key will be saved for future sessions

## Usage Tips
1. **Multiple Documents**: Use tabs to manage multiple documents
2. **Auto-save**: Your work is automatically saved
3. **Text Improvement**:
   - Select text to improve
   - Click the improve button or use selection popup
   - Wait for AI processing
   - Improved text is automatically copied to clipboard
4. **JSON Formatting**:
   - Paste JSON content
   - Click format button
   - Invalid JSON will show error message

## Limitations
- Relies on browser local storage (limited storage space)
- AI features require internet connection
- API key required for Claude AI integration
- Single file size limited by browser memory

## Future Development
- File system API integration
- Additional text processing tools
- Extended keyboard shortcuts
- Syntax highlighting for more languages
- Collaborative editing features
- Export to different file formats
- Search and replace functionality
- Custom theme creation

## Contributing
Feel free to fork and improve the application. Key areas for contribution:
- Additional text processing tools
- Enhanced syntax highlighting
- Performance optimizations
- Mobile responsiveness
- Accessibility improvements
- Additional export formats

## License
Open source - feel free to modify and distribute while maintaining attribution.
