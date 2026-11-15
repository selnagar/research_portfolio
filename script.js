(() => {
  'use strict';

  // Keys retain the existing selector positions. Each now has its explicitly
  // requested configuration/repetition rule; no legacy source swap is needed.
  const regimes = {
    interleaved: 'Fully Interleaved',
    mixed: 'Partially Interleaved',
    category: 'Partially Blocked',
    configuration: 'Fully Blocked'
  };
  const copy = window.PortfolioText;
  const catName = category => copy.text(`cat.${category}`, category === '1' ? 'Black cat' : 'Gray cat');
  const $ = id => document.getElementById(id);
  const input = window.EXPERIMENT_DATA;
  const regimeButtons = [...document.querySelectorAll('#regime-controls [data-regime]')];
  const answerButtons = [...document.querySelectorAll('[data-answer]')];
  const state = { regime: 'interleaved', position: 0, answers: Array(16).fill(null), complete: false };
  let timelineCells = [];
  let data = null;
  let lookup = new Map();
  let ready = false;
  let inspectedItem = null;
  const percent = value => `${Number((value * 100).toFixed(1))}%`;

  // Human-facing strings have stable keys; experiment parameters stay separate.
  for (const [key, name] of Object.entries(regimes)) {
    copy.define(`regime.name.${key}`, name, `Regime name · ${name}`);
    copy.define(`regime.description.${key}`, input?.descriptions?.[key] || '', `Regime description · ${name}`);
  }
  copy.define('cat.1', 'Black cat', 'First cat name');
  copy.define('cat.2', 'Gray cat', 'Second cat name');
  copy.define('feedback.correct', 'Correct', 'Correct-answer feedback');
  copy.define('feedback.incorrect', 'Incorrect', 'Incorrect-answer feedback');
  copy.define('task.complete', 'Training regime complete', 'Completion message');
  copy.define('task.next', 'Next example →', 'Next button');
  copy.define('task.finish', 'Finish regime →', 'Finish button');
  copy.define('task.nextUnanswered', 'Next unanswered →', 'Return-to-unanswered button');
  copy.define('regime.summary', '{presentations} presentations · {configurations} configurations · Black / gray: {firstCount} / {secondCount}', 'Regime counts · keep {braced values}');
  copy.define('food.values', 'Chicken (right) {chickenAngle}° / {chickenPercent} · Fish (left) {fishAngle}° / {fishPercent}', 'Food-value wording · keep {braced values}');
  copy.define('food.inspection', 'Mix {configuration} · {foodValues} · {cat} (Cat {category})', 'Grid inspection wording · keep {braced values}');
  copy.define('task.error', 'Task unavailable: {message} Check experiment-data.js and refresh.', 'Configuration-error message');

  // Fisher–Yates: randomise identities/order once on load, never during a trial.
  function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }
  const repeated = (id, count) => Array(count).fill(id);
  const frequencies = order => [...new Set(order)].map(id => order.filter(value => value === id).length).sort((a, b) => a - b);

  function validateSource(source) {
    if (!source) throw new Error('The study configuration file is missing.');
    for (const key of ['feature1Levels', 'feature2Levels']) {
      const levels = source[key];
      if (!Array.isArray(levels) || levels.length !== 6 || new Set(levels).size !== 6 ||
          levels.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
        throw new Error(`${key} must contain six distinct ratios between 0 and 1.`);
      }
    }
    for (const key of ['categoryMap', 'novelMap']) {
      const map = source[key];
      if (!Array.isArray(map) || map.length !== 6 || map.some(row => !Array.isArray(row) || row.length !== 6)) throw new Error(`${key} must be a 6×6 matrix.`);
    }
    if (source.categoryMap.flat().some(category => ![1, 2].includes(category))) throw new Error('Categories must be 1 or 2.');
    if (source.novelMap.flat().some(novel => typeof novel !== 'boolean')) throw new Error('Old/new assignments must be explicit booleans.');
    if (source.novelMap.flat().filter(Boolean).length !== 18) throw new Error('The reference has exactly 18 new and 18 old configurations.');
    if (source.fullyInterleavedPerCategory !== 8) throw new Error('The fully interleaved regime uses eight old configurations per category.');
  }
  function prepareStudy(source) {
    validateSource(source);
    const stimuli = source.categoryMap.flatMap((row, r) => row.map((category, c) => ({
      id: `F1-${c + 1}_F2-${6 - r}`,
      row: r + 1,
      column: c + 1,
      novel: source.novelMap[r][c],
      category: String(category),
      configuration: `(${c + 1}, ${6 - r})`
    })));
    const sample = ['1', '2'].flatMap(category => {
      const pool = stimuli.filter(item => !item.novel && item.category === category);
      if (pool.length < 8) throw new Error('Each category needs at least eight old configurations.');
      return shuffled(pool).slice(0, 8);
    });
    const three = shuffled(sample).slice(0, 3);
    // The blocked pair has one item per category, keeping those regimes balanced.
    // Sharing it isolates the requested order difference between these two rules.
    const pair = shuffled(['1', '2'].map(category => shuffled(sample.filter(item => item.category === category))[0]));
    const orders = {
      interleaved: shuffled(sample.map(item => item.id)),
      mixed: shuffled(three.flatMap((item, index) => repeated(item.id, index === 2 ? 6 : 5))),
      category: shuffled(pair.flatMap(item => repeated(item.id, 8))),
      configuration: pair.flatMap(item => repeated(item.id, 8))
    };
    const byId = new Map(stimuli.map(item => [item.id, item]));
    for (const [key, order] of Object.entries(orders)) {
      if (order.length !== 16 || order.some(id => !byId.has(id) || byId.get(id).novel)) throw new Error(`${key}: all 16 presentations must use old configurations.`);
      const expected = key === 'interleaved' ? Array(16).fill(1) : key === 'mixed' ? [5, 5, 6] : [8, 8];
      if (JSON.stringify(frequencies(order)) !== JSON.stringify(expected)) throw new Error(`${key}: incorrect configuration/repetition counts.`);
    }
    return { ...source, stimuli, orders };
  }
  // A filled sector occupies ratio × 180 degrees inside its own semicircle.
  // Thus each feature is normalised to its half, not to the whole circle.
  function pie(item) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('pie-svg');
    const shape = (tag, attributes) => {
      const node = document.createElementNS(ns, tag);
      Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
      svg.append(node);
    };
    shape('circle', { cx: 50, cy: 50, r: 46, class: 'pie-background' });
    if (item) {
      const ratios = [data.feature1Levels[item.column - 1], data.feature2Levels[item.row - 1]];
      // Feature 1 fills clockwise from the top into the RIGHT half;
      // feature 2 fills counterclockwise from the top into the LEFT half.
      const start = -Math.PI / 2;
      ratios.forEach((ratio, dimension) => {
        if (ratio === 0) return;
        const direction = dimension === 0 ? 1 : -1;
        const end = start + direction * ratio * Math.PI;
        const point = angle => `${50 + 46 * Math.cos(angle)},${50 + 46 * Math.sin(angle)}`;
        shape('path', { d: `M50,50 L${point(start)} A46,46 0 0 ${dimension === 0 ? 1 : 0} ${point(end)} Z`, class: `pie-fill feature-${dimension + 1}` });
      });
    }
    shape('circle', { cx: 50, cy: 50, r: 46, class: 'pie-outline' });
    shape('line', { x1: 50, y1: 4, x2: 50, y2: 96, class: 'pie-divider' });
    return svg;
  }

  function featureText(item) {
    const f1 = data.feature1Levels[item.column - 1];
    const f2 = data.feature2Levels[item.row - 1];
    return copy.text('food.values', '', { chickenAngle: Math.round(f1 * 180), chickenPercent: percent(f1), fishAngle: Math.round(f2 * 180), fishPercent: percent(f2) });
  }
  function inspect(item) {
    inspectedItem = item;
    $('inspection-pie').replaceChildren(pie(item));
    copy.bind($('inspection-text'), 'food.inspection', '', { configuration: item.configuration, foodValues: featureText(item), cat: catName(item.category), category: item.category });
  }
  function buildGrid() {
    $('stimulus-grid').replaceChildren();
    for (let row = 1; row <= 6; row++) {
      for (let column = 1; column <= 6; column++) {
        const item = ready ? data.stimuli.find(item => item.row === row && item.column === column) : null;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `space-cell${item ? '' : ' pending'}`;
        cell.disabled = !ready;
        cell.append(pie(item));
        if (item) {
          cell.dataset.category = item.category;
          cell.dataset.stimulusId = item.id;
          cell.dataset.novel = String(item.novel);
          cell.setAttribute('aria-label', `Mix ${item.configuration}, ${featureText(item)}, ${catName(item.category)}, Cat ${item.category}`);
          cell.addEventListener('mouseenter', () => inspect(item));
          cell.addEventListener('focus', () => inspect(item));
          cell.addEventListener('click', () => inspect(item));
        } else cell.setAttribute('aria-label', `Row ${row}, column ${column}: configuration unavailable`);
        $('stimulus-grid').append(cell);
      }
    }
    for (const id of ['row-ticks', 'column-ticks']) {
      $(id).replaceChildren(...Array.from({ length: 6 }, (_, index) => {
        const label = document.createElement('span');
        label.textContent = String(id === 'row-ticks' ? 6 - index : index + 1);
        return label;
      }));
    }
    if (ready) inspect(data.stimuli[0]);
    else {
      $('stimulus').replaceChildren(pie(null));
      $('inspection-pie').replaceChildren(pie(null));
    }
  }
  function order() { return data.orders[state.regime]; }
  function buildTimeline() {
    if (!ready) return;
    timelineCells = [];
    $('regime-visualisation').replaceChildren(...order().map((id, index) => {
      const item = lookup.get(id);
      const li = document.createElement('li');
      const preview = document.createElement('div');
      preview.className = 'regime-item';
      preview.dataset.stimulusId = id;
      preview.setAttribute('role', 'img');
      preview.setAttribute('aria-label', `Presentation ${index + 1}: chicken level ${item.column}, fish level ${7 - item.row}, ${catName(item.category)}`);
      preview.append(pie(item));
      const label = document.createElement('span');
      label.textContent = `${item.column} . ${7 - item.row}`;
      preview.append(label);
      li.append(preview);
      timelineCells.push({ li, preview });
      return li;
    }));
  }
  function render() {
    regimeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.regime === state.regime)));
    const name = document.createElement('span');
    const description = document.createElement('span');
    copy.bind(name, `regime.name.${state.regime}`, regimes[state.regime]);
    copy.bind(description, `regime.description.${state.regime}`, input?.descriptions?.[state.regime] || '');
    $('regime-description').replaceChildren(name, document.createTextNode(' — '), description);
    if (!ready) return;
    const ids = order();
    const item = lookup.get(ids[state.position]);
    const answer = state.answers[state.position];
    const answered = answer !== null;
    if (state.complete) copy.bind($('task-status'), 'task.complete', 'Training regime complete');
    else copy.clear($('task-status'));
    const key = `${state.regime}:${state.position}`;
    if ($('stimulus').dataset.presentation !== key) {
      $('stimulus').replaceChildren(pie(item));
      $('stimulus').dataset.presentation = key;
    }
    $('stimulus').setAttribute('aria-label', `${item.id}, ${featureText(item)}`);
    const correct = answered && answer === item.category;
    if (answered) copy.bind($('feedback'), correct ? 'feedback.correct' : 'feedback.incorrect', correct ? 'Correct' : 'Incorrect');
    else copy.clear($('feedback'));
    $('feedback').className = `feedback ${answered ? correct ? 'correct' : 'incorrect' : ''}`;
    answerButtons.forEach(button => {
      button.disabled = answered || state.complete;
      button.setAttribute('aria-pressed', String(button.dataset.answer === answer));
    });
    $('previous').disabled = state.position === 0;
    $('next').disabled = !answered || state.complete;
    const allAnswered = state.answers.every(value => value !== null);
    const nextKey = state.position < 15 ? 'task.next' : allAnswered ? 'task.finish' : 'task.nextUnanswered';
    copy.bind($('next'), nextKey, '');
    $('restart').disabled = false;
    const used = new Set(ids);
    const counts = ['1', '2'].map(category => ids.filter(id => lookup.get(id).category === category).length);
    copy.bind($('regime-summary'), 'regime.summary', '', { presentations: 16, configurations: used.size, firstCount: counts[0], secondCount: counts[1] });
    timelineCells.forEach(({ li, preview }, index) => {
      li.classList.toggle('current', index === state.position);
      li.classList.toggle('answered', state.answers[index] !== null);
      if (index === state.position) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
  }
  function goTo(position) {
    if (!ready) return;
    state.position = Math.max(0, Math.min(15, position));
    state.complete = false;
    render();
  }
  function reset(regime = state.regime) {
    Object.assign(state, { regime, position: 0, answers: Array(16).fill(null), complete: false });
    buildTimeline();
    render();
  }
  regimeButtons.forEach(button => button.addEventListener('click', () => reset(button.dataset.regime)));
  answerButtons.forEach(button => button.addEventListener('click', () => {
    if (!ready || state.complete || state.answers[state.position] !== null) return;
    state.answers[state.position] = button.dataset.answer;
    render();
    $('next').focus();
  }));
  $('previous').addEventListener('click', () => goTo(state.position - 1));
  $('next').addEventListener('click', () => {
    if (!ready || state.complete || state.answers[state.position] === null) return;
    if (state.position < 15) goTo(state.position + 1);
    else {
      const unanswered = state.answers.findIndex(value => value === null);
      if (unanswered !== -1) goTo(unanswered);
      else { state.complete = true; render(); $('restart').focus(); return; }
    }
    if (!answerButtons[0].disabled) answerButtons[0].focus();
  });
  $('restart').addEventListener('click', () => reset());

  try {
    data = prepareStudy(input);
    ready = true;
    lookup = new Map(data.stimuli.map(item => [item.id, item]));
  } catch (error) {
    $('data-badge').textContent = 'CHECK STUDY DATA';
    $('data-status').hidden = false;
    copy.bind($('data-status'), 'task.error', '', { message: error.message });
    $('task-status').textContent = 'Task unavailable';
  }
  document.addEventListener('portfolio-copy-change', () => {
    render();
    if (ready) inspect(inspectedItem || data.stimuli[0]);
  });
  // Centre the illustration on the headline, rather than on the entire intro.
  // Resize/copy changes are measured so authored wording remains independent.
  const heroTitle = document.getElementById('hero-title');
  const heroArt = document.querySelector('.hero-art');
  let heroOffset = 0;
  let heroFrame;
  function alignHeroArt() {
    cancelAnimationFrame(heroFrame);
    heroFrame = requestAnimationFrame(() => {
      let nextOffset = 0;
      if (window.innerWidth > 760) {
        const title = heroTitle.getBoundingClientRect();
        const art = heroArt.getBoundingClientRect();
        nextOffset = heroOffset + title.top + title.height / 2 - art.top - art.height / 2;
      }
      if (Math.abs(nextOffset - heroOffset) > 0.25) {
        heroOffset = nextOffset;
        heroArt.style.setProperty('--hero-art-offset', `${heroOffset.toFixed(2)}px`);
      }
    });
  }
  if (window.ResizeObserver) {
    const heroObserver = new ResizeObserver(alignHeroArt);
    heroObserver.observe(heroTitle);
    heroObserver.observe(document.querySelector('.hero-copy'));
    heroObserver.observe(heroArt);
  }
  window.addEventListener('resize', alignHeroArt);
  document.addEventListener('portfolio-copy-change', alignHeroArt);
  document.fonts?.ready.then(alignHeroArt);
  alignHeroArt();
  buildGrid();
  reset();
})();
