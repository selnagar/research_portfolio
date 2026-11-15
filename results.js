/* Independent results viewers: the learning task does not generate these data. */
(() => {
  'use strict';
  const { regimes, accuracyRegression, bootstrapResamples } = window.PORTFOLIO_RESULTS;
  const copy = window.PortfolioText;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const state = { accuracy: 0, bic: 0 };
  const charts = {};
  const animations = {};
  let shownAccuracy = regimes[0].accuracy;
  let shownBic = { ...regimes[0].bic };

  function svgNode(tag, attributes = {}, text) {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function append(svg, tag, attributes, text) {
    const node = svgNode(tag, attributes, text);
    svg.append(node);
    return node;
  }
  function wording(element, key, fallback, values) {
    copy.bind(element, key, fallback, values);
  }
  function animate(key, draw) {
    cancelAnimationFrame(animations[key]);
    if (motion.matches) { draw(1); return; }
    const start = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - start) / 320);
      draw(1 - (1 - progress) ** 3);
      if (progress < 1) animations[key] = requestAnimationFrame(tick);
    };
    animations[key] = requestAnimationFrame(tick);
  }
  function announcement(kind, message) {
    charts[kind].announcement.textContent = message;
  }

  function drawAccuracy() {
    const { svg } = charts.accuracy;
    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height) return;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const left = 27, right = width - 4, bottom = height - 34, top = 8;
    const y = accuracy => bottom - accuracy * (bottom - top);
    for (let tick = 0; tick <= 5; tick++) {
      const value = tick / 5;
      append(svg, 'line', { x1: left, x2: right, y1: y(value), y2: y(value), class: 'results-gridline' });
      append(svg, 'text', { x: left - 6, y: y(value) + 3, 'text-anchor': 'end' }, value.toFixed(1));
    }
    append(svg, 'line', { x1: left, x2: left, y1: top, y2: bottom, class: 'results-axis' });
    append(svg, 'line', { x1: left, x2: right, y1: bottom, y2: bottom, class: 'results-axis' });
    const slot = (right - left) / 4;
    regimes.forEach((regime, index) => {
      const x = left + slot * (index + .5);
      append(svg, 'rect', {
        x: x - slot * .3, y: y(regime.accuracy), width: slot * .6,
        height: bottom - y(regime.accuracy), 'data-result-regime': regime.id,
        class: `accuracy-bar${index === state.accuracy ? ' is-selected' : ''}`
      });
      const label = append(svg, 'text', {
        x, y: bottom + 14, 'text-anchor': 'middle',
        class: index === state.accuracy ? 'selected-label' : '',
        style: `font-size:${width < 260 ? 9 : 10}px`
      });
      const words = copy.text(`results.regime.${regime.id}`, regime.label).split(' ');
      words.forEach((word, row) => label.append(svgNode('tspan', { x, dy: row ? 12 : 0 }, word)));
    });
    svg.setAttribute('aria-label', regimes.map(r => `${r.label}: ${(r.accuracy * 100).toFixed(1)}%`).join('; ') + '. Accuracy axis from zero to one.');
  }
  function paintAccuracyValue(value) {
    shownAccuracy = value;
    document.getElementById('accuracy-value').textContent = `${(value * 100).toFixed(1)}%`;
  }
  function updateAccuracy(transition = true) {
    if (!transition) cancelAnimationFrame(animations.accuracy);
    const regime = regimes[state.accuracy];
    charts.accuracy.svg.querySelectorAll('.accuracy-bar').forEach((bar, index) => {
      bar.classList.toggle('is-selected', index === state.accuracy);
    });
    charts.accuracy.svg.querySelectorAll('text.selected-label').forEach(label => label.classList.remove('selected-label'));
    // Reuse the bars during selection changes, preserving their CSS highlight transitions.
    const labels = [...charts.accuracy.svg.children].filter(node => node.tagName === 'text' && node.querySelector('tspan'));
    labels[state.accuracy]?.classList.add('selected-label');
    const interpretations = [
      'Highest test accuracy was observed after fully interleaved training.',
      'Partially interleaved training had lower test accuracy than fully interleaved training.',
      'Test accuracy was lower in the more blocked regimes.',
      'Test accuracy was lower in the more blocked regimes.'
    ];
    wording(document.getElementById('accuracy-interpretation'), `results.accuracy.interpretation.${regime.id}`, interpretations[state.accuracy]);
    wording(document.getElementById('accuracy-regression'), 'results.accuracy.regression', 'OLS β = {slope} · p = {p} · R² = {rSquared}', accuracyRegression);
    announcement('accuracy', `${regime.label}. Mean test accuracy: ${(regime.accuracy * 100).toFixed(1)}%. ${interpretations[state.accuracy]}`);
    const from = shownAccuracy;
    if (transition) animate('accuracy', t => paintAccuracyValue(from + (regime.accuracy - from) * t));
    else paintAccuracyValue(regime.accuracy);
  }

  function drawBic() {
    const chart = charts.bic, { svg } = chart;
    const { width, height } = svg.getBoundingClientRect();
    if (!width || !height) return;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const left = 16, right = width - 12, axisY = height - 29;
    chart.x = value => left + (value + 25) / 115 * (right - left);
    chart.dotY = (14 + axisY) / 2;
    chart.capSize = Math.max(3, Math.min(6, (axisY - 14) / 2 - 2));
    append(svg, 'text', { x: left, y: 10 }, copy.text('results.bic.wm', 'WM favoured'));
    append(svg, 'text', { x: right, y: 10, 'text-anchor': 'end' }, copy.text('results.bic.rul', 'RuL favoured'));
    // This line and the axis are rebuilt only on resize, never during a transition.
    append(svg, 'line', { x1: chart.x(0), x2: chart.x(0), y1: 15, y2: axisY, class: 'bic-zero' });
    append(svg, 'line', { x1: left, x2: right, y1: axisY, y2: axisY, class: 'results-axis' });
    [-25, 0, 30, 60, 90].forEach(tick => {
      const x = chart.x(tick);
      append(svg, 'line', { x1: x, x2: x, y1: axisY, y2: axisY + 3, class: 'results-axis' });
      append(svg, 'text', { x, y: axisY + 13, 'text-anchor': 'middle' }, tick > 0 ? `+${tick}` : tick);
    });
    append(svg, 'text', { x: width / 2, y: height - 1, 'text-anchor': 'middle' }, copy.text('results.bic.axis', 'ΔBIC = Best WM − Best RuL'));
    chart.interval = append(svg, 'line', { class: 'bic-interval' });
    chart.lower = append(svg, 'line', { class: 'bic-interval' });
    chart.upper = append(svg, 'line', { class: 'bic-interval' });
    chart.dot = append(svg, 'circle', { r: chart.capSize, class: 'bic-dot' });
    paintBic(shownBic);
  }
  function paintBic(values) {
    shownBic = { ...values };
    const chart = charts.bic;
    if (chart.x) {
      const { x, dotY, capSize, interval, lower, upper, dot } = chart;
      Object.entries({ x1: x(values.lower), x2: x(values.upper), y1: dotY, y2: dotY }).forEach(([k, v]) => interval.setAttribute(k, v));
      [[lower, values.lower], [upper, values.upper]].forEach(([node, value]) => {
        Object.entries({ x1: x(value), x2: x(value), y1: dotY - capSize, y2: dotY + capSize }).forEach(([k, v]) => node.setAttribute(k, v));
      });
      dot.setAttribute('cx', x(values.mean)); dot.setAttribute('cy', dotY);
    }
    document.getElementById('bic-mean').textContent = values.mean.toFixed(2);
    document.getElementById('bic-ci').textContent = `[${values.lower.toFixed(2)}, ${values.upper.toFixed(2)}]`;
  }
  function updateBic(transition = true) {
    if (!transition) cancelAnimationFrame(animations.bic);
    const regime = regimes[state.bic];
    const interpretation = state.bic < 2 ? 'Rule Learning favoured' : 'Slight Rule Learning preference, relatively more Working Memory preference';
    wording(document.getElementById('bic-interpretation'), state.bic < 2 ? 'results.bic.rul-preference' : 'results.bic.slight-preference', interpretation);
    wording(document.getElementById('bic-method'), 'results.bic.method', 'Group-level comparison · {resamples} bootstrap resamples.', { resamples: bootstrapResamples.toLocaleString('en-GB') });
    const message = `${regime.label}. Mean ΔBIC: ${regime.bic.mean.toFixed(2)}. 95% confidence interval: [${regime.bic.lower.toFixed(2)}, ${regime.bic.upper.toFixed(2)}]. ${interpretation}. Group-level model-family comparison, not individual participant classifications. Intervals use ${bootstrapResamples.toLocaleString('en-GB')} bootstrap resamples.`;
    charts.bic.svg.setAttribute('aria-label', message + ' Fixed axis from −25 to +90; negative favours Working Memory, positive favours Rule Learning.');
    announcement('bic', message);
    const from = { ...shownBic }, to = regime.bic;
    if (transition) animate('bic', t => paintBic(Object.fromEntries(Object.keys(to).map(key => [key, from[key] + (to[key] - from[key]) * t]))));
    else paintBic(to);
  }

  for (const kind of ['accuracy', 'bic']) {
    const selector = document.getElementById(`${kind}-regime`);
    regimes.forEach((regime, index) => {
      const option = document.createElement('option');
      option.value = index;
      wording(option, kind === 'accuracy' ? `results.regime.${regime.id}` : `results.manuscript.${regime.id}`, kind === 'accuracy' ? regime.label : regime.manuscriptLabel);
      selector.append(option);
    });
    const svg = document.getElementById(`${kind}-plot`);
    const status = document.createElement('div');
    status.className = 'results-announcement'; status.setAttribute('role', 'status'); status.setAttribute('aria-atomic', 'true');
    svg.closest('.results-frame').append(status);
    charts[kind] = { svg, selector, announcement: status };
    selector.addEventListener('change', () => {
      state[kind] = Number(selector.value);
      if (kind === 'accuracy') updateAccuracy(); else updateBic();
    });
  }
  const observer = new ResizeObserver(entries => {
    entries.forEach(({ target }) => target.id === 'accuracy-plot' ? drawAccuracy() : drawBic());
  });
  observer.observe(charts.accuracy.svg); observer.observe(charts.bic.svg);
  updateAccuracy(false); updateBic(false);
  document.addEventListener('portfolio-copy-change', () => {
    drawAccuracy(); drawBic(); updateAccuracy(false); updateBic(false);
  });
})();
