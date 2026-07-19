class DeduplicationEngine {
  constructor() {
    this.whitelist = [];
    this.lastScanTime = 0;
    this.scanInterval = null;
    this.init();
  }

  async init() {
    const config = await this.getConfig();
    this.whitelist = config.dedupWhitelist || [];
    this.startAutoScan();
  }

  async getConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get(['tabmasterConfig'], result => {
        resolve(result.tabmasterConfig || this.getDefaultConfig());
      });
    });
  }

  getDefaultConfig() {
    return {
      orbSize: 56,
      orbOpacity: 80,
      theme: 'dark',
      autoDedup: true,
      dedupInterval: 30,
      dedupWhitelist: [],
      categories: this.getDefaultCategories()
    };
  }

  getDefaultCategories() {
    return [
      { id: 'all', name: '全部', color: '#ffffff', icon: 'layout', rules: [], isDefault: true },
      { id: 'ai', name: 'AI工具', color: '#8b5cf6', icon: 'brain', rules: [
        { type: 'domain', value: 'chat.openai.com' },
        { type: 'domain', value: 'claude.ai' },
        { type: 'domain', value: 'gemini.google.com' },
        { type: 'domain', value: 'perplexity.ai' },
        { type: 'domain', value: 'manus.im' }
      ]},
      { id: 'feishu-doc', name: '飞书文档', color: '#00b42a', icon: 'file-text', rules: [
        { type: 'domain', value: 'feishu.cn' },
        { type: 'domain', value: 'larksuite.com' },
        { type: 'domain', value: 'bytedance.larkoffice.com' },
        { type: 'domain', value: 'larkoffice.com' },
        { type: 'regex', value: '.*feishu.*' },
        { type: 'regex', value: '.*lark.*' }
      ]},
      { id: 'feishu-sheet', name: '飞书表格', color: '#20c997', icon: 'table', rules: [
        { type: 'regex', value: '.*feishu\\.cn.*sheet.*' },
        { type: 'regex', value: '.*larksuite\\.com.*sheet.*' },
        { type: 'regex', value: '.*bytedance\\.larkoffice\\.com.*sheet.*' },
        { type: 'regex', value: '.*spreadsheet.*' },
        { type: 'regex', value: '.*table.*' }
      ]},
      { id: 'github', name: 'GitHub', color: '#181717', icon: 'code', rules: [
        { type: 'domain', value: 'github.com' }
      ]},
      { id: 'dev', name: '开发资源', color: '#3b82f6', icon: 'terminal', rules: [
        { type: 'domain', value: 'stackoverflow.com' },
        { type: 'domain', value: 'developer.mozilla.org' },
        { type: 'domain', value: 'npmjs.com' },
        { type: 'domain', value: 'nodejs.org' },
        { type: 'domain', value: 'typescriptlang.org' }
      ]},
      { id: 'design', name: '设计工具', color: '#ff6b6b', icon: 'palette', rules: [
        { type: 'domain', value: 'figma.com' },
        { type: 'domain', value: 'sketch.cloud' },
        { type: 'domain', value: 'zeplin.io' }
      ]},
      { id: 'notion', name: 'Notion', color: '#000000', icon: 'book-open', rules: [
        { type: 'domain', value: 'notion.so' },
        { type: 'domain', value: 'notion.site' }
      ]},
      { id: 'other', name: '未分类', color: '#6b7280', icon: 'more-horizontal', rules: [] }
    ];
  }

  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source'];
      paramsToRemove.forEach(param => parsed.searchParams.delete(param));
      parsed.hash = '';
      return parsed.href;
    } catch {
      return url;
    }
  }

  isWhitelisted(url) {
    return this.whitelist.some(domain => url.includes(domain));
  }

  async scanDuplicates() {
    const tabs = await this.getAllTabs();
    const urlMap = new Map();
    
    tabs.forEach(tab => {
      if (tab.url && !tab.incognito && !this.isWhitelisted(tab.url)) {
        const normalizedUrl = this.normalizeUrl(tab.url);
        if (!urlMap.has(normalizedUrl)) {
          urlMap.set(normalizedUrl, []);
        }
        urlMap.get(normalizedUrl).push(tab);
      }
    });

    const duplicates = [];
    urlMap.forEach((tabList, url) => {
      if (tabList.length > 1) {
        duplicates.push({ url, tabs: tabList });
      }
    });

    return duplicates;
  }

  async getAllTabs() {
    return new Promise(resolve => {
      chrome.tabs.query({}, tabs => resolve(tabs));
    });
  }

  async closeDuplicates() {
    const duplicates = await this.scanDuplicates();
    let closedCount = 0;

    for (const { tabs } of duplicates) {
      tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      const keepTab = tabs[0];
      
      for (let i = 1; i < tabs.length; i++) {
        const tab = tabs[i];
        try {
          await this.safeCloseTab(tab.id);
          closedCount++;
        } catch (e) {
          console.warn('Failed to close tab:', tab.id, e);
        }
      }
    }

    if (closedCount > 0) {
      this.showNotification(`已关闭 ${closedCount} 个重复标签，释放内存`);
      this.updateStats(closedCount);
    }

    return closedCount;
  }

  async safeCloseTab(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.get(tabId, tab => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        if (!tab.active) {
          chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        } else {
          reject(new Error('Cannot close active tab'));
        }
      });
    });
  }

  showNotification(message) {
    chrome.runtime.sendMessage({
      type: 'showToast',
      message
    }).catch(() => {});
  }

  async updateStats(closedCount) {
    const stats = await this.getStats();
    stats.totalDeduplicated += closedCount;
    stats.lastDeduplicateTime = Date.now();
    await this.saveStats(stats);
  }

  async getStats() {
    return new Promise(resolve => {
      chrome.storage.local.get(['tabmasterStats'], result => {
        resolve(result.tabmasterStats || this.getDefaultStats());
      });
    });
  }

  getDefaultStats() {
    return {
      totalTabsOpened: 0,
      totalDeduplicated: 0,
      lastDeduplicateTime: 0,
      dailyCounts: {},
      topSites: {}
    };
  }

  async saveStats(stats) {
    return new Promise(resolve => {
      chrome.storage.local.set({ tabmasterStats: stats }, resolve);
    });
  }

  startAutoScan() {
    if (this.scanInterval) clearInterval(this.scanInterval);
    this.scanInterval = setInterval(() => {
      this.closeDuplicates();
    }, 30000);
  }

  stopAutoScan() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }
}

