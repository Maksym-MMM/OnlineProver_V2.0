// OnlineProver 2.0 - UI.
// Two screens: enter a formula, then prove it the LogicProof way:
// select an open goal in the tree, then click a rule.
import { parseFormula, parseSequent, ParseError } from './parser/parse.js';
import { show, member, counterexample } from './core/formula.js';
import { RULES, applicableRules } from './core/rules.js';
import { newNode, validate, applyRule, findNode, serialize, deserialize } from './core/proof.js';
import { convertInputInPlace } from './core/symbols.js';
import { suggestFormulas } from './core/suggest.js';
import { equal } from './core/formula.js';

// ---------- DOM helpers ----------
const $ = sel => document.querySelector(sel);
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) e.append(c);
  return e;
}
const sym = f => show(f, 'unicode');
const valuation = v => Object.entries(v).map(([k, b]) => `${k} = ${b ? 1 : 0}`).join(', ');

// ---------- rule cards (premises / conclusion, as GENTZEN_BUTTONS in LogicProof) ----------
const CARDS = [
  ['Ax', ['φ ∈ Γ'], 'Γ ⊢ φ'],
  ['BotE', ['Γ ⊢ ⊥'], 'Γ ⊢ φ'],
  ['RAA', ['Γ, ¬φ ⊢ ⊥'], 'Γ ⊢ φ'],
  ['TopI', [], 'Γ ⊢ ⊤'],
  ['NotI', ['Γ, φ ⊢ ⊥'], 'Γ ⊢ ¬φ'],
  ['NotE', ['Γ ⊢ φ', 'Γ ⊢ ¬φ'], 'Γ ⊢ ⊥'],
  ['AndI', ['Γ ⊢ φ', 'Γ ⊢ ψ'], 'Γ ⊢ φ ∧ ψ'],
  ['AndE1', ['Γ ⊢ φ ∧ ψ'], 'Γ ⊢ φ'],
  ['AndE2', ['Γ ⊢ φ ∧ ψ'], 'Γ ⊢ ψ'],
  ['OrI1', ['Γ ⊢ φ'], 'Γ ⊢ φ ∨ ψ'],
  ['OrI2', ['Γ ⊢ ψ'], 'Γ ⊢ φ ∨ ψ'],
  ['OrE', ['Γ ⊢ φ ∨ ψ', 'Γ, φ ⊢ θ', 'Γ, ψ ⊢ θ'], 'Γ ⊢ θ'],
  ['ImpI', ['Γ, φ ⊢ ψ'], 'Γ ⊢ φ ⇒ ψ'],
  ['ImpE', ['Γ ⊢ φ', 'Γ ⊢ φ ⇒ ψ'], 'Γ ⊢ ψ'],
];
// What each rule asks for; g is the current goal as text.
const ASKS = {
  NotE: () => 'Enter φ: you will prove both φ and ¬φ',
  AndE1: g => `Enter ψ to use the conjunction ${g} ∧ ψ`,
  AndE2: g => `Enter φ to use the conjunction φ ∧ ${g}`,
  OrE: () => 'Enter the disjunction φ ∨ ψ to split on',
  ImpE: g => `Enter φ to use the implication φ ⇒ ${g}`,
};

// Input syntax shown on the start screen: symbol and the ASCII keys that produce it.
const INPUT_SYNTAX = [
  ['⇒', 'implication', ['->', '=>']],
  ['∧', 'conjunction', ['&', '/\\']],
  ['∨', 'disjunction', ['|', '\\/']],
  ['¬', 'negation', ['~', '!']],
  ['⊥', 'falsum', ['_|_']],
  ['⊢', 'turnstile', ['|-']],
];

// ---------- state ----------
const state = { goalText: '', assumptions: [], root: null, history: [], selectedId: null, result: null };
let draft = '';

