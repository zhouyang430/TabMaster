class FloatingOrb {
  constructor() {
    this.orb = null;
    this.panel = null;
    this.config = {};
    this.tabs = [];
    this.categories = [];
    this.hoverTimeout = null;
    this.hideTimeout = null;
    this.isDragging = false;
    this.isPanelOpen = false;
    this.searchQuery = '';
    this.selectedCategory = 'all';
    this.tabCount = 0;
    this.init();
  }

  async init() {
    await this.loadConfig();
    await this.loadTabs();
    await this.loadCategories();
    this.createOrb();
    this.createPanel();
    this.createToast();
    this.setupEventListeners();
    this.updateOrbCount();
  }

  async loadConfig() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'getConfig' }, config => {
        this.config = config;
        resolve();
      });
    });
  }

  async loadTabs() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'getTabs' }, tabs => {
        this.tabs = tabs.filter(t => !t.incognito);
        this.tabCount = this.tabs.length;
        resolve();
      });
    });
  }

  async loadCategories() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'getCategories' }, categories => {
        this.categories = categories;
        resolve();
      });
    });
  }

  createOrb() {
    this.orb = document.createElement('div');
    this.orb.id = 'tabmaster-orb';
    this.orb.className = 'tabmaster-orb';
    
    const orbContent = document.createElement('div');
    orbContent.className = 'tabmaster-orb-content';
    this.countBadge = document.createElement('span');
    this.countBadge.className = 'tabmaster-orb-count';
    orbContent.appendChild(this.countBadge);
    this.orb.appendChild(orbContent);

    this.updateOrbStyle();
    document.body.appendChild(this.orb);
  }

  updateOrbStyle() {
    const size = this.config.orbSize || 56;
    const opacity = (this.config.orbOpacity || 80) / 100;
    
    this.orb.style.width = `${size}px`;
    this.orb.style.height = `${size}px`;
    this.orb.style.opacity = opacity;
    
    if (this.config.orbPosition && this.config.orbPosition.x !== 'auto') {
      this.orb.style.right = 'auto';
      this.orb.style.left = `${this.config.orbPosition.x}px`;
    }
    if (this.config.orbPosition && this.config.orbPosition.y !== 'auto') {
      this.orb.style.bottom = `${window.innerHeight - this.config.orbPosition.y - size}px`;
    }
  }

  updateOrbCount() {
    this.countBadge.textContent = this.tabCount > 99 ? '99+' : this.tabCount;
  }

  getIconSvg(iconName) {
    const icons = {
      'brain': '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
      'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
      'table': '<path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M9 3v18"/>',
      'code': '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
      'terminal': '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
      'palette': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09a1.65 1.65 0 0 0-1.51-1 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51 1 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H9a1.65 1.65 0 0 0 1-1.51V13a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2-2 2 2 0 0 1-2-2h-.09a1.65 1.65 0 0 0-1.51-1z"/>',
      'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
      'globe': '<circle cx="12" cy="12" r="10"/><line x1="21.17" y1="8" x2="12" y2="12"/><line x1="3.95" y1="6.06" x2="12" y2="12"/><line x1="12" y1="12" x2="12" y2="24"/><line x1="8" y1="21.17" x2="12" y2="12"/><line x1="16" y1="21.17" x2="12" y2="12"/>',
      'more-horizontal': '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
      'layout': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      'default': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
    };
    return icons[iconName] || icons['default'];
  }

  createPanel() {
    this.panel = document.createElement('div');
    this.panel.id = 'tabmaster-panel';
    this.panel.className = 'tabmaster-panel hidden';
    
    this.panel.innerHTML = `
      <div class="tabmaster-panel-header">
        <div class="tabmaster-search-wrapper">
          <svg class="tabmaster-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="tabmaster-search-input" placeholder="搜索标签..." />
          <button class="tabmaster-clear-search" style="display: none;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div class="tabmaster-panel-body">
        <div class="tabmaster-domain-groups"></div>
      </div>
      
      <div class="tabmaster-panel-footer">
        <button class="tabmaster-action-btn tabmaster-dedup-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 3H2a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h20a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z"></path>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
          <span>一键去重</span>
        </button>
        <button class="tabmaster-action-btn tabmaster-settings-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>设置</span>
        </button>
      </div>
    `;
    
    document.body.appendChild(this.panel);
    
    this.setupPanelEventListeners();
  }

  setupPanelEventListeners() {
    const searchInput = this.panel.querySelector('.tabmaster-search-input');
    const clearBtn = this.panel.querySelector('.tabmaster-clear-search');
    
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      clearBtn.style.display = this.searchQuery ? 'block' : 'none';
      this.renderTabs();
    });
    
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      clearBtn.style.display = 'none';
      this.renderTabs();
    });

    this.panel.querySelector('.tabmaster-dedup-btn').addEventListener('click', () => {
      this.closePanel();
      chrome.runtime.sendMessage({ type: 'deduplicate' }, count => {
        this.showToast(`已关闭 ${count} 个重复标签`);
        this.refreshTabs();
      });
    });

    this.panel.querySelector('.tabmaster-settings-btn').addEventListener('click', () => {
      this.closePanel();
      chrome.runtime.sendMessage({ type: 'openSettings' });
    });
  }

  setupEventListeners() {
    this.orb.addEventListener('mouseenter', () => {
      if (this.isDragging) return;
      this.orb.classList.add('hover');
      this.startHoverTimer();
    });

    this.orb.addEventListener('mouseleave', () => {
      this.orb.classList.remove('hover');
      this.clearHoverTimer();
    });

    this.orb.addEventListener('click', () => {
      if (this.isDragging) return;
      if (this.isPanelOpen) {
        this.closePanel();
      } else {
        this.openPanel();
      }
    });

    this.orb.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'openSettings' });
    });

    let dragStartX, dragStartY, orbStartX, orbStartY;
    let dragStartTime;

    this.orb.addEventListener('mousedown', (e) => {
      dragStartTime = Date.now();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = this.orb.getBoundingClientRect();
      orbStartX = rect.left;
      orbStartY = rect.top;
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    const onMouseMove = (e) => {
      const deltaTime = Date.now() - dragStartTime;
      if (deltaTime > 200) {
        this.isDragging = true;
        this.orb.classList.add('dragging');
        this.closePanel();
        
        let newX = orbStartX + e.clientX - dragStartX;
        let newY = orbStartY + e.clientY - dragStartY;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const orbSize = this.config.orbSize || 56;
        
        newX = Math.max(0, Math.min(newX, viewportWidth - orbSize));
        newY = Math.max(0, Math.min(newY, viewportHeight - orbSize));
        
        this.orb.style.left = `${newX}px`;
        this.orb.style.right = 'auto';
        this.orb.style.top = `${newY}px`;
        this.orb.style.bottom = 'auto';
        
        if (newX < 20) this.orb.style.left = '0px';
        if (newX > viewportWidth - orbSize - 20) this.orb.style.left = `${viewportWidth - orbSize}px`;
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      if (this.isDragging) {
        const rect = this.orb.getBoundingClientRect();
        this.config.orbPosition = { x: rect.left, y: rect.top };
        chrome.runtime.sendMessage({ type: 'saveConfig', config: this.config });
        this.isDragging = false;
        this.orb.classList.remove('dragging');
      }
    };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPanelOpen) {
        this.closePanel();
      }
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'togglePanel') {
        if (this.isPanelOpen) {
          this.closePanel();
        } else {
          this.openPanel();
        }
      } else if (message.type === 'tabCountChanged') {
        this.refreshTabs();
      } else if (message.type === 'showToast') {
        this.showToast(message.message);
      }
    });

    document.addEventListener('click', (e) => {
      if (this.isPanelOpen && !this.panel.contains(e.target) && e.target !== this.orb) {
        this.closePanel();
      }
    });
  }

  startHoverTimer() {
    this.clearHoverTimer();
    this.hoverTimeout = setTimeout(() => {
      if (!this.isPanelOpen) {
        this.openPanel();
      }
    }, 300);
  }

  clearHoverTimer() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  openPanel() {
    if (this.isPanelOpen) return;
    
    this.isPanelOpen = true;
    this.panel.classList.remove('hidden');
    this.orb.classList.add('active');
    
    this.updatePanelPosition();
    this.renderCategories();
    this.renderTabs();
    
    setTimeout(() => {
      const searchInput = this.panel.querySelector('.tabmaster-search-input');
      searchInput?.focus();
    }, 100);
  }

  closePanel() {
    if (!this.isPanelOpen) return;
    
    this.isPanelOpen = false;
    this.panel.classList.add('hidden');
    this.orb.classList.remove('active');
  }

  updatePanelPosition() {
    const orbRect = this.orb.getBoundingClientRect();
    const panelWidth = 480;
    const panelHeight = Math.min(600, window.innerHeight - 100);
    
    let panelX = orbRect.left - panelWidth + orbRect.width;
    let panelY = orbRect.top - panelHeight + orbRect.height;
    
    if (panelX < 20) panelX = orbRect.right + 10;
    if (panelY < 20) panelY = 20;
    if (panelX + panelWidth > window.innerWidth) panelX = window.innerWidth - panelWidth - 20;
    if (panelY + panelHeight > window.innerHeight) panelY = window.innerHeight - panelHeight - 20;
    
    this.panel.style.left = `${panelX}px`;
    this.panel.style.top = `${panelY}px`;
  }

  async renderCategories() {
    await this.loadCategories();
    const navContainer = this.panel.querySelector('.tabmaster-category-nav');
    
    while (navContainer.children.length > 1) {
      navContainer.removeChild(navContainer.lastChild);
    }
    
    const sortedCategories = [...this.categories].sort((a, b) => b.count - a.count);
    
    sortedCategories.forEach(cat => {
      if (cat.count > 0) {
        const btn = document.createElement('button');
        btn.className = 'tabmaster-category-item';
        btn.dataset.category = cat.id;
        const iconSvg = this.getIconSvg(cat.icon || 'default');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            ${iconSvg}
          </svg>
          <span>${cat.name}</span>
          <span class="tabmaster-category-count">${cat.count}</span>
        `;
        btn.addEventListener('click', () => {
          this.selectedCategory = cat.id;
          navContainer.querySelectorAll('.tabmaster-category-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderTabs();
        });
        navContainer.appendChild(btn);
      }
    });
  }

  async renderTabs() {
    await this.loadTabs();
    
    let filteredTabs = this.tabs;
    
    if (this.searchQuery) {
      filteredTabs = filteredTabs.filter(tab => {
        const title = tab.title?.toLowerCase() || '';
        const url = tab.url?.toLowerCase() || '';
        return title.includes(this.searchQuery) || url.includes(this.searchQuery);
      });
    }
    
    const groupsContainer = this.panel.querySelector('.tabmaster-domain-groups');
    groupsContainer.innerHTML = '';
    
    if (filteredTabs.length === 0) {
      groupsContainer.innerHTML = '<div class="tabmaster-empty-state"><div class="tabmaster-empty-text">暂无匹配的标签</div></div>';
      return;
    }
    
    const groups = this.groupTabsByCategory(filteredTabs);
    
    if (Object.keys(groups).length === 0) {
      groupsContainer.innerHTML = '<div class="tabmaster-empty-state"><div class="tabmaster-empty-text">分类失败</div></div>';
      return;
    }
    
    const sortedCategories = Object.keys(groups).sort((a, b) => {
      const order = ['AI工具', '飞书文档', '飞书表格', 'GitHub', '开发资源', '设计工具', 'Notion', '未分类'];
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      return (aIndex === -1 ? 100 : aIndex) - (bIndex === -1 ? 100 : bIndex);
    });
    
    sortedCategories.forEach(categoryName => {
      const group = groups[categoryName];
      const groupElement = this.createCategoryGroup(categoryName, group);
      groupsContainer.appendChild(groupElement);
    });
  }
  
  groupTabsByCategory(tabs) {
    const groups = {};
    const categoryNames = {
      'ai': 'AI工具',
      'feishu-doc': '飞书文档',
      'feishu-sheet': '飞书表格',
      'github': 'GitHub',
      'dev': '开发资源',
      'design': '设计工具',
      'notion': 'Notion',
      'other': '未分类'
    };
    
    tabs.forEach(tab => {
      const categoryId = this.getTabCategory(tab);
      const categoryName = categoryNames[categoryId] || categoryId;
      
      if (!groups[categoryName]) {
        groups[categoryName] = {
          id: categoryId,
          tabs: []
        };
      }
      groups[categoryName].tabs.push(tab);
    });
    
    return groups;
  }
  
  createCategoryGroup(categoryName, groupData) {
    const group = document.createElement('div');
    group.className = 'tabmaster-domain-group';
    
    const categoryIcons = {
      'AI工具': '🤖',
      '飞书文档': '📄',
      '飞书表格': '📊',
      'GitHub': '💻',
      '开发资源': '⚡',
      '设计工具': '🎨',
      'Notion': '📝',
      '未分类': '📁'
    };
    const icon = categoryIcons[categoryName] || '📁';
    const tabs = groupData.tabs;
    
    group.innerHTML = `
      <div class="tabmaster-domain-header">
        <div class="tabmaster-domain-title-wrapper">
          <span class="tabmaster-domain-icon">${icon}</span>
          <span class="tabmaster-domain-name">${categoryName}</span>
        </div>
        <span class="tabmaster-domain-count">${tabs.length}</span>
        <button class="tabmaster-domain-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="tabmaster-tabs-list">
        ${tabs.map(tab => this.createTabItemHTML(tab)).join('')}
      </div>
    `;
    
    group.querySelector('.tabmaster-domain-close').addEventListener('click', () => {
      tabs.forEach(tab => {
        chrome.runtime.sendMessage({ type: 'closeTab', tabId: tab.id });
      });
      this.refreshTabs();
    });
    
    tabs.forEach(tab => {
      const item = group.querySelector(`[data-tab-id="${tab.id}"]`);
      if (item) {
        item.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'activateTab', tabId: tab.id, windowId: tab.windowId });
          this.closePanel();
        });
        
        const closeBtn = item.querySelector('.tabmaster-tab-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.runtime.sendMessage({ type: 'closeTab', tabId: tab.id });
            this.refreshTabs();
          });
          
          item.addEventListener('mouseenter', () => {
            closeBtn.style.opacity = '1';
          });
          
          item.addEventListener('mouseleave', () => {
            closeBtn.style.opacity = '0';
          });
        }
      }
    });
    
    return group;
  }
  
  createTabItemHTML(tab) {
    let faviconUrl = '';
    try {
      const url = new URL(tab.url);
      faviconUrl = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
    } catch (e) {}
    
    return `
      <div class="tabmaster-tab-item ${tab.active ? 'active' : ''}" data-tab-id="${tab.id}">
        <img src="${faviconUrl}" alt="${tab.title}" class="tabmaster-tab-favicon" onerror="this.src=''" />
        <span class="tabmaster-tab-title">${tab.title || tab.url}</span>
        <button class="tabmaster-tab-close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }

  getTabCategory(tab) {
    if (!tab.url) return 'other';
    
    const fallbackCategories = ['ai', 'feishu-doc', 'feishu-sheet', 'github', 'dev', 'design', 'notion'];
    
    for (const cat of this.categories) {
      if (cat.id === 'all') continue;
      if (!cat.rules || cat.rules.length === 0) continue;
      
      for (const rule of cat.rules) {
        if (this.matchesRule(tab, rule)) {
          return cat.id;
        }
      }
    }
    
    for (const catId of fallbackCategories) {
      const cat = this.categories.find(c => c.id === catId);
      if (cat && cat.rules) {
        for (const rule of cat.rules) {
          if (this.matchesRule(tab, rule)) {
            return catId;
          }
        }
      }
    }
    
    return 'other';
  }

  matchesRule(tab, rule) {
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname.toLowerCase();
      const urlStr = tab.url.toLowerCase();
      const title = tab.title ? tab.title.toLowerCase() : '';
      
      switch (rule.type) {
        case 'domain':
          return hostname.includes(rule.value.toLowerCase()) || 
                 hostname.endsWith('.' + rule.value.toLowerCase()) ||
                 hostname === rule.value.toLowerCase();
        case 'regex':
          try {
            return new RegExp(rule.value, 'i').test(tab.url);
          } catch {
            return urlStr.includes(rule.value.toLowerCase());
          }
        case 'title':
          return title.includes(rule.value.toLowerCase());
        default:
          return hostname.includes(rule.value.toLowerCase());
      }
    } catch {
      if (rule.type === 'title' && tab.title) {
        return tab.title.toLowerCase().includes(rule.value.toLowerCase());
      }
      if (tab.url && rule.type !== 'title') {
        return tab.url.toLowerCase().includes(rule.value.toLowerCase());
      }
      return false;
    }
  }

  createTabItem(tab) {
    const item = document.createElement('div');
    item.className = 'tabmaster-tab-item';
    if (tab.active) item.classList.add('active');
    
    let hostname = '';
    let faviconUrl = '';
    try {
      const url = new URL(tab.url);
      hostname = url.hostname;
      faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch (e) {
      hostname = tab.url;
    }
    
    item.innerHTML = `
      <img 
        src="${faviconUrl}" 
        alt="${tab.title}" 
        class="tabmaster-tab-favicon"
        onerror="this.src=''"
      />
      <span class="tabmaster-tab-title">${tab.title || hostname}</span>
      <span class="tabmaster-tab-url">${hostname}</span>
      <button class="tabmaster-tab-close" data-tab-id="${tab.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    
    item.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'activateTab', tabId: tab.id, windowId: tab.windowId });
      this.closePanel();
    });
    
    const closeBtn = item.querySelector('.tabmaster-tab-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'closeTab', tabId: tab.id });
      this.refreshTabs();
    });
    
    item.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '1';
    });
    
    item.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '0';
    });
    
    return item;
  }

  createToast() {
    this.toast = document.createElement('div');
    this.toast.id = 'tabmaster-toast';
    this.toast.className = 'tabmaster-toast hidden';
    document.body.appendChild(this.toast);
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.remove('hidden');
    
    setTimeout(() => {
      this.toast.classList.add('hidden');
    }, 3000);
  }

  async refreshTabs() {
    await this.loadTabs();
    this.updateOrbCount();
    await this.renderCategories();
    if (this.isPanelOpen) {
      this.renderTabs();
    }
  }
}

if (!document.getElementById('tabmaster-orb')) {
  new FloatingOrb();
}