class CategoryEngine {
  constructor() {
    this.categories = [];
    this.init();
  }

  async init() {
    const defaultCats = this.getDefaultCategories();
    const config = await this.getConfig();
    
    if (config.categories && config.categories.length > 0) {
      const merged = [];
      const existingIds = new Set();
      
      defaultCats.forEach(defaultCat => {
        const existing = config.categories.find(c => c.id === defaultCat.id);
        if (existing) {
          merged.push({ ...defaultCat, ...existing });
          existingIds.add(defaultCat.id);
        } else {
          merged.push(defaultCat);
        }
      });
      
      config.categories.forEach(cat => {
        if (!existingIds.has(cat.id)) {
          merged.push(cat);
        }
      });
      
      this.categories = merged;
    } else {
      this.categories = defaultCats;
    }
  }

  async getConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get(['tabmasterConfig'], result => {
        resolve(result.tabmasterConfig || {});
      });
    });
  }

  getDefaultCategories() {
    return [
      { id: 'all', name: '全部', color: '#ffffff', rules: [], isDefault: true },
      { id: 'ai', name: 'AI工具', color: '#8b5cf6', rules: [
        { type: 'domain', value: 'chat.openai.com' },
        { type: 'domain', value: 'claude.ai' },
        { type: 'domain', value: 'gemini.google.com' },
        { type: 'domain', value: 'perplexity.ai' },
        { type: 'domain', value: 'manus.im' }
      ]},
      { id: 'feishu-doc', name: '飞书文档', color: '#00b42a', rules: [
        { type: 'domain', value: 'feishu.cn' },
        { type: 'domain', value: 'larksuite.com' },
        { type: 'domain', value: 'larkoffice.com' },
        { type: 'domain', value: 'bytedance.larkoffice.com' },
        { type: 'regex', value: '.*feishu.*' },
        { type: 'regex', value: '.*lark.*' }
      ]},
      { id: 'feishu-sheet', name: '飞书表格', color: '#20c997', rules: [
        { type: 'regex', value: '.*feishu\\.cn.*sheet.*' },
        { type: 'regex', value: '.*larksuite\\.com.*sheet.*' },
        { type: 'regex', value: '.*larkoffice\\.com.*sheet.*' },
        { type: 'regex', value: '.*spreadsheet.*' },
        { type: 'regex', value: '.*table.*' }
      ]},
      { id: 'github', name: 'GitHub', color: '#181717', rules: [
        { type: 'domain', value: 'github.com' }
      ]},
      { id: 'dev', name: '开发资源', color: '#3b82f6', rules: [
        { type: 'domain', value: 'stackoverflow.com' },
        { type: 'domain', value: 'developer.mozilla.org' },
        { type: 'domain', value: 'npmjs.com' },
        { type: 'domain', value: 'nodejs.org' },
        { type: 'domain', value: 'typescriptlang.org' }
      ]},
      { id: 'design', name: '设计工具', color: '#ff6b6b', rules: [
        { type: 'domain', value: 'figma.com' },
        { type: 'domain', value: 'sketch.cloud' },
        { type: 'domain', value: 'zeplin.io' }
      ]},
      { id: 'notion', name: 'Notion', color: '#000000', rules: [
        { type: 'domain', value: 'notion.so' },
        { type: 'domain', value: 'notion.site' }
      ]},
      { id: 'other', name: '未分类', color: '#6b7280', rules: [] }
    ];
  }

  categorizeTab(tab) {
    if (!tab.url) return 'other';
    
    for (const category of this.categories) {
      if (category.isDefault) continue;
      for (const rule of category.rules) {
        if (this.matchesRule(tab, rule)) {
          return category.id;
        }
      }
    }
    return 'other';
  }

  matchesRule(tab, rule) {
    try {
      const url = new URL(tab.url);
      switch (rule.type) {
        case 'domain':
          return url.hostname.includes(rule.value);
        case 'regex':
          return new RegExp(rule.value).test(tab.url);
        case 'title':
          return tab.title && tab.title.toLowerCase().includes(rule.value.toLowerCase());
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  async getCategoriesWithCounts() {
    const tabs = await this.getAllTabs();
    const counts = {};
    let totalCount = 0;
    
    this.categories.forEach(cat => {
      counts[cat.id] = 0;
    });
    
    tabs.forEach(tab => {
      if (tab.url && !tab.incognito && !tab.url.startsWith('chrome://')) {
        totalCount++;
        const categoryId = this.categorizeTab(tab);
        counts[categoryId] = (counts[categoryId] || 0) + 1;
      }
    });

    return this.categories.map(cat => ({
      ...cat,
      count: cat.id === 'all' ? totalCount : (counts[cat.id] || 0)
    }));
  }

  async getAllTabs() {
    return new Promise(resolve => {
      chrome.tabs.query({}, tabs => resolve(tabs));
    });
  }

  async getCurrentWindowTabs() {
    return new Promise(resolve => {
      chrome.tabs.query({ currentWindow: true }, tabs => resolve(tabs));
    });
  }

  async addCategory(name, color) {
    const newCategory = {
      id: `category_${Date.now()}`,
      name,
      color: color || '#3b82f6',
      rules: []
    };
    this.categories.push(newCategory);
    await this.saveCategories();
    return newCategory;
  }

  async removeCategory(categoryId) {
    this.categories = this.categories.filter(cat => cat.id !== categoryId && !cat.isDefault);
    await this.saveCategories();
  }

  async updateCategory(categoryId, updates) {
    const index = this.categories.findIndex(cat => cat.id === categoryId);
    if (index !== -1) {
      this.categories[index] = { ...this.categories[index], ...updates };
      await this.saveCategories();
    }
  }

  async addRule(categoryId, rule) {
    const category = this.categories.find(cat => cat.id === categoryId);
    if (category) {
      category.rules.push(rule);
      await this.saveCategories();
    }
  }

  async removeRule(categoryId, ruleIndex) {
    const category = this.categories.find(cat => cat.id === categoryId);
    if (category) {
      category.rules.splice(ruleIndex, 1);
      await this.saveCategories();
    }
  }

  async saveCategories() {
    const config = await this.getConfig();
    config.categories = this.categories;
    return new Promise(resolve => {
      chrome.storage.local.set({ tabmasterConfig: config }, resolve);
    });
  }
}

let deduplicationEngine;
let categoryEngine;

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({ tabmasterConfig: getDefaultConfig() });
    await chrome.storage.local.set({ tabmasterStats: getDefaultStats() });
    await chrome.storage.local.set({ tabmasterFirstRun: true });
    setTimeout(() => {
      chrome.tabs.create({ url: 'welcome.html' });
    }, 1000);
  }
});