// ================= screen 1: enter a formula =================
function renderStart() {
  document.title = 'OnlineProver 2.0';
  const input = el('input', {
    class: 'formula-input', value: draft, spellcheck: 'false', autocomplete: 'off',
    placeholder: '(A ⇒ B) ∧ (A ⇒ C) ⇒ (A ⇒ B ∧ C)', 'aria-label': 'Formula to prove',
  });
  const feedback = el('div', { class: 'feedback', 'aria-live': 'polite' });
  const prove = el('button', { class: 'btn primary', onclick: () => start() }, 'Prove');

  function update() {
    draft = input.value;
    feedback.replaceChildren();
    prove.disabled = true;
    if (!input.value.trim()) return;
    try {
      const seq = parseSequent(input.value);
      const cex = counterexample(seq.assumptions, seq.goal);
      if (cex) {
        feedback.append(el('span', { class: 'note' }, `Not provable — counterexample: ${valuation(cex)}`));
      }
      prove.disabled = false;
    } catch (e) {
      feedback.append(el('span', { class: 'note' }, e instanceof ParseError ? e.message : 'Could not parse the formula'));
    }
  }
  function start() {
    if (prove.disabled) return;
    location.hash = `#/prove/${encodeURIComponent(input.value.trim())}`;
  }
  input.addEventListener('input', () => { convertInputInPlace(input); update(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') start(); });

  $('#app').replaceChildren(el('section', { class: 'start' },
    el('h1', {}, 'OnlineProver 2.0'),
    el('p', { class: 'sub' }, 'Natural deduction in Gentzen style. Enter a formula or a sequent Γ ⊢ φ.'),
    el('div', { class: 'input-row' }, input, prove),
    feedback,
    el('section', { class: 'syntax', 'aria-label': 'Input syntax' },
      el('h2', { class: 'side-title' }, 'How to type symbols'),
      el('div', { class: 'syntax-grid' }, ...INPUT_SYNTAX.map(([symbol, name, keys]) => el('div', { class: 'syntax-item' },
        el('span', { class: 'syntax-sym' }, symbol),
        el('span', { class: 'syntax-name' }, name),
        el('span', { class: 'syntax-keys' }, ...keys.map(k => el('kbd', {}, k))))))),
  ));
  update();
  input.focus();
}

// ================= screen 2: proof =================
function openProof(text) {
  const seq = parseSequent(text);
  draft = text;
  state.assumptions = seq.assumptions;
  state.goalText = (seq.assumptions.length ? seq.assumptions.map(sym).join(', ') + ' ' : '') + '⊢ ' + sym(seq.goal);
  state.history = [];
  state.root = newNode(sym(seq.goal));
  state.selectedId = state.root.id;

  document.title = `${state.goalText} · OnlineProver 2.0`;
  $('#app').replaceChildren(el('div', { class: 'workspace' },
    el('aside', { class: 'rules', 'aria-label': 'Hypotheses and rules' },
      el('section', { class: 'hyps', id: 'hyps', 'aria-label': 'Hypotheses' }),
      el('h2', { class: 'side-title' }, 'Rules'),
      el('div', { id: 'rule-cards', class: 'rule-cards' })),
    el('section', { class: 'stage' },
      el('header', { class: 'stage-bar' },
        el('a', { class: 'btn', href: '#/' }, '← New formula'),
        el('span', { class: 'goal-text' }, state.goalText),
        el('button', { class: 'btn', id: 'btn-undo', onclick: undo, title: 'Undo step (Ctrl+Z)' }, 'Undo')),
      el('div', { class: 'canvas' }, el('div', { class: 'tree', id: 'tree' })),
      el('footer', { class: 'status', id: 'status' })),
  ));
  render();
}

function runValidation() {
  state.result = validate(state.root, { assumptions: state.assumptions, classical: true, implicitAx: false });
}

function render() {
  closePopover();
  runValidation();
  $('#tree').replaceChildren(renderNode(state.root));
  $('#btn-undo').disabled = state.history.length === 0;
  renderHypotheses();
  renderRules();
  renderStatus();
  $('#tree .seq.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function renderNode(node) {
  const info = state.result.byId.get(node.id);
  const open = !node.rule.trim();
  const ctxTitle = info.context.length ? `Γ = { ${info.context.map(sym).join(', ')} }` : 'Γ = ∅';
  const seq = el('button', {
    class: 'seq' + (open ? ' open' : '') + (node.id === state.selectedId ? ' selected' : ''),
    title: ctxTitle, onclick: () => { state.selectedId = node.id; render(); },
  }, el('span', { class: 'ctx' }, info.context.length ? 'Γ ⊢ ' : '⊢ '), node.text);

  const wrap = el('div', { class: 'nd' });
  if (!open) {
    wrap.append(
      el('div', { class: 'nd-premises' }, ...node.premises.map(renderNode)),
      el('div', { class: 'nd-bar' }),
      el('span', { class: 'nd-rule' }, `(${RULES[info.ruleId]?.label ?? node.rule})`),
    );
  }
  wrap.append(el('div', { class: 'nd-concl' }, seq));
  return wrap;
}

function selectedGoal() {
  const node = state.selectedId != null ? findNode(state.root, state.selectedId)?.node : null;
  if (!node || node.rule.trim()) return null;
  const info = state.result.byId.get(node.id);
  return info?.formula ? { node, info } : null;
}

// Hypotheses of the selected node, each with the rule that introduced it.
function hypothesesWithOrigin(targetId) {
  const { byId } = state.result;
  const walk = (node, hyps) => {
    if (node.id === targetId) return hyps;
    const label = RULES[byId.get(node.id).ruleId]?.label ?? node.rule;
    for (const p of node.premises) {
      const added = byId.get(p.id).context.filter(f => !hyps.some(h => equal(h.f, f)));
      const r = walk(p, [...hyps, ...added.map(f => ({ f, from: label }))]);
      if (r) return r;
    }
    return null;
  };
  return walk(state.root, byId.get(state.root.id).context.map(f => ({ f, from: 'given' }))) || [];
}

function renderHypotheses() {
  const box = $('#hyps');
  const node = state.selectedId != null ? findNode(state.root, state.selectedId)?.node : null;
  if (!node) { box.replaceChildren(); return; }
  const info = state.result.byId.get(node.id);
  const hyps = hypothesesWithOrigin(node.id);
  const isGoal = !node.rule.trim();
  box.replaceChildren(
    el('h2', { class: 'side-title' }, 'Hypotheses', el('span', { class: 'count-badge' }, String(hyps.length))),
    hyps.length
      ? el('ol', { class: 'hyp-list' }, ...hyps.map(({ f, from }, i) => {
        const matches = isGoal && info.formula && equal(f, info.formula);
        return el('li', {},
          el('button', {
            class: 'hyp' + (matches ? ' match' : ''),
            title: matches ? 'Matches the goal - click to close it with Ax' : pop ? 'Insert into the rule input' : 'Hypothesis',
            onclick: () => onHypothesisClick(f, matches),
          },
          el('span', { class: 'hyp-index' }, `${i + 1}`),
          el('span', { class: 'hyp-f' }, sym(f)),
          el('span', { class: 'hyp-from' }, matches ? 'goal · Ax' : from === 'given' ? 'given' : `(${from})`)));
      }))
      : el('p', { class: 'empty' }, 'No hypotheses yet. ⇒I, ¬I, ∨E and ⊥E₂ add them.'),
  );
}

function onHypothesisClick(f, matches) {
  const input = pop?.querySelector('input');
  if (input) { input.value = sym(f); input.focus(); return; }
  const goal = selectedGoal();
  if (matches && goal) apply(goal.node, 'Ax');
}

function renderRules() {
  const goal = selectedGoal();
  const usable = new Set(goal
    ? applicableRules(goal.info.formula, { classical: true }).filter(id => id !== 'Ax' || member(goal.info.formula, goal.info.context))
    : []);
  $('#rule-cards').replaceChildren(...CARDS.map(([id, top, bottom]) => el('button', {
    class: 'card', disabled: !usable.has(id), onclick: e => chooseRule(id, e.currentTarget),
    'aria-label': `Rule ${RULES[id].label}`,
  },
  el('span', { class: 'frac' },
    el('span', { class: 'frac-top' }, ...(top.length ? top.map(t => el('span', {}, t)) : [el('span', {}, ' ')])),
    el('span', { class: 'frac-bot' }, bottom)),
  el('span', { class: 'card-name' }, `(${RULES[id].label})`))));
}

function renderStatus() {
  const { solved, byId } = state.result;
  const goal = selectedGoal();
  const parts = [];
  if (solved) {
    parts.push(el('span', { class: 'done' }, 'Proof complete.'));
  } else if (goal) {
    const ctx = goal.info.context.map(sym).join(', ');
    parts.push(el('span', { class: 'label' }, 'Goal'), el('span', { class: 'seq-text' }, `${ctx ? ctx + ' ' : ''}⊢ ${goal.node.text}`));
    if (goal.info.counterexample) {
      parts.push(el('span', { class: 'note' }, `Dead end — counterexample: ${valuation(goal.info.counterexample)}`));
    }
  } else {
    parts.push(el('span', { class: 'label' }, 'Select an open goal in the tree'));
  }
  const open = [...byId.values()].filter(i => i.status !== 'ok').length;
  parts.push(el('span', { class: 'count' }, solved ? '' : `${open} open goal${open === 1 ? '' : 's'}`));
  $('#status').replaceChildren(...parts);
}

// ---------- actions ----------
function firstOpen(node = state.root) {
  if (!node.rule.trim()) return node.id;
  for (const p of node.premises) {
    const r = firstOpen(p);
    if (r != null) return r;
  }
  return null;
}

function undo() {
  const snap = state.history.pop();
  if (!snap) return;
  state.root = deserialize(JSON.parse(snap));
  runValidation();
  state.selectedId = firstOpen() ?? state.root.id;
  render();
}

function chooseRule(id, anchor) {
  const goal = selectedGoal();
  if (!goal) return;
  if (RULES[id].needs) askFormula(goal.node, id, anchor);
  else apply(goal.node, id);
}

function apply(node, id, extra = null) {
  state.history.push(JSON.stringify(serialize(state.root)));
  applyRule(node, id, extra, 'unicode');
  runValidation();
  state.selectedId = firstOpen(node) ?? firstOpen() ?? node.id;
  render();
}

let pop = null;
function closePopover() { pop?.remove(); pop = null; }

function askFormula(node, id, anchor) {
  closePopover();
  const input = el('input', { class: 'formula-input small', spellcheck: 'false', autocomplete: 'off' });
  const err = el('div', { class: 'note' });
  const go = () => {
    try {
      const f = parseFormula(input.value);
      if (id === 'OrE' && f.t !== 'or') throw new ParseError('A disjunction φ ∨ ψ is required');
      apply(node, id, f);
    } catch (e) {
      err.textContent = e instanceof ParseError ? e.message : 'Error';
    }
  };
  input.addEventListener('input', () => { convertInputInPlace(input); err.textContent = ''; });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); if (e.key === 'Escape') closePopover(); });
  const info = state.result.byId.get(node.id);
  const { best, other } = suggestFormulas(id, info.formula, info.context);
  const chip = (f, strong) => el('button', {
    class: 'chip' + (strong ? ' strong' : ''), type: 'button',
    title: strong ? 'Fits a hypothesis - double-click to apply' : 'Use this formula',
    onclick: () => { input.value = sym(f); err.textContent = ''; input.focus(); },
    ondblclick: () => apply(node, id, f),
  }, sym(f));
  const suggestions = [];
  if (best.length) suggestions.push(el('div', { class: 'chip-label' }, 'Suggested'), el('div', { class: 'chips' }, ...best.map(f => chip(f, true))));
  if (other.length) suggestions.push(el('div', { class: 'chip-label' }, 'From the proof'), el('div', { class: 'chips' }, ...other.map(f => chip(f, false))));
  if (best.length) input.value = sym(best[0]);

  pop = el('div', { class: 'popover', role: 'dialog', 'aria-label': `Rule ${RULES[id].label}` },
    el('div', { class: 'pop-title' }, `(${RULES[id].label}) ${ASKS[id](node.text)}`),
    input, err, ...suggestions,
    el('div', { class: 'pop-actions' },
      el('button', { class: 'btn', onclick: closePopover }, 'Cancel'),
      el('button', { class: 'btn primary', onclick: go }, 'Apply')));
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.min(window.innerWidth - pop.offsetWidth - 12, r.right + 8)}px`;
  pop.style.top = `${Math.max(12, Math.min(window.innerHeight - pop.offsetHeight - 12, r.top))}px`;
  input.focus();
  input.select();
  renderHypotheses();
}

// ---------- routing ----------
function route() {
  closePopover();
  const m = location.hash.match(/^#\/prove\/(.+)$/);
  if (m) {
    try { return openProof(decodeURIComponent(m[1])); } catch { }
  }
  renderStart();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePopover();
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !(e.target instanceof HTMLInputElement) && $('#tree')) {
    e.preventDefault();
    undo();
  }
});
document.addEventListener('mousedown', e => {
  if (pop && !pop.contains(e.target) && !e.target.closest('.card, .hyp')) closePopover();
});
window.addEventListener('hashchange', route);
route();
