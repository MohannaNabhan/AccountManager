(function() {
  const ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 8H17V6C17 3.24 14.76 1 12 1C9.24 1 7 3.24 7 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8ZM12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17ZM15 8H9V6C9 4.34 10.34 3 12 3C13.66 3 15 4.34 15 6V8Z" fill="#3b82f6"/>
  </svg>`;

  let activeWindow = null;
  let activeTargetInput = null;
  let currentPasswordSettings = null;
  let currentUsernameSettings = null;
  
  // Drag state (persistent across opens)
  let xOffset = 0;
  let yOffset = 0;
  let isDragging = false;
  let initialX;
  let initialY;

  // Password Generation Logic (Mirroring desktop app)
  function generatePassword(settings) {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()-_=+[]{};:,.<>/?';
    const opts = {
      length: settings?.length || 15,
      includeLetters: settings?.includeLetters !== false,
      includeNumbers: settings?.includeNumbers !== false,
      includeSymbols: settings?.includeSymbols !== false,
      pattern: settings?.pattern || ''
    };

    const union = `${opts.includeLetters ? letters : ''}${opts.includeNumbers ? numbers : ''}${opts.includeSymbols ? symbols : ''}` || letters;
    const raw = (opts.pattern || '').trim();

    if (raw.length > 0) {
      let out = '';
      for (let i = 0; i < raw.length; ) {
        const ch = raw[i];
        if (ch === '{') {
          const end = raw.indexOf('}', i + 1);
          if (end === -1) { out += ch; i += 1; continue; }
          const seg = raw.slice(i + 1, end);
          if (seg.length > 0) {
            const arr = new Uint32Array(seg.length);
            crypto.getRandomValues(arr);
            for (let k = 0; k < seg.length; k++) {
              const sch = seg[k];
              let pool = '';
              if (sch === 'x') pool = union;
              else if (sch === '?') pool = letters;
              else if (sch === '$') pool = numbers;
              else if (sch === '!') pool = symbols;
              if (pool) out += pool[arr[k] % pool.length];
              else out += sch;
            }
          }
          i = end + 1;
        } else { out += ch; i += 1; }
      }
      return out;
    }

    let out = '';
    const array = new Uint32Array(opts.length);
    crypto.getRandomValues(array);
    for (let i = 0; i < opts.length; i++) {
      out += union[array[i] % union.length];
    }
    return out;
  }

  function generateUsername(settings) {
    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '_-.';
    const opts = {
      prefix: settings?.prefix || 'user',
      length: settings?.length || 6,
      includeLetters: settings?.includeLetters !== false,
      includeNumbers: settings?.includeNumbers !== false,
      includeSymbols: settings?.includeSymbols !== false,
      pattern: settings?.pattern || ''
    };

    const union = `${opts.includeLetters ? letters : ''}${opts.includeNumbers ? numbers : ''}${opts.includeSymbols ? symbols : ''}` || letters;
    const raw = (opts.pattern || '').trim();
    let core = '';

    if (raw.length > 0) {
      for (let i = 0; i < raw.length; ) {
        const ch = raw[i];
        if (ch === '{') {
          const end = raw.indexOf('}', i + 1);
          if (end === -1) { core += ch; i += 1; continue; }
          const seg = raw.slice(i + 1, end);
          if (seg.length > 0) {
            const arr = new Uint32Array(seg.length);
            crypto.getRandomValues(arr);
            for (let k = 0; k < seg.length; k++) {
              const sch = seg[k];
              let pool = '';
              if (sch === 'x') pool = union;
              else if (sch === '?') pool = letters;
              else if (sch === '$') pool = numbers;
              else if (sch === '!') pool = symbols;
              if (pool) core += pool[arr[k] % pool.length];
              else core += sch;
            }
          }
          i = end + 1;
        } else { core += ch; i += 1; }
      }
      return core;
    }

    const array = new Uint32Array(opts.length);
    crypto.getRandomValues(array);
    for (let i = 0; i < opts.length; i++) {
      core += union[array[i] % union.length];
    }
    return `${opts.prefix}-${core}`;
  }

  // Debounce for saving settings
  let saveTimeout;
  function saveSettings() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      chrome.runtime.sendMessage({ 
        type: 'SAVE_PASSWORD_SETTINGS', 
        data: currentPasswordSettings 
      });
    }, 500);
  }

  // Initialize or show the singleton window
  function showFloatingWindow(noShow = false) {
    if (activeWindow) {
      if (!noShow) {
        activeWindow.style.display = 'flex';
        activeWindow.style.opacity = '1';
      }
      return activeWindow;
    }

    const win = document.createElement('div');
    win.className = 'am-floating-window';
    win.style.cssText = `
      position: fixed !important;
      right: 40px !important;
      top: 40px !important;
      width: 240px !important;
      background: #18181b !important;
      border: 1px solid #27272a !important;
      border-radius: 12px !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      user-select: none !important;
      font-family: -apple-system, system-ui, sans-serif !important;
      animation: am-pop-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      overflow: hidden !important;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      padding: 12px 14px !important;
      background: #09090b !important;
      border-bottom: 1px solid #27272a !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      cursor: move !important;
      border-radius: 12px 12px 0 0 !important;
    `;
    header.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="font-size: 10px; font-weight: 700; color: #71717a; letter-spacing: 0.05em; text-transform: uppercase;">Account Manager</span>
        <span id="am-target-indicator" style="font-size: 9px; color: #3b82f6; font-weight: 500; display: none;">Target: <span id="am-target-name">None</span></span>
      </div>
      <div id="am-close-btn" style="cursor: pointer; color: #a1a1aa; font-size: 14px; width: 24px; height: 24px; display: flex; align-items:center; justify-content:center; border-radius: 6px; transition: background 0.2s;">✕</div>
    `;

    const content = document.createElement('div');
    content.id = 'am-window-content';
    content.style.cssText = 'padding: 8px !important; display: flex !important; flex-direction: column !important; gap: 4px !important; max-height: 450px !important; overflow-y: auto !important;';

    win.appendChild(header);
    win.appendChild(content);
    document.body.appendChild(win);
    activeWindow = win;

    // Persist position if moved
    win.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;

    // Close button logic
    const closeBtn = win.querySelector('#am-close-btn');
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.background = '#27272a');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.background = 'transparent');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearHighlight();
      win.style.display = 'none';
      activeTargetInput = null;
      updateAllIcons();
    });

    // Dragging Logic
    header.addEventListener('mousedown', (e) => {
      if (e.target === closeBtn || closeBtn.contains(e.target)) return;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        let newX = e.clientX - initialX;
        let newY = e.clientY - initialY;
        const rect = win.getBoundingClientRect();
        const winWidth = rect.width;
        const winHeight = rect.height;
        const originalLeft = window.innerWidth - 40 - winWidth;
        const originalTop = 40;
        const absoluteLeft = originalLeft + newX;
        const absoluteTop = originalTop + newY;
        if (absoluteLeft < 0) newX = -originalLeft;
        if (absoluteLeft + winWidth > window.innerWidth) newX = window.innerWidth - originalLeft - winWidth;
        if (absoluteTop < 0) newY = -originalTop;
        if (absoluteTop + winHeight > window.innerHeight) newY = window.innerHeight - originalTop - winHeight;
        xOffset = newX;
        yOffset = newY;
        win.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
      }
    });

    document.addEventListener('mouseup', () => isDragging = false);

    renderMainMenu();
    return win;
  }

  function setTargetInput(input) {
    if (!activeWindow || activeWindow.style.display === 'none') return;
    clearHighlight();
    activeTargetInput = input;
    const indicator = document.getElementById('am-target-indicator');
    const nameSpan = document.getElementById('am-target-name');
    if (activeTargetInput) {
      activeTargetInput.style.outline = '2px solid #3b82f6';
      activeTargetInput.style.outlineOffset = '2px';
      if (indicator && nameSpan) {
        indicator.style.display = 'block';
        const label = input.placeholder || input.name || input.id || 'Input field';
        nameSpan.textContent = label.length > 20 ? label.substring(0, 17) + '...' : label;
      }
    } else {
      if (indicator) indicator.style.display = 'none';
    }
  }

  function updateAllIcons() {
    document.querySelectorAll('.am-input-icon').forEach(icon => {
      if (icon.__updatePos) icon.__updatePos();
    });
  }

  function clearHighlight() {
    if (activeTargetInput) {
      activeTargetInput.style.outline = '';
      activeTargetInput.style.outlineOffset = '';
    }
  }

  function createActionBtn(icon, label, isSecondary = false) {
    const btn = document.createElement('button');
    btn.style.cssText = `
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      width: 100% !important;
      padding: 10px 12px !important;
      margin: 0 !important;
      background: ${isSecondary ? 'transparent' : 'rgba(39, 39, 42, 0.4)'} !important;
      border: 1px solid ${isSecondary ? 'transparent' : '#27272a'} !important;
      border-radius: 8px !important;
      color: #fafafa !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      text-align: left !important;
    `;
    btn.innerHTML = `<span style="font-size: 16px; opacity: 0.8; pointer-events: none;">${icon}</span> <span style="pointer-events: none;">${label}</span>`;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#27272a';
      btn.style.borderColor = '#3f3f46';
      btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = isSecondary ? 'transparent' : 'rgba(39, 39, 42, 0.4)';
      btn.style.borderColor = isSecondary ? 'transparent' : '#27272a';
      btn.style.transform = 'translateY(0)';
    });
    return btn;
  }

  function renderMainMenu() {
    if (!activeWindow) return;
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '';
    
    const options = [
      { id: 'auto-fill', label: 'Vault Emails', icon: '✉️' },
      { id: 'auto-form', label: 'Auto-Form', icon: '📝' },
      { id: 'search', label: 'Search Account App', icon: '🔍' },
      { id: 'gen-user', label: 'Gen Username', icon: '👤' },
      { id: 'gen-pass', label: 'Gen Password', icon: '🔑' }
    ];

    options.forEach(opt => {
      const btn = createActionBtn(opt.icon, opt.label);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (opt.id === 'auto-fill') renderEmailList();
        else if (opt.id === 'auto-form') renderFormCategories();
        else if (opt.id === 'search') renderAccountSearch();
        else if (opt.id === 'gen-pass') renderPasswordGenerator();
        else if (opt.id === 'gen-user') renderUsernameGenerator();
        else handleMenuAction(opt.id);
      });
      content.appendChild(btn);
    });
  }

  async function renderAccountSearch() {
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '<div style="color: #a1a1aa; font-size: 12px; padding: 24px; text-align: center;">Syncing with Vault...</div>';

    chrome.runtime.sendMessage({ type: 'GET_FORM_DATA' }, (response) => {
      content.innerHTML = '';
      const backBtn = createActionBtn('⬅️', 'Back to Tools', true);
      backBtn.style.marginBottom = '6px';
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renderMainMenu();
      });
      content.appendChild(backBtn);

      if (response?.success && response?.data?.searchData) {
        const accounts = response.data.searchData;

        const searchBox = document.createElement('div');
        searchBox.style.cssText = 'padding: 4px; position: sticky; top: 0; background: #18181b; z-index: 10; margin-bottom: 8px;';
        
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search account or project...';
        searchInput.style.cssText = 'width: 100%; background: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 10px 12px; color: #fafafa; font-size: 13px; outline: none; transition: border-color 0.2s;';
        searchInput.addEventListener('focus', () => searchInput.style.borderColor = '#3b82f6');
        searchInput.addEventListener('blur', () => searchInput.style.borderColor = '#27272a');
        
        searchBox.appendChild(searchInput);
        content.appendChild(searchBox);

        const resultsContainer = document.createElement('div');
        resultsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 6px; padding: 4px;';
        content.appendChild(resultsContainer);

        const renderResults = (term) => {
          resultsContainer.innerHTML = '';
          const filtered = accounts.filter(a => 
            (a.name || '').toLowerCase().includes(term.toLowerCase()) || 
            (a.projectName || '').toLowerCase().includes(term.toLowerCase()) ||
            (a.email || '').toLowerCase().includes(term.toLowerCase()) ||
            (a.username || '').toLowerCase().includes(term.toLowerCase())
          ).slice(0, 50);

          if (filtered.length === 0) {
            resultsContainer.innerHTML = `<div style="color: #71717a; font-size: 12px; padding: 20px; text-align: center;">No accounts found.</div>`;
            return;
          }

          filtered.forEach(acc => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(39, 39, 42, 0.4); border: 1px solid #27272a; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px; cursor: pointer; transition: all 0.2s;';
            card.innerHTML = `
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <span style="font-size: 13px; color: #fafafa; font-weight: 600;">${acc.name || 'Account'}</span>
                <span style="font-size: 10px; color: #3b82f6; background: rgba(59, 130, 246, 0.1); padding: 2px 6px; border-radius: 4px;">${acc.projectName}</span>
              </div>
              <div style="font-size: 11px; color: #a1a1aa; word-break: break-all;">${acc.email || acc.username || 'No credentials'}</div>
            `;
            
            card.addEventListener('mouseenter', () => {
              card.style.background = 'rgba(39, 39, 42, 0.8)';
              card.style.borderColor = '#3f3f46';
            });
            card.addEventListener('mouseleave', () => {
              card.style.background = 'rgba(39, 39, 42, 0.4)';
              card.style.borderColor = '#27272a';
            });

            card.addEventListener('click', () => {
              renderAccountDetails(acc);
            });

            resultsContainer.appendChild(card);
          });
        };

        searchInput.addEventListener('input', (e) => renderResults(e.target.value));
        renderResults(''); // Initial render

      } else {
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 10px;';

        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'color: #f87171; font-size: 12px; padding: 16px; text-align: center; border: 1px solid #7f1d1d; border-radius: 8px; background: rgba(127, 29, 29, 0.1);';
        errorMsg.textContent = response?.error || 'Vault is locked. Search requires an unlocked vault.';
        
        const retryBtn = createActionBtn('🔄', 'Try Again', true);
        retryBtn.style.justifyContent = 'center';
        retryBtn.style.background = 'rgba(39, 39, 42, 0.6)';
        retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          renderAccountSearch();
        });

        errorContainer.appendChild(errorMsg);
        errorContainer.appendChild(retryBtn);
        content.appendChild(errorContainer);
      }
    });
  }

  function renderAccountDetails(acc) {
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '';
    
    const backBtn = createActionBtn('⬅️', 'Back to Search', true);
    backBtn.style.marginBottom = '8px';
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderAccountSearch();
    });
    content.appendChild(backBtn);

    const detailContainer = document.createElement('div');
    detailContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 4px;';

    const fields = [
      { label: 'EMAIL / USERNAME', value: acc.email || acc.username },
      { label: 'PASSWORD', value: acc.password, isPassword: true },
      { label: 'URL', value: acc.url }
    ];

    fields.forEach(f => {
      if (!f.value) return;

      const row = document.createElement('div');
      row.style.cssText = 'background: rgba(39, 39, 42, 0.4); border: 1px solid #27272a; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px;';
      
      row.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 10px; color: #71717a; font-weight: 700; text-transform: uppercase;">${f.label}</span>
        </div>
        <div style="font-size: 13px; color: #fafafa; word-break: break-all; font-family: monospace;">${f.isPassword ? '••••••••' : f.value}</div>
      `;

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 6px; margin-top: 4px;';

      const copyBtn = createActionBtn('📋', 'Copy', false);
      copyBtn.style.padding = '6px 8px';
      copyBtn.style.fontSize = '11px';
      copyBtn.style.flex = '1';
      copyBtn.style.justifyContent = 'center';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(f.value);
        copyBtn.innerHTML = '<span>✅</span> <span>Copied!</span>';
        setTimeout(() => copyBtn.innerHTML = '<span>📋</span> <span>Copy</span>', 2000);
      });

      const fillBtn = createActionBtn('📥', 'Fill', false);
      fillBtn.style.padding = '6px 8px';
      fillBtn.style.fontSize = '11px';
      fillBtn.style.flex = '1';
      fillBtn.style.justifyContent = 'center';
      fillBtn.style.background = 'rgba(59, 130, 246, 0.1)';
      fillBtn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
      fillBtn.addEventListener('click', () => {
        if (activeTargetInput) {
          activeTargetInput.value = f.value;
          activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
          activeTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
          activeTargetInput.style.outline = '2px solid #10b981';
          setTimeout(() => { if (activeTargetInput) activeTargetInput.style.outline = '2px solid #3b82f6'; }, 1000);
        }
      });

      actions.appendChild(copyBtn);
      actions.appendChild(fillBtn);
      row.appendChild(actions);
      detailContainer.appendChild(row);
    });

    content.appendChild(detailContainer);
  }

  async function renderFormCategories() {
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '';
    
    const backBtn = createActionBtn('⬅️', 'Back to Tools', true);
    backBtn.style.marginBottom = '6px';
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      renderMainMenu();
    });
    content.appendChild(backBtn);

    const categories = [
      { id: 'personal', label: 'Personal Data', icon: '👤' },
      { id: 'address', label: 'Addresses', icon: '🏠' },
      { id: 'creditCards', label: 'Credit Cards', icon: '💳' }
    ];

    categories.forEach(cat => {
      const btn = createActionBtn(cat.icon, cat.label);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renderCategoryList(cat.id, cat.label);
      });
      content.appendChild(btn);
    });
  }

  async function renderCategoryList(type, title) {
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '<div style="color: #a1a1aa; font-size: 12px; padding: 24px; text-align: center;">Syncing with Vault...</div>';
    
    chrome.runtime.sendMessage({ type: 'GET_FORM_DATA' }, (response) => {
      content.innerHTML = '';
      const backBtn = createActionBtn('⬅️', `Go Back`, true);
      backBtn.style.marginBottom = '6px';
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renderFormCategories();
      });
      content.appendChild(backBtn);

      if (response?.success && response?.data) {
        let items = [];
        if (type === 'personal') {
          if (response.data.personal && Object.keys(response.data.personal).length > 0) {
            items = [response.data.personal];
          }
        } else if (type === 'address') {
          items = response.data.addresses || [];
        } else {
          items = response.data[type] || [];
        }

        if (items.length === 0) {
          const emptyMsg = document.createElement('div');
          emptyMsg.style.cssText = 'color: #71717a; font-size: 12px; padding: 30px 20px; text-align: center; background: rgba(39, 39, 42, 0.2); border-radius: 8px; border: 1px dashed #27272a; margin-top: 10px;';
          emptyMsg.innerHTML = `<div>📭</div><div style="margin-top: 8px;">No ${title} found in your vault.</div>`;
          content.appendChild(emptyMsg);
          return;
        }

        items.forEach(item => {
          const btn = createActionBtn('📄', item.name || 'Personal Profile');
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            renderProfileDetails(item, type);
          });
          content.appendChild(btn);
        });
      } else {
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 10px;';

        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'color: #f87171; font-size: 12px; padding: 16px; text-align: center; border: 1px solid #7f1d1d; border-radius: 8px; background: rgba(127, 29, 29, 0.1);';
        errorMsg.textContent = response?.error || 'Vault is locked or unreachable. Please check the app.';
        
        const retryBtn = createActionBtn('🔄', 'Try Again', true);
        retryBtn.style.justifyContent = 'center';
        retryBtn.style.background = 'rgba(39, 39, 42, 0.6)';
        retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          renderCategoryList(type, title);
        });

        errorContainer.appendChild(errorMsg);
        errorContainer.appendChild(retryBtn);
        content.appendChild(errorContainer);
      }
    });
  }

  function renderProfileDetails(profile, type) {
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '';
    
    const backBtn = createActionBtn('⬅️', 'Back to List', true);
    backBtn.style.marginBottom = '8px';
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const title = type === 'personal' ? 'Personal Data' : type === 'address' ? 'Addresses' : 'Credit Cards';
      renderCategoryList(type, title);
    });
    content.appendChild(backBtn);

    const detailContainer = document.createElement('div');
    detailContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 4px;';

    // Map profiles fields to readable labels
    const fieldMapping = {
      // Personal
      firstName: 'First Name',
      lastName: 'Last Name',
      phonePrefix: 'Phone Prefix (+XX)',
      phoneNumber: 'Phone Number',
      // Address
      street: 'Street',
      houseNumber: 'House Number',
      city: 'City',
      state: 'State',
      zipCode: 'ZIP Code',
      country: 'Country',
      // Credit Card
      cardNumber: 'Card Number',
      expiryDate: 'Expiry (MM/YY)',
      cvv: 'CVV',
      cardHolder: 'Holder Name'
    };

    let fieldsRendered = 0;
    Object.keys(profile).forEach(key => {
      if (['id', 'name', 'projectId'].includes(key)) return;
      const val = profile[key];
      if (!val) return;

      fieldsRendered++;
      const fieldRow = document.createElement('div');
      fieldRow.style.cssText = 'background: rgba(39, 39, 42, 0.4); border: 1px solid #27272a; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px;';
      
      const label = fieldMapping[key] || key.charAt(0).toUpperCase() + key.slice(1);
      
      fieldRow.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: #71717a; font-weight: 600; text-transform: uppercase;">${label}</span>
        </div>
        <div style="font-size: 13px; color: #fafafa; word-break: break-all; font-family: monospace;">${val}</div>
      `;

      const insertBtn = createActionBtn('📥', 'Insert', false);
      insertBtn.style.padding = '6px 10px';
      insertBtn.style.fontSize = '11px';
      insertBtn.style.marginTop = '4px';
      insertBtn.style.background = 'rgba(59, 130, 246, 0.1)';
      insertBtn.style.borderColor = 'rgba(59, 130, 246, 0.3)';
      insertBtn.style.justifyContent = 'center';

      insertBtn.addEventListener('click', () => {
        if (activeTargetInput) {
          activeTargetInput.value = val;
          activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
          activeTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
          activeTargetInput.style.outline = '2px solid #10b981';
          setTimeout(() => { if (activeTargetInput) activeTargetInput.style.outline = '2px solid #3b82f6'; }, 1000);
        }
      });

      fieldRow.appendChild(insertBtn);
      detailContainer.appendChild(fieldRow);
    });

    if (fieldsRendered === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'color: #71717a; font-size: 12px; padding: 30px; text-align: center;';
      emptyMsg.textContent = 'No detailed fields found for this profile.';
      detailContainer.appendChild(emptyMsg);
    }

    content.appendChild(detailContainer);
  }

  async function renderUsernameGenerator() {
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '<div style="color: #a1a1aa; font-size: 12px; padding: 24px; text-align: center;">Loading settings...</div>';

    chrome.runtime.sendMessage({ type: 'GET_FORM_DATA' }, (response) => {
      content.innerHTML = '';
      const backBtn = createActionBtn('⬅️', 'Back to Tools', true);
      backBtn.style.marginBottom = '6px';
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renderMainMenu();
      });
      content.appendChild(backBtn);

      if (response && response.success && response.data) {
        currentUsernameSettings = response.data.usernameSettings || {
          prefix: 'user',
          length: 6,
          includeNumbers: true,
          includeLetters: true,
          includeSymbols: false,
          pattern: ''
        };

        const genContainer = document.createElement('div');
        genContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; padding: 4px;';

        const resultDisplay = document.createElement('div');
        resultDisplay.style.cssText = `
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 12px;
          color: #3b82f6;
          font-family: monospace;
          font-size: 14px;
          word-break: break-all;
          text-align: center;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        `;
        resultDisplay.title = 'Click to fill field';
        
        const updateResult = () => {
          const user = generateUsername(currentUsernameSettings);
          resultDisplay.textContent = user;
        };

        updateResult();

        const fillAction = () => {
          if (activeTargetInput) {
            activeTargetInput.value = resultDisplay.textContent;
            activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
            activeTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
            activeTargetInput.style.outline = '2px solid #10b981';
            setTimeout(() => { if (activeTargetInput) activeTargetInput.style.outline = '2px solid #3b82f6'; }, 1000);
          }
        };

        resultDisplay.addEventListener('click', fillAction);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

        const insertBtn = createActionBtn('📥', 'Insert Username', false);
        insertBtn.style.justifyContent = 'center';
        insertBtn.style.background = 'rgba(59, 130, 246, 0.2)';
        insertBtn.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        insertBtn.addEventListener('click', fillAction);

        const regenBtn = createActionBtn('🔄', 'Regenerate', false);
        regenBtn.style.justifyContent = 'center';
        regenBtn.addEventListener('click', updateResult);

        btnRow.appendChild(insertBtn);
        btnRow.appendChild(regenBtn);

        const controls = document.createElement('div');
        controls.style.cssText = 'display: flex; flex-direction: column; gap: 8px; background: rgba(39, 39, 42, 0.2); padding: 10px; border-radius: 8px; border: 1px solid #27272a;';

        const createToggle = (label, key) => {
          const row = document.createElement('label');
          row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 12px; color: #a1a1aa;';
          row.innerHTML = `<span>${label}</span><input type="checkbox" ${currentUsernameSettings[key] ? 'checked' : ''} style="accent-color: #3b82f6;">`;
          row.querySelector('input').addEventListener('change', (e) => {
            currentUsernameSettings[key] = e.target.checked;
            updateResult();
          });
          return row;
        };

        const prefixRow = document.createElement('div');
        prefixRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        prefixRow.innerHTML = `
          <span style="font-size: 11px; color: #71717a;">Prefix</span>
          <input id="user-prefix-input" type="text" value="${currentUsernameSettings.prefix || ''}" 
            style="width: 100%; background: #09090b; border: 1px solid #27272a; border-radius: 6px; padding: 6px 8px; color: #fafafa; font-size: 11px; outline: none;">
        `;
        prefixRow.querySelector('input').addEventListener('input', (e) => {
          currentUsernameSettings.prefix = e.target.value;
          updateResult();
        });

        const lengthRow = document.createElement('div');
        lengthRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #a1a1aa;';
        lengthRow.innerHTML = `<span>Length: <span id="user-len-val">${currentUsernameSettings.length}</span></span><input id="user-len-slider" type="range" min="3" max="32" value="${currentUsernameSettings.length}" style="width: 100px; accent-color: #3b82f6;">`;
        
        const sliderInput = lengthRow.querySelector('#user-len-slider');
        sliderInput.addEventListener('input', (e) => {
          currentUsernameSettings.length = parseInt(e.target.value);
          lengthRow.querySelector('#user-len-val').textContent = e.target.value;
          updateResult();
        });

        const templateRow = document.createElement('div');
        templateRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        templateRow.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #71717a;">Pattern / Template</span>
          </div>
          <input id="user-template-input" type="text" value="${currentUsernameSettings.pattern || ''}" 
            placeholder="{user-xxxx}" 
            style="width: 100%; background: #09090b; border: 1px solid #27272a; border-radius: 6px; padding: 6px 8px; color: #fafafa; font-size: 11px; font-family: monospace; outline: none;">
        `;
        
        const templateInput = templateRow.querySelector('#user-template-input');
        
        if (currentUsernameSettings.pattern && currentUsernameSettings.pattern.trim().length > 0) {
          sliderInput.disabled = true;
          sliderInput.style.opacity = '0.5';
        }

        templateInput.addEventListener('input', (e) => {
          currentUsernameSettings.pattern = e.target.value;
          sliderInput.disabled = e.target.value.trim().length > 0;
          sliderInput.style.opacity = sliderInput.disabled ? '0.5' : '1';
          updateResult();
        });

        controls.appendChild(prefixRow);
        controls.appendChild(lengthRow);
        controls.appendChild(createToggle('Include Letters', 'includeLetters'));
        controls.appendChild(createToggle('Include Numbers', 'includeNumbers'));
        controls.appendChild(createToggle('Include Symbols', 'includeSymbols'));
        controls.appendChild(templateRow);

        genContainer.appendChild(resultDisplay);
        genContainer.appendChild(btnRow);
        genContainer.appendChild(controls);
        content.appendChild(genContainer);
      } else {
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 10px;';

        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'color: #f87171; font-size: 12px; padding: 16px; text-align: center; border: 1px solid #7f1d1d; border-radius: 8px; background: rgba(127, 29, 29, 0.1);';
        errorMsg.textContent = response?.error || 'Error loading settings.';
        
        const retryBtn = createActionBtn('🔄', 'Try Again', true);
        retryBtn.style.justifyContent = 'center';
        retryBtn.style.background = 'rgba(39, 39, 42, 0.6)';
        retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          renderUsernameGenerator();
        });

        errorContainer.appendChild(errorMsg);
        errorContainer.appendChild(retryBtn);
        content.appendChild(errorContainer);
      }
    });
  }

  async function renderPasswordGenerator() {
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '<div style="color: #a1a1aa; font-size: 12px; padding: 24px; text-align: center;">Loading settings...</div>';

    chrome.runtime.sendMessage({ type: 'GET_FORM_DATA' }, (response) => {
      content.innerHTML = '';
      const backBtn = createActionBtn('⬅️', 'Back to Tools', true);
      backBtn.style.marginBottom = '6px';
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renderMainMenu();
      });
      content.appendChild(backBtn);

      if (response && response.success && response.data) {
        currentPasswordSettings = response.data.passwordSettings || {
          length: 15,
          includeNumbers: true,
          includeLetters: true,
          includeSymbols: true,
          pattern: ''
        };

        const genContainer = document.createElement('div');
        genContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; padding: 4px;';

        const resultDisplay = document.createElement('div');
        resultDisplay.style.cssText = `
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 12px;
          color: #3b82f6;
          font-family: monospace;
          font-size: 14px;
          word-break: break-all;
          text-align: center;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        `;
        resultDisplay.title = 'Click to fill field';
        
        const updateResult = () => {
          const pwd = generatePassword(currentPasswordSettings);
          resultDisplay.textContent = pwd;
        };

        updateResult();

        resultDisplay.addEventListener('click', () => {
          if (activeTargetInput) {
            activeTargetInput.value = resultDisplay.textContent;
            activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
            activeTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
            activeTargetInput.style.outline = '2px solid #10b981';
            setTimeout(() => { if (activeTargetInput) activeTargetInput.style.outline = '2px solid #3b82f6'; }, 1000);
          }
        });

        const controls = document.createElement('div');
        controls.style.cssText = 'display: flex; flex-direction: column; gap: 8px; background: rgba(39, 39, 42, 0.2); padding: 10px; border-radius: 8px; border: 1px solid #27272a;';

        const createToggle = (label, key) => {
          const row = document.createElement('label');
          row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 12px; color: #a1a1aa;';
          row.innerHTML = `<span>${label}</span><input type="checkbox" ${currentPasswordSettings[key] ? 'checked' : ''} style="accent-color: #3b82f6;">`;
          row.querySelector('input').addEventListener('change', (e) => {
            currentPasswordSettings[key] = e.target.checked;
            updateResult();
          });
          return row;
        };

        const lengthRow = document.createElement('div');
        lengthRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #a1a1aa;';
        lengthRow.innerHTML = `<span>Length: <span id="pwd-len-val">${currentPasswordSettings.length}</span></span><input id="pwd-len-slider" type="range" min="6" max="64" value="${currentPasswordSettings.length}" style="width: 100px; accent-color: #3b82f6;">`;
        
        const sliderInput = lengthRow.querySelector('#pwd-len-slider');
        sliderInput.addEventListener('input', (e) => {
          currentPasswordSettings.length = parseInt(e.target.value);
          lengthRow.querySelector('#pwd-len-val').textContent = e.target.value;
          updateResult();
        });

        const templateRow = document.createElement('div');
        templateRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        templateRow.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 11px; color: #71717a;">Pattern / Template</span>
            <span style="font-size: 9px; color: #3b82f6; cursor: help;" title="x=any, ?=letter, $=number, !=symbol. Use {brackets}.">Help?</span>
          </div>
          <input id="pwd-template-input" type="text" value="${currentPasswordSettings.pattern || ''}" 
            placeholder="{example-xxxx}" 
            style="width: 100%; background: #09090b; border: 1px solid #27272a; border-radius: 6px; padding: 6px 8px; color: #fafafa; font-size: 11px; font-family: monospace; outline: none;">
        `;
        
        const templateInput = templateRow.querySelector('#pwd-template-input');
        
        // Initial state for slider
        if (currentPasswordSettings.pattern && currentPasswordSettings.pattern.trim().length > 0) {
          sliderInput.disabled = true;
          sliderInput.style.opacity = '0.5';
        }

        templateInput.addEventListener('input', (e) => {
          currentPasswordSettings.pattern = e.target.value;
          sliderInput.disabled = e.target.value.trim().length > 0;
          sliderInput.style.opacity = sliderInput.disabled ? '0.5' : '1';
          updateResult();
        });

        controls.appendChild(lengthRow);
        controls.appendChild(createToggle('Include Letters', 'includeLetters'));
        controls.appendChild(createToggle('Include Numbers', 'includeNumbers'));
        controls.appendChild(createToggle('Include Symbols', 'includeSymbols'));
        controls.appendChild(templateRow);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

        const regenBtn = createActionBtn('🔄', 'Regenerate', false);
        regenBtn.style.justifyContent = 'center';
        regenBtn.addEventListener('click', updateResult);

        const fillAction = () => {
          if (activeTargetInput) {
            activeTargetInput.value = resultDisplay.textContent;
            activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
            activeTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
            activeTargetInput.style.outline = '2px solid #10b981';
            setTimeout(() => { if (activeTargetInput) activeTargetInput.style.outline = '2px solid #3b82f6'; }, 1000);
          }
        };

        const insertBtn = createActionBtn('📥', 'Insert Password', false);
        insertBtn.style.justifyContent = 'center';
        insertBtn.style.background = 'rgba(59, 130, 246, 0.2)';
        insertBtn.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        insertBtn.addEventListener('click', fillAction);

        btnRow.appendChild(insertBtn);
        btnRow.appendChild(regenBtn);

        resultDisplay.addEventListener('click', fillAction);

        genContainer.appendChild(resultDisplay);
        genContainer.appendChild(btnRow);
        genContainer.appendChild(controls);
        content.appendChild(genContainer);
      } else {
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 10px;';

        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'color: #f87171; font-size: 12px; padding: 16px; text-align: center; border: 1px solid #7f1d1d; border-radius: 8px; background: rgba(127, 29, 29, 0.1);';
        errorMsg.textContent = response?.error || 'Error loading settings. Verify vault status.';
        
        const retryBtn = createActionBtn('🔄', 'Try Again', true);
        retryBtn.style.justifyContent = 'center';
        retryBtn.style.background = 'rgba(39, 39, 42, 0.6)';
        retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          renderPasswordGenerator();
        });

        errorContainer.appendChild(errorMsg);
        errorContainer.appendChild(retryBtn);
        content.appendChild(errorContainer);
      }
    });
  }

  async function renderEmailList() {
    const content = activeWindow.querySelector('#am-window-content');
    content.innerHTML = '<div style="color: #a1a1aa; font-size: 12px; padding: 24px; text-align: center;">Syncing with Vault...</div>';
    
    chrome.runtime.sendMessage({ type: 'GET_FORM_DATA' }, (response) => {
      content.innerHTML = '';
      const backBtn = createActionBtn('⬅️', 'Back to Tools', true);
      backBtn.style.marginBottom = '6px';
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renderMainMenu();
      });
      content.appendChild(backBtn);

      if (response && response.success && response.data) {
        const emails = response.data.emails || [];
        if (emails.length === 0) {
          content.innerHTML += '<div style="color: #71717a; font-size: 12px; padding: 20px; text-align: center;">No emails configured.</div>';
          return;
        }

        emails.forEach(item => {
          const btn = document.createElement('button');
          btn.style.cssText = `
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            padding: 10px 12px !important;
            background: rgba(39, 39, 42, 0.4) !important;
            border: 1px solid #27272a !important;
            border-radius: 8px !important;
            color: #fafafa !important;
            cursor: pointer !important;
            transition: all 0.2s !important;
            text-align: left !important;
            gap: 2px !important;
            margin-bottom: 4px !important;
          `;
          btn.innerHTML = `
            <div style="font-size: 13px; font-weight: 600; color: #fafafa; pointer-events: none;">${item.name || 'Undefined Profile'}</div>
            <div style="font-size: 11px; color: #a1a1aa; pointer-events: none;">${item.email}</div>
          `;
          btn.addEventListener('mouseenter', () => { btn.style.background = '#27272a'; btn.style.borderColor = '#3b82f6'; });
          btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(39, 39, 42, 0.4)'; btn.style.borderColor = '#27272a'; });
          btn.addEventListener('click', () => {
            if (activeTargetInput && document.body.contains(activeTargetInput)) {
              activeTargetInput.value = item.email;
              activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
              activeTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
              activeTargetInput.style.outline = '2px solid #10b981';
              setTimeout(() => { if (activeTargetInput) activeTargetInput.style.outline = '2px solid #3b82f6'; }, 1000);
            }
          });
          content.appendChild(btn);
        });
      } else {
        const errorContainer = document.createElement('div');
        errorContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 10px;';

        const errorMsg = document.createElement('div');
        errorMsg.style.cssText = 'color: #f87171; font-size: 12px; padding: 16px; text-align: center; border: 1px solid #7f1d1d; border-radius: 8px; background: rgba(127, 29, 29, 0.1);';
        errorMsg.textContent = response?.error || 'Account Manager is locked.';
        
        const retryBtn = createActionBtn('🔄', 'Try Again', true);
        retryBtn.style.justifyContent = 'center';
        retryBtn.style.background = 'rgba(39, 39, 42, 0.6)';
        retryBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          renderEmailList();
        });

        errorContainer.appendChild(errorMsg);
        errorContainer.appendChild(retryBtn);
        content.appendChild(errorContainer);
      }
    });
  }

  function handleMenuAction(action) {
    chrome.runtime.sendMessage({ action: 'MENU_ACTION', type: action, field: activeTargetInput?.id || 'target' });
    if (action === 'search') chrome.runtime.sendMessage({ action: 'openApp' });
  }

  // Inject Base Animations
  const style = document.createElement('style');
  style.textContent = `@keyframes am-pop-in { from { opacity: 0; transform: scale(0.96) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }`;
  document.head.appendChild(style);

  function injectIcon(input) {
    if (input.dataset.amAttached) return;
    
    // Ignore inputs inside our own window
    if (input.closest('.am-floating-window')) return;

    const type = input.type.toLowerCase();
    const excluded = ['hidden', 'submit', 'button', 'checkbox', 'radio', 'file', 'range', 'color'];
    if (excluded.includes(type)) return;
    input.dataset.amAttached = "true";
    input.addEventListener('focus', () => setTargetInput(input));
    input.addEventListener('mousedown', () => setTargetInput(input));
    input.addEventListener('click', () => setTargetInput(input));

    const icon = document.createElement('div');
    icon.className = 'am-input-icon';
    icon.innerHTML = ICON_SVG;
    icon.style.cssText = `position: absolute !important; cursor: pointer !important; z-index: 2147483645 !important; display: flex !important; align-items: center !important; justify-content: center !important; width: 24px !important; height: 24px !important; transition: all 0.2s !important; opacity: 0.5 !important; background: transparent !important;`;

    function updatePosition() {
      if (!input || !document.body.contains(input)) { icon.remove(); return; }
      if (activeWindow && activeWindow.style.display !== 'none') { icon.style.display = 'none'; return; }
      const rect = input.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(input).display === 'none') { icon.style.display = 'none'; return; }
      icon.style.display = 'flex';
      icon.style.top = (window.scrollY + rect.top + (rect.height / 2) - 12) + 'px';
      icon.style.left = (window.scrollX + rect.right - 28) + 'px';
    }

    icon.__updatePos = updatePosition;
    icon.addEventListener('mouseenter', () => { icon.style.opacity = '1'; icon.style.transform = 'scale(1.1)'; });
    icon.addEventListener('mouseleave', () => { icon.style.opacity = '0.5'; icon.style.transform = 'scale(1)'; });
    icon.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const win = showFloatingWindow(true);
      win.style.opacity = '0';
      win.style.display = 'flex';
      setTargetInput(input);
      const iconRect = icon.getBoundingClientRect();
      const winRect = win.getBoundingClientRect();
      const winWidth = winRect.width || 240;
      const winHeight = winRect.height || 400;
      let targetLeft = iconRect.left - winWidth - 10;
      let targetTop = iconRect.top;
      if (targetLeft < 10) targetLeft = iconRect.right + 10;
      if (targetLeft + winWidth > window.innerWidth - 10) targetLeft = window.innerWidth - winWidth - 10;
      if (targetTop + winHeight > window.innerHeight - 10) targetTop = window.innerHeight - winHeight - 10;
      if (targetTop < 10) targetTop = 10;
      const originalLeft = window.innerWidth - 40 - winWidth;
      const originalTop = 40;
      xOffset = targetLeft - originalLeft;
      yOffset = targetTop - originalTop;
      win.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
      requestAnimationFrame(() => { win.style.opacity = '1'; updateAllIcons(); });
    });

    document.body.appendChild(icon);
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);
    updatePosition();
    const posObserver = new MutationObserver(updatePosition);
    posObserver.observe(input, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  function scan() { document.querySelectorAll('input:not([data-am-attached])').forEach(injectIcon); }
  const domObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          if (node.tagName === 'INPUT') injectIcon(node);
          else node.querySelectorAll('input').forEach(injectIcon);
        }
      }
    }
  });

  domObserver.observe(document.documentElement, { childList: true, subtree: true });
  scan();
  setTimeout(scan, 1000);
  setInterval(scan, 5000);
})();