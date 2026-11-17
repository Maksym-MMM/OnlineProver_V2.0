// Live conversion of what the user types into logic symbols.
// -> => ⇒   /\ & && ∧   \/ | || ∨   ~ ! ¬   _|_ ⊥   |- ⊢   <-> ⇔
const RULES = [
  [/<->|<=>/g, '⇔'],
  [/\|-/g, '⊢'],
  [/_\|_/g, '⊥'],
  [/->|=>|→/g, '⇒'],
  [/\/\\|&&|&/g, '∧'],
  [/\\\/|\|\||(?<!_)\|(?!-|$)/g, '∨'],
  [/[~!]/g, '¬'],
];

export function toLogicSymbols(text) {
  let s = text;
  for (const [re, sym] of RULES) s = s.replace(re, sym);
  return s;
}

/** Converts an input value in place, keeping the caret position. */
export function convertInputInPlace(input) {
  const caret = input.selectionStart ?? input.value.length;
  const before = toLogicSymbols(input.value.slice(0, caret));
  const all = toLogicSymbols(input.value);
  if (all === input.value) return;
  input.value = all;
  const pos = Math.min(before.length, all.length);
  input.setSelectionRange(pos, pos);
}