function getDefaultConfig() {
  return {
    orbSize: 56,
    orbOpacity: 80,
    theme: 'dark',
    autoDedup: true,
    dedupInterval: 30,
    dedupWhitelist: [],
    orbPosition: { x: 'auto', y: 'auto' },
    categories: [
      { id: 'ai', name: 'AI工具', color: '#8b5cf6', rules: [{ type: 'domain', value: 'chat.openai.com' }, { type: 'domain', value: 'claude.ai' }, { type: 'domain', value: 'gemini.google.com' }] },
      { id: 'feishu', name: '飞书文档', color: '#00b42a', rules: [{ type: 'domain', value: 'feishu.cn' }, { type: 'domain', value: 'larksuite.com' }] },
      { id: 'design', name: '设计工具', color: '#ff6b6b', rules: [{ type: 'domain', value: 'figma.com' }, { type: 'domain', value: 'sketch.cloud' }] },
      { id: 'dev', name: '开发资源', color: '#3b82f6', rules: [{ type: 'domain', value: 'github.com' }, { type: 'domain', value: 'stackoverflow.com' }] },
      { id: 'notion', name: 'Notion', color: '#000000', rules: [{ type: 'domain', value: 'notion.so' }, { type: 'domain', value: 'notion.site' }] },
      { id: 'other', name: '未分类', color: '#64748b', rules: [], isDefault: true }
    ]
  };
}

