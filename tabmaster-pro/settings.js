let config = {};
let categories = [];
let editingCategory = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadCategories();
  setupNav();
  setupSettings();
  setupCategoryManagement();
  setupStats();
});

async function loadConfig() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'getConfig' }, cfg => {
      config = cfg;
      resolve();
    });
  });
}

async function loadCategories() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'getCategories' }, cats => {
      categories = cats;
      renderCategories();
      resolve();
    });
  });
}

function setupNav() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const sectionId = `section-${item.dataset.section}`;
      document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
      });
      document.getElementById(sectionId).style.display = 'block';
    });
  });
}

function setupSettings() {
  const orbSizeSlider = document.getElementById('orb-size');
  const orbSizeValue = document.getElementById('orb-size-value');
  orbSizeSlider.value = config.orbSize || 56;
  orbSizeValue.textContent = `${config.orbSize || 56}px`;
  orbSizeSlider.addEventListener('input', (e) => {
    config.orbSize = parseInt(e.target.value);
    orbSizeValue.textContent = `${config.orbSize}px`;
    saveConfig();
  });

  const orbOpacitySlider = document.getElementById('orb-opacity');
  const orbOpacityValue = document.getElementById('orb-opacity-value');
  orbOpacitySlider.value = config.orbOpacity || 80;
  orbOpacityValue.textContent = `${config.orbOpacity || 80}%`;
  orbOpacitySlider.addEventListener('input', (e) => {
    config.orbOpacity = parseInt(e.target.value);
    orbOpacityValue.textContent = `${config.orbOpacity}%`;
    saveConfig();
  });

  const autoDedup = document.getElementById('auto-dedup');
  autoDedup.checked = config.autoDedup !== false;
  autoDedup.addEventListener('change', (e) => {
    config.autoDedup = e.target.checked;
    saveConfig();
  });

  const dedupIntervalSlider = document.getElementById('dedup-interval');
  const dedupIntervalValue = document.getElementById('dedup-interval-value');
  dedupIntervalSlider.value = config.dedupInterval || 30;
  dedupIntervalValue.textContent = `${config.dedupInterval || 30}s`;
  dedupIntervalSlider.addEventListener('input', (e) => {
    config.dedupInterval = parseInt(e.target.value);
    dedupIntervalValue.textContent = `${config.dedupInterval}s`;
    saveConfig();
  });

  document.getElementById('reset-position').addEventListener('click', () => {
    config.orbPosition = { x: 'auto', y: 'auto' };
    saveConfig();
  });

  document.getElementById('export-config').addEventListener('click', () => {
    const dataStr = JSON.stringify(config, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabmaster-config.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('reset-all').addEventListener('click', () => {
    if (confirm('确定要重置所有设置吗？')) {
      chrome.storage.local.set({ tabmasterConfig: getDefaultConfig() }, () => {
        loadConfig();
        loadCategories();
      });
    }
  });
}

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

function saveConfig() {
  chrome.runtime.sendMessage({ type: 'saveConfig', config });
}

function setupCategoryManagement() {
  document.getElementById('add-category').addEventListener('click', () => {
    editingCategory = null;
    openCategoryModal('添加分类', '创建新的标签分类');
    document.getElementById('category-name').value = '';
    document.getElementById('category-color').value = '#3b82f6';
    document.getElementById('rule-list').innerHTML = '';
  });

  document.getElementById('cancel-category').addEventListener('click', closeCategoryModal);
  
  document.getElementById('save-category').addEventListener('click', async () => {
    const name = document.getElementById('category-name').value.trim();
    const color = document.getElementById('category-color').value;
    
    if (!name) {
      alert('请输入分类名称');
      return;
    }

    const rules = [];
    document.querySelectorAll('.rule-item').forEach(item => {
      const type = item.querySelector('.rule-type-select').value;
      const value = item.querySelector('.rule-value-input').value;
      if (value.trim()) {
        rules.push({ type, value: value.trim() });
      }
    });

    if (editingCategory) {
      const index = categories.findIndex(c => c.id === editingCategory.id);
      if (index !== -1) {
        categories[index] = { ...categories[index], name, color, rules };
      }
    } else {
      categories.push({
        id: `category_${Date.now()}`,
        name,
        color,
        rules
      });
    }

    config.categories = categories;
    saveConfig();
    renderCategories();
    closeCategoryModal();
  });

  document.getElementById('add-rule').addEventListener('click', addRuleRow);
}

function renderCategories() {
  const list = document.getElementById('category-list');
  list.innerHTML = '';
  
  categories.forEach(cat => {
    if (cat.isDefault) return;
    
    const card = document.createElement('div');
    card.className = 'category-card';
    card.innerHTML = `
      <div class="category-color" style="background-color: ${cat.color}"></div>
      <div class="category-info">
        <div class="category-name">${cat.name}</div>
        <div class="category-rules">${cat.rules.length} 条规则</div>
      </div>
      <div class="category-actions">
        <button class="action-btn edit-category" data-id="${cat.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="action-btn delete-category" data-id="${cat.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    
    card.querySelector('.edit-category').addEventListener('click', () => {
      editingCategory = cat;
      openCategoryModal('编辑分类', '修改分类设置');
      document.getElementById('category-name').value = cat.name;
      document.getElementById('category-color').value = cat.color;
      renderRules(cat.rules);
    });
    
    card.querySelector('.delete-category').addEventListener('click', async () => {
      if (confirm(`确定要删除 "${cat.name}" 分类吗？`)) {
        categories = categories.filter(c => c.id !== cat.id);
        config.categories = categories;
        saveConfig();
        renderCategories();
      }
    });
    
    list.appendChild(card);
  });
}

function openCategoryModal(title, description) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-description').textContent = description;
  document.getElementById('category-modal').classList.add('show');
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.remove('show');
  editingCategory = null;
}

function addRuleRow() {
  const list = document.getElementById('rule-list');
  const ruleItem = document.createElement('div');
  ruleItem.className = 'rule-item';
  ruleItem.innerHTML = `
    <select class="rule-type-select">
      <option value="domain">域名包含</option>
      <option value="regex">URL匹配（正则）</option>
      <option value="title">标题关键词</option>
    </select>
    <input type="text" class="rule-value-input input-field" style="flex: 1;" placeholder="输入匹配值">
    <button class="action-btn remove-rule" style="background: rgba(239,68,68,0.15); color: #ef4444;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  
  ruleItem.querySelector('.remove-rule').addEventListener('click', () => {
    list.removeChild(ruleItem);
  });
  
  list.appendChild(ruleItem);
}

function renderRules(rules) {
  const list = document.getElementById('rule-list');
  list.innerHTML = '';
  
  rules.forEach(rule => {
    const ruleItem = document.createElement('div');
    ruleItem.className = 'rule-item';
    ruleItem.innerHTML = `
      <select class="rule-type-select">
        <option value="domain" ${rule.type === 'domain' ? 'selected' : ''}>域名包含</option>
        <option value="regex" ${rule.type === 'regex' ? 'selected' : ''}>URL匹配（正则）</option>
        <option value="title" ${rule.type === 'title' ? 'selected' : ''}>标题关键词</option>
      </select>
      <input type="text" class="rule-value-input input-field" style="flex: 1;" value="${rule.value}">
      <button class="action-btn remove-rule" style="background: rgba(239,68,68,0.15); color: #ef4444;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    
    ruleItem.querySelector('.remove-rule').addEventListener('click', () => {
      list.removeChild(ruleItem);
    });
    
    list.appendChild(ruleItem);
  });
}

function setupStats() {
  chrome.runtime.sendMessage({ type: 'getStats' }, stats => {
    document.getElementById('stat-total').textContent = stats.totalTabsOpened || 0;
    document.getElementById('stat-dedup').textContent = stats.totalDeduplicated || 0;
    
    chrome.tabs.query({}, tabs => {
      document.getElementById('stat-active').textContent = tabs.length;
      
      const savedPercent = stats.totalTabsOpened > 0 
        ? Math.round((stats.totalDeduplicated / stats.totalTabsOpened) * 100) 
        : 0;
      document.getElementById('stat-saved').textContent = `${savedPercent}%`;
    });

    const topSites = Object.entries(stats.topSites || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    const list = document.getElementById('top-sites-list');
    list.innerHTML = '';
    
    topSites.forEach(([domain, count]) => {
      const item = document.createElement('div');
      item.className = 'category-card';
      item.innerHTML = `
        <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" style="width: 32px; height: 32px; border-radius: 4px;" />
        <div class="category-info">
          <div class="category-name">${domain}</div>
          <div class="category-rules">访问 ${count} 次</div>
        </div>
        <div style="font-size: 18px; font-weight: 600; color: rgba(255,255,255,0.7);">${count}</div>
      `;
      list.appendChild(item);
    });
  });
}