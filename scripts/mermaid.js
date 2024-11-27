const updateMermaidConfig = () => {
  const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
  mermaid.initialize({
    startOnLoad: true,
    theme: isLightTheme ? 'neutral' : 'dark',
    securityLevel: 'loose',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: 16,
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      nodeSpacing: 50,
      rankSpacing: 50,
      padding: 15,
      useMaxWidth: true,
      labelBackground: isLightTheme ? '#f5f5f5' : '#2d2d2d'
    }
  });
};

// Initial configuration
updateMermaidConfig();

// Update Mermaid config when theme changes
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === 'data-theme') {
      updateMermaidConfig();
      // Reinitialize all diagrams
      document.querySelectorAll('.mermaid').forEach(el => {
        const content = el.textContent;
        el.textContent = content;
        mermaid.init(undefined, el);
      });
    }
  });
});

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme']
});
