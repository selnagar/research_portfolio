/* A local-first copy editor. Exports strings, never the live page or trial state. */
(() => {
  'use strict';
  const safeCopy = value => {
    const result = Object.create(null);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, text] of Object.entries(value)) {
        if (/^[\w.-]{1,100}$/.test(key) && typeof text === 'string') result[key] = text;
      }
    }
    return result;
  };
  const author = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || new URLSearchParams(location.search).get('edit') === '1';
  const fileCopy = safeCopy(window.PORTFOLIO_COPY);
  const baseline = JSON.stringify(fileCopy);
  const storageKey = `research-portfolio-copy-v1:${location.pathname}`;
  let overrides = safeCopy(fileCopy);
  let storageAvailable = true;
  try {
    const draft = author ? JSON.parse(localStorage.getItem(storageKey) || 'null') : null;
    if (draft?.version === 1 && draft.base === baseline) overrides = safeCopy(draft.overrides);
  } catch { storageAvailable = false; }
  const definitions = new Map();
  const bindings = new Map();
  const history = [];
  const disabledBefore = new Map();
  const detailsBefore = new Map();
  const fieldRows = new Map();
  let active = false;
  let toolbar, launcher, status, more, fields, search, undoButton;
  let saveTimer;
  let editing = null;

  const raw = key => Object.hasOwn(overrides, key) ? overrides[key] : definitions.get(key)?.fallback || '';
  function define(key, fallback, label = key) {
    if (!definitions.has(key)) definitions.set(key, { fallback, label });
    return key;
  }
  function text(key, fallback, values = {}) {
    define(key, fallback);
    return raw(key).replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (token, name) =>
      Object.hasOwn(values, name) ? String(values[name]) : token);
  }
  function apply(element) {
    const binding = bindings.get(element);
    if (!binding || document.activeElement === element && active) return;
    element.textContent = text(binding.key, definitions.get(binding.key).fallback, binding.values);
  }
  function bind(element, key, fallback, values = {}) {
    // Keep button semantics and icons intact; only their inner wording is edited.
    if (element.matches('button')) {
      let span = element.querySelector(':scope > [data-copy]');
      if (!span) { span = document.createElement('span'); element.replaceChildren(span); }
      element = span;
    }
    define(key, fallback);
    element.dataset.copy = key;
    bindings.set(element, { key, values });
    apply(element);
    if (active) makeEditable(element);
    return element;
  }
  function clear(element) {
    bindings.delete(element);
    element.removeAttribute('data-copy');
    element.removeAttribute('contenteditable');
    element.removeAttribute('spellcheck');
    element.textContent = '';
  }
  function sync(key, except) {
    for (const [element, binding] of bindings) {
      if (!element.isConnected) { bindings.delete(element); continue; }
      if (binding.key === key && element !== except) apply(element);
    }
    if (key === 'meta.title') document.title = raw(key);
    if (key === 'meta.description') document.querySelector('meta[name="description"]').content = raw(key);
    const row = fieldRows.get(key);
    if (row && document.activeElement !== row.input) row.input.value = raw(key);
  }
  function setValue(key, value, except) {
    if (value === definitions.get(key)?.fallback) delete overrides[key];
    else overrides[key] = value;
    sync(key, except);
    updateUndo();
    queueSave();
  }
  function setStatus(message) { if (status && status.textContent !== message) status.textContent = message; }
  function updateUndo() {
    if (undoButton) undoButton.disabled = history.length === 0 && (!editing || raw(editing.key) === editing.before);
  }
  function saveDraft() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, base: baseline, overrides }));
      storageAvailable = true;
      setStatus('Draft saved in this browser. Export to update your project.');
    } catch {
      storageAvailable = false;
      setStatus('Browser draft storage is unavailable. Export changes before leaving.');
    }
    updateUndo();
  }
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 180); }
  function makeEditable(element) {
    element.setAttribute('contenteditable', 'true');
    element.setAttribute('spellcheck', 'true');
  }
  function finishEdit() {
    if (!editing) return;
    const { key, before } = editing;
    if (raw(key) !== before) history.push({ key, before });
    editing = null;
    updateUndo();
  }
  function undo() {
    document.activeElement?.blur();
    finishEdit();
    const previous = history.pop();
    if (!previous) return;
    setValue(previous.key, previous.before);
    saveDraft();
  }
  function renderCatalog() {
    for (const [key, definition] of definitions) {
      if (fieldRows.has(key)) continue;
      const row = document.createElement('label');
      row.className = 'text-editor-field';
      const label = document.createElement('span');
      label.textContent = definition.label;
      const input = document.createElement('textarea');
      input.rows = definition.fallback.length > 100 ? 3 : 2;
      input.value = raw(key);
      input.dataset.copyField = key;
      input.setAttribute('aria-label', definition.label);
      input.addEventListener('focus', () => {
        finishEdit(); editing = { key, before: raw(key) };
      });
      input.addEventListener('input', () => setValue(key, input.value));
      input.addEventListener('blur', finishEdit);
      row.append(label, input);
      fields.append(row);
      fieldRows.set(key, { row, input });
    }
    filterCatalog();
  }
  function filterCatalog() {
    const query = search.value.trim().toLowerCase();
    for (const [key, { row }] of fieldRows) {
      const definition = definitions.get(key);
      row.hidden = !`${definition.label} ${definition.fallback} ${raw(key)}`.toLowerCase().includes(query);
    }
  }
  function enable(next) {
    document.activeElement?.blur();
    finishEdit();
    active = next;
    toolbar.hidden = !active;
    launcher.hidden = active;
    document.documentElement.classList.toggle('is-text-editing', active);
    if (active) {
      for (const element of bindings.keys()) makeEditable(element);
      for (const element of document.querySelectorAll('button')) {
        if (element.closest('[data-editor-ui]')) continue;
        disabledBefore.set(element, element.disabled);
        element.disabled = false;
      }
      for (const element of document.querySelectorAll('details')) {
        if (element.closest('[data-editor-ui]')) continue;
        detailsBefore.set(element, element.open);
        element.open = true;
      }
      setStatus(storageAvailable ? 'Click outlined text to rewrite it. Drafts stay in this browser.' : 'Export changes before leaving; browser draft storage is unavailable.');
      updateUndo();
      resizeToolbar();
    } else {
      for (const element of bindings.keys()) {
        element.removeAttribute('contenteditable'); element.removeAttribute('spellcheck');
      }
      for (const [element, disabled] of disabledBefore) element.disabled = disabled;
      disabledBefore.clear();
      for (const [element, open] of detailsBefore) element.open = open;
      detailsBefore.clear();
      more.open = false;
      for (const element of bindings.keys()) apply(element);
      document.dispatchEvent(new Event('portfolio-copy-change'));
      saveDraft();
    }
  }
  function resizeToolbar() {
    if (active) document.documentElement.style.setProperty('--text-editor-height', `${toolbar.getBoundingClientRect().height + 24}px`);
  }
  function exportCopy() {
    document.activeElement?.blur();
    finishEdit();
    saveDraft();
    // Escape markup-looking strings without interpreting them as HTML or code.
    const json = JSON.stringify(overrides, null, 2).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const source = `/* Exported portfolio wording. Replace text-content.js in your project. */\nwindow.PORTFOLIO_COPY = ${json};\n`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'text-content.js'; link.dataset.editorUi = '';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus('Export downloaded. Replace your project’s text-content.js with this file.');
  }
  function insertPlainText(value) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(value);
    range.insertNode(node); range.setStartAfter(node); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
  }

  // Available immediately to the experiment script, before DOMContentLoaded.
  window.PortfolioText = { define, text, bind, clear };
  document.addEventListener('DOMContentLoaded', () => {
    for (const element of document.querySelectorAll('[data-copy]')) {
      const key = element.dataset.copy;
      const section = element.closest('section');
      const context = section?.querySelector('h1,h2')?.textContent.trim() || (element.closest('footer') ? 'Footer' : 'Header / navigation');
      define(key, element.textContent, context);
      if (!bindings.has(element)) bindings.set(element, { key, values: {} });
      apply(element);
    }
    define('meta.title', document.title, 'Browser tab title');
    define('meta.description', document.querySelector('meta[name="description"]').content, 'Search-engine description');
    sync('meta.title'); sync('meta.description');

    // Public visitors see the portfolio. Authoring controls appear locally or
    // when the owner deliberately opens the page with ?edit=1.
    if (!author) return;
    launcher = document.createElement('button');
    launcher.type = 'button'; launcher.className = 'text-editor-launcher';
    launcher.dataset.editorUi = ''; launcher.textContent = 'Edit text';
    launcher.addEventListener('click', () => enable(true));
    document.querySelector('.site-header').append(launcher);
    toolbar = document.createElement('aside');
    toolbar.className = 'text-editor-toolbar'; toolbar.dataset.editorUi = '';
    toolbar.hidden = true; toolbar.setAttribute('aria-label', 'Text editing tools');
    // This fixed editor markup never contains user input; copy uses textContent.
    toolbar.innerHTML = `
      <div class="text-editor-top"><strong>Edit text mode</strong><div class="text-editor-actions">
        <button type="button" data-action="undo" disabled>Undo last edit</button>
        <button type="button" data-action="export" class="editor-export">Export changes</button>
        <button type="button" data-action="done">Done editing</button>
      </div></div>
      <p>Click outlined text and rewrite it. Keep {braced words} for live values. Export, then replace <code>text-content.js</code> in your project.</p>
      <p class="text-editor-status" role="status"></p>
      <details class="text-editor-more"><summary>All wording &amp; page details</summary>
        <label class="text-editor-search">Find text<input type="search" placeholder="Search headings, paragraphs, buttons or feedback"></label>
        <div class="text-editor-fields"></div>
      </details>`;
    document.body.append(toolbar);
    status = toolbar.querySelector('.text-editor-status');
    undoButton = toolbar.querySelector('[data-action="undo"]');
    more = toolbar.querySelector('.text-editor-more');
    fields = toolbar.querySelector('.text-editor-fields');
    search = toolbar.querySelector('input[type="search"]');
    undoButton.addEventListener('click', undo);
    toolbar.querySelector('[data-action="export"]').addEventListener('click', exportCopy);
    toolbar.querySelector('[data-action="done"]').addEventListener('click', () => enable(false));
    more.addEventListener('toggle', () => { if (more.open) renderCatalog(); resizeToolbar(); });
    search.addEventListener('input', filterCatalog);
    if (window.ResizeObserver) new ResizeObserver(resizeToolbar).observe(toolbar);
    window.addEventListener('resize', resizeToolbar);
    window.addEventListener('pagehide', saveDraft);
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveDraft(); });

    document.addEventListener('focusin', event => {
      const element = event.target.closest?.('[data-copy]');
      if (!active || !element || !bindings.has(element)) return;
      finishEdit();
      const key = element.dataset.copy;
      editing = { key, before: raw(key) };
      element.textContent = raw(key); // Show templates, not frozen numerical values.
    });
    document.addEventListener('input', event => {
      const element = event.target.closest?.('[data-copy]');
      if (active && element && bindings.has(element)) setValue(element.dataset.copy, element.innerText.replace(/\r\n/g, '\n'), element);
    });
    document.addEventListener('focusout', event => {
      const element = event.target.closest?.('[data-copy]');
      if (!active || !element || !bindings.has(element)) return;
      finishEdit();
      // Restore plain text after browser-created line-break markup.
      element.textContent = text(element.dataset.copy, definitions.get(element.dataset.copy).fallback, bindings.get(element).values);
    });
    document.addEventListener('paste', event => {
      const element = event.target.closest?.('[data-copy]');
      if (!active || !element) return;
      event.preventDefault();
      insertPlainText(event.clipboardData.getData('text/plain'));
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    document.addEventListener('drop', event => {
      const element = event.target.closest?.('[data-copy]');
      if (!active || !element) return;
      event.preventDefault();
      element.focus();
      insertPlainText(event.dataTransfer.getData('text/plain'));
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    document.addEventListener('beforeinput', event => {
      if (active && event.target.closest?.('[data-copy]') && event.inputType.startsWith('format')) event.preventDefault();
    });
    document.addEventListener('click', event => {
      if (!active || event.target.closest('[data-editor-ui]')) return;
      // Editing link/button wording must not navigate or answer a trial.
      if (event.target.closest('a,button,summary')) {
        if (event.target.closest('summary') && !event.target.closest('[data-copy]')) return;
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('keydown', event => {
      if (active && !event.target.closest('[data-editor-ui]') && event.target.closest('button,a')) event.stopPropagation();
      if (event.altKey && event.shiftKey && event.code === 'KeyE') { event.preventDefault(); enable(!active); }
    }, true);
    if (new URLSearchParams(location.search).get('edit') === '1') enable(true);
  });
})();
