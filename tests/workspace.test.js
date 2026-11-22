import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspace } from '../src/workspace.js';

function observable(object = {}) {
  const listeners = new Map();
  object.addEventListener = (event, listener) => {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(listener);
  };
  object.fire = (name, details = {}) => {
    const event = { target: object, preventDefault() {}, ...details };
    for (const listener of listeners.get(name) || []) listener(event);
  };
  return object;
}

function fixture(mobile = false) {
  const media = observable({ matches: mobile });
  const window = observable({ innerWidth: 1200, innerHeight: 800, matchMedia: () => media });
  const document = observable({ defaultView: window, documentElement: { clientWidth: 0 } });
  const number = (properties, name) => Number.parseFloat(properties.get(name) || '0px');

  document.createElement = (tagName, className) => {
    const children = [];
    const properties = new Map();
    const attributes = new Map();
    const element = observable({
      ownerDocument: document, tagName, className, children, dataset: {},
      style: { setProperty: (name, value) => properties.set(name, value) },
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: name => attributes.get(name),
      append(child) { child.parent = element; children.push(child); },
      remove() { element.parent.children.splice(element.parent.children.indexOf(element), 1); element.parent = undefined; },
      contains(child) { return child === element || children.some(candidate => candidate.contains(child)); },
      closest(selector) { return element.classList.has(selector.slice(1)) ? element : element.parent?.closest(selector); },
      querySelector(selector) {
        let child = children.find(candidate => selector === candidate.tagName || candidate.classList.has(selector.slice(1)));
        if (!child) {
          child = selector.startsWith('.') ? document.createElement('div', selector.slice(1)) : document.createElement(selector);
          element.append(child);
        }
        return child;
      },
      focus() { document.activeElement = element; },
      show() { element.open = true; element.modal = false; },
      showModal() { element.open = true; element.modal = true; },
      close() { element.open = false; element.modal = false; },
      setPointerCapture(pointer) { element.captured = pointer; },
      hasPointerCapture(pointer) { return element.captured === pointer; },
      releasePointerCapture() { element.captured = undefined; },
      getBoundingClientRect() {
        return { left: number(properties, '--workspace-x'), top: number(properties, '--workspace-y'), width: 400, height: 300 };
      },
    });
    Object.defineProperty(element, 'isConnected', { get: () => element === document.body || Boolean(element.parent?.isConnected) });
    element.classList = {
      has(token) { return element.className?.split(' ').includes(token); },
      toggle(token, force) {
        const tokens = new Set((element.className || '').split(' ').filter(Boolean));
        if (force) tokens.add(token);
        else tokens.delete(token);
        element.className = [...tokens].join(' ');
      },
      add(token) { element.classList.toggle(token, true); },
      remove(token) { element.classList.toggle(token, false); },
    };
    return element;
  };
  document.body = document.createElement('body');
  const host = document.createElement('div');
  const trigger = document.createElement('button');
  document.body.append(host);
  document.body.append(trigger);
  const manager = createWorkspace(host);
  const dock = host.children[0];
  const dialog = index => host.children[index + 1];
  const open = (id, opener = trigger) => manager.open({ id, title: id, kind: 'Dossier', content: '<p>Une pièce</p>', trigger: opener });
  return { manager, host, dock, dialog, open, trigger, window, document, media };
}

test('fenêtres de bureau indépendantes, réduction et retour depuis le dock', () => {
  const { manager, dock, dialog, open, document } = fixture();
  assert.equal(dock.hidden, true);
  open('Licence');
  open('Master');
  const first = dialog(0);
  const second = dialog(1);
  assert.equal(first.open, true);
  assert.equal(second.open, true);
  assert.equal(first.modal, false);
  assert.equal(second.modal, false);
  assert.deepEqual(dock.children.map(tab => tab.dataset.state), ['open', 'active']);
  const heading = second.querySelector('h2');
  assert.equal(document.activeElement, heading);
  assert.equal(second.getAttribute('aria-labelledby'), 'workspace-title-2');
  second.querySelector('.workspace-minimize').fire('click');
  assert.equal(second.open, false);
  assert.equal(document.activeElement, dock.children[1]);
  assert.deepEqual(dock.children.map(tab => tab.dataset.state), ['active', 'minimized']);
  dock.children[1].fire('click');
  assert.equal(second.open, true);
  assert.equal(document.activeElement, heading);
  manager.closeAll();
  assert.equal(dock.hidden, true);
  assert.equal(dock.children.length, 0);
});

test('déplacement limité à la fenêtre du navigateur avec alternative par bouton', () => {
  const { open, dialog, window } = fixture();
  open('Licence');
  const frame = dialog(0);
  const grip = frame.querySelector('.workspace-title');
  const bounds = frame.getBoundingClientRect();
  grip.fire('pointerdown', { pointerId: 2, button: 0, isPrimary: true, clientX: bounds.left + 30, clientY: bounds.top + 20 });
  assert.equal(grip.captured, 2);
  assert.ok(frame.classList.has('workspace-dragging'));
  grip.fire('pointermove', { pointerId: 2, clientX: -20, clientY: 1100 });
  grip.fire('pointerup', { pointerId: 2 });
  assert.equal(frame.getBoundingClientRect().left, 12);
  assert.equal(frame.getBoundingClientRect().top, 424);
  assert.ok(!frame.classList.has('workspace-dragging'));
  frame.querySelector('.workspace-place').fire('click');
  assert.equal(frame.getBoundingClientRect().left, 400);
  window.innerWidth = 800;
  window.fire('resize');
  assert.equal(frame.getBoundingClientRect().left, 388);
});

test('sur petit écran, Échap restaure la fenêtre et le bouton d’origine', () => {
  const { document, host, dialog, open, trigger } = fixture(true);
  open('Licence');
  const first = dialog(0);
  const sourceLink = document.createElement('a');
  first.querySelector('.workspace-content').append(sourceLink);
  open('Source', sourceLink);
  const second = dialog(1);
  assert.equal(first.open, false);
  assert.equal(second.modal, true);
  assert.ok(host.classList.has('workspace-modal-open'));
  document.fire('keydown', { key: 'Escape', target: second.querySelector('h2') });
  assert.equal(first.modal, true);
  assert.equal(document.activeElement, sourceLink);
  document.fire('keydown', { key: 'Escape', target: sourceLink });
  assert.equal(document.activeElement, trigger);
  assert.ok(!host.classList.has('workspace-modal-open'));
});

test('Échap libère le contenu avec son focus et la fenêtre bascule selon la largeur', () => {
  const { document, dialog, dock, media, open, trigger } = fixture();
  open('Licence');
  open('Master');
  const first = dialog(0);
  const second = dialog(1);
  trigger.focus();
  document.fire('keydown', { key: 'Escape', target: trigger });
  assert.equal(document.activeElement, trigger);
  assert.equal(second.open, false);
  assert.equal(first.open, true);
  media.matches = true;
  media.fire('change');
  assert.equal(first.modal, true);
  assert.equal(dock.children[0].dataset.state, 'active');
  media.matches = false;
  media.fire('change');
  assert.equal(first.open, true);
  assert.equal(first.modal, false);
});