function getDefaultStats() {
  return {
    totalTabsOpened: 0,
    totalDeduplicated: 0,
    lastDeduplicateTime: 0,
    dailyCounts: {},
    topSites: {}
  };
}

function initEngines() {
  if (!deduplicationEngine) {
    deduplicationEngine = new DeduplicationEngine();
  }
  if (!categoryEngine) {
    categoryEngine = new CategoryEngine();
  }
}

chrome.runtime.onStartup.addListener(() => {
  initEngines();
});

chrome.runtime.onInstalled.addListener(() => {
  initEngines();
});

chrome.tabs.onCreated.addListener(async (tab) => {
  const stats = await getStats();
  stats.totalTabsOpened++;
  const today = new Date().toISOString().split('T')[0];
  stats.dailyCounts[today] = (stats.dailyCounts[today] || 0) + 1;
  if (tab.url) {
    const domain = new URL(tab.url).hostname;
    stats.topSites[domain] = (stats.topSites[domain] || 0) + 1;
  }
  await saveStats(stats);
});

async function getStats() {
  return new Promise(resolve => {
    chrome.storage.local.get(['tabmasterStats'], result => {
      resolve(result.tabmasterStats || getDefaultStats());
    });
  });
}

async function saveStats(stats) {
  return new Promise(resolve => {
    chrome.storage.local.set({ tabmasterStats: stats }, resolve);
  });
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-panel') {
    chrome.runtime.sendMessage({ type: 'togglePanel' }).catch(() => {});
  } else if (command === 'deduplicate') {
    if (deduplicationEngine) {
      await deduplicationEngine.closeDuplicates();
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  initEngines();
  switch (message.type) {
    case 'getTabs':
      chrome.tabs.query({}, tabs => {
        const filteredTabs = tabs.filter(tab => {
          if (tab.incognito) return false;
          if (tab.url && tab.url.startsWith('chrome://')) return false;
          return true;
        });
        sendResponse(filteredTabs);
      });
      return true;
    case 'getCategories':
      categoryEngine.getCategoriesWithCounts().then(categories => {
        sendResponse(categories);
      });
      return true;
    case 'categorizeTab':
      const categoryId = categoryEngine.categorizeTab(message.tab);
      sendResponse(categoryId);
      break;
    case 'activateTab':
      chrome.tabs.update(message.tabId, { active: true });
      chrome.windows.update(message.windowId, { focused: true });
      break;
    case 'closeTab':
      chrome.tabs.remove(message.tabId);
      break;
    case 'deduplicate':
      deduplicationEngine.closeDuplicates().then(count => {
        sendResponse(count);
      });
      return true;
    case 'getConfig':
      chrome.storage.local.get(['tabmasterConfig'], result => {
        sendResponse(result.tabmasterConfig || getDefaultConfig());
      });
      return true;
    case 'saveConfig':
      chrome.storage.local.set({ tabmasterConfig: message.config }, () => {
        categoryEngine.init();
        sendResponse(true);
      });
      break;
    case 'getStats':
      getStats().then(stats => {
        sendResponse(stats);
      });
      return true;
    case 'openSettings':
      chrome.tabs.create({ url: 'settings.html' });
      break;
    case 'openWelcome':
      chrome.tabs.create({ url: 'welcome.html' });
      break;
    case 'openStats':
      chrome.tabs.create({ url: 'stats.html' });
      break;
  }
});

chrome.tabs.onRemoved.addListener(async () => {
  chrome.runtime.sendMessage({ type: 'tabCountChanged' }).catch(() => {});
});

chrome.tabs.onCreated.addListener(() => {
  chrome.runtime.sendMessage({ type: 'tabCountChanged' }).catch(() => {});
});