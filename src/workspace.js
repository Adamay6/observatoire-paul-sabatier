const sheetQuery = '(max-width: 760px)';
const margin = 12;
const dockClearance = 64;
const placementSequence = {
  right: { next: 'center', label: 'Placer la fenêtre au centre' },
  center: { next: 'left', label: 'Placer la fenêtre à gauche' },
  left: { next: 'right', label: 'Placer la fenêtre à droite' },
  free: { next: 'center', label: 'Placer la fenêtre au centre' },
};

function clamp(value, size, limit) {
  return Math.max(margin, Math.min(value, limit - size - margin));
}

function openingPosition(alignment, bounds, viewport, offset) {
  const freeX = viewport.width - bounds.width;
  const positions = { left: margin + offset, center: freeX / 2, right: freeX - margin - offset };
  return { x: positions[alignment], y: Math.min(106 + offset, viewport.height / 5) };
}

export function createWorkspace(host) {
  const document = host.ownerDocument;
  const window = document.defaultView;
  const narrow = window.matchMedia(sheetQuery);
  const panels = new Map();
  const dock = document.createElement('nav');
  dock.className = 'workspace-dock';
  dock.setAttribute('aria-label', 'Fenêtres de l’observatoire');
  dock.hidden = true;
  host.append(dock);

  let sequence = 0;
  let highestLayer = 0;
  let active;

  function viewport() {
    return { width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight - dockClearance };
  }

  function move(panel, position, bounds = panel.dialog.getBoundingClientRect()) {
    const { width, height } = viewport();
    panel.position = { x: clamp(position.x, bounds.width, width), y: clamp(position.y, bounds.height, height) };
    panel.dialog.style.setProperty('--workspace-x', `${panel.position.x}px`);
    panel.dialog.style.setProperty('--workspace-y', `${panel.position.y}px`);
  }

  function updateDock() {
    dock.hidden = panels.size === 0;
    host.classList.toggle('workspace-modal-open', Boolean(active?.dialog.open && narrow.matches));
    for (const panel of panels.values()) {
      const { dialog, tab } = panel;
      const foreground = panel === active && dialog.open;
      dialog.classList.toggle('workspace-active', foreground);
      tab.dataset.state = foreground ? 'active' : dialog.open ? 'open' : 'minimized';
      tab.setAttribute('aria-pressed', String(foreground));
      tab.setAttribute('aria-label', dialog.open ? `Afficher au premier plan · ${panel.tabLabel}` : `Rouvrir · ${panel.tabLabel}`);
    }
  }

  function raise(panel) {
    if (panel !== active) {
      active = panel;
      panel.layer = ++highestLayer;
      panel.dialog.style.setProperty('--workspace-layer', String(panel.layer));
    }
    updateDock();
  }

  function hide(panel) {
    panel.endDrag();
    if (panel.dialog.open) panel.dialog.close();
    panel.mode = null;
  }

  function show(panel, focus = true) {
    if (narrow.matches) {
      for (const other of panels.values()) {
        if (other !== panel && other.dialog.open) hide(other);
      }
    }

    const mode = narrow.matches ? 'sheet' : 'window';
    if (panel.mode !== mode && panel.dialog.open) hide(panel);
    if (!panel.dialog.open) {
      if (mode === 'sheet') panel.dialog.showModal();
      else panel.dialog.show();
      panel.mode = mode;
    }
    if (mode === 'window') {
      const bounds = panel.dialog.getBoundingClientRect();
      move(panel, panel.position || openingPosition(panel.alignment, bounds, viewport(), panel.offset), bounds);
    }
    raise(panel);
    if (focus) panel.heading.focus({ preventScroll: true });
  }

  function reselect() {
    active = [...panels.values()].filter(panel => panel.dialog.open)
      .reduce((front, panel) => !front || front.layer < panel.layer ? panel : front, null);
    updateDock();
  }

  function restoreFocus(panel) {
    const { trigger } = panel;
    if (trigger?.isConnected) {
      const previousDialog = trigger.closest('.workspace-window');
      if (narrow.matches && previousDialog && !previousDialog.open) {
        const previous = [...panels.values()].find(candidate => candidate.dialog === previousDialog);
        if (previous) show(previous, false);
      }
      if (!previousDialog || previousDialog.open) {
        trigger.focus({ preventScroll: true });
        return;
      }
    }
    active?.heading.focus({ preventScroll: true });
  }

  function close(id, restore = true) {
    const panel = panels.get(id);
    if (!panel) return;
    hide(panel);
    panel.dialog.remove();
    panel.tab.remove();
    panels.delete(id);
    reselect();
    if (restore) restoreFocus(panel);
  }

  function closeAll() {
    for (const panel of panels.values()) {
      hide(panel);
      panel.dialog.remove();
      panel.tab.remove();
    }
    panels.clear();
    active = undefined;
    highestLayer = 0;
    updateDock();
  }

  function minimize(panel) {
    hide(panel);
    reselect();
    panel.tab.focus({ preventScroll: true });
  }

  function alignmentHint(panel) {
    const { label } = placementSequence[panel.alignment];
    panel.place.setAttribute('aria-label', label);
    panel.place.title = label;
  }

  function setUpDrag(panel) {
    const { dialog, grip } = panel;
    let drag;
    grip.addEventListener('pointerdown', event => {
      if (narrow.matches || !event.isPrimary || event.button !== 0) return;
      const bounds = dialog.getBoundingClientRect();
      drag = { id: event.pointerId, dx: event.clientX - bounds.left, dy: event.clientY - bounds.top, bounds };
      grip.setPointerCapture(event.pointerId);
      if (!dialog.contains(document.activeElement)) panel.heading.focus({ preventScroll: true });
      dialog.classList.add('workspace-dragging');
      event.preventDefault();
    });
    grip.addEventListener('pointermove', event => {
      if (drag?.id !== event.pointerId) return;
      move(panel, { x: event.clientX - drag.dx, y: event.clientY - drag.dy }, drag.bounds);
      if (panel.alignment !== 'free') {
        panel.alignment = 'free';
        alignmentHint(panel);
      }
    });
    function stop(event) {
      if (drag?.id !== event.pointerId) return;
      drag = undefined;
      dialog.classList.remove('workspace-dragging');
    }
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) grip.addEventListener(event, stop);
    panel.endDrag = () => {
      if (!drag) return;
      const { id } = drag;
      if (grip.hasPointerCapture(id)) grip.releasePointerCapture(id);
      stop({ pointerId: id });
    };
  }

  function createPanel(id, wide) {
    const dialog = document.createElement('dialog');
    const tab = document.createElement('button');
    const titleId = `workspace-title-${++sequence}`;
    dialog.id = `workspace-window-${sequence}`;
    dialog.className = 'workspace-window';
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.innerHTML = `<header class="workspace-header">
      <div class="workspace-title"><span class="workspace-kind"></span><h2 id="${titleId}" tabindex="-1" autofocus></h2></div>
      <div class="workspace-actions">
        <button class="workspace-place" type="button"><span aria-hidden="true">⇄</span></button>
        <button class="workspace-minimize" type="button" aria-label="Réduire la fenêtre" title="Réduire la fenêtre"><span aria-hidden="true">−</span></button>
        <button class="workspace-close" type="button" aria-label="Fermer la fenêtre" title="Fermer la fenêtre"><span aria-hidden="true">×</span></button>
      </div>
    </header><div class="workspace-content"></div>`;
    tab.type = 'button';
    tab.className = 'workspace-tab';
    tab.setAttribute('aria-controls', dialog.id);
    dock.append(tab);
    host.append(dialog);

    const panel = {
      id, dialog, tab,
      heading: dialog.querySelector('h2'),
      kind: dialog.querySelector('.workspace-kind'),
      content: dialog.querySelector('.workspace-content'),
      grip: dialog.querySelector('.workspace-title'),
      place: dialog.querySelector('.workspace-place'),
      alignment: wide ? 'center' : panels.size % 2 === 0 ? 'right' : 'left',
      offset: 16 * (panels.size % 4),
    };
    alignmentHint(panel);
    panel.place.addEventListener('click', () => {
      panel.alignment = placementSequence[panel.alignment].next;
      const bounds = dialog.getBoundingClientRect();
      move(panel, openingPosition(panel.alignment, bounds, viewport(), 0), bounds);
      alignmentHint(panel);
    });
    dialog.querySelector('.workspace-minimize').addEventListener('click', () => minimize(panel));
    dialog.querySelector('.workspace-close').addEventListener('click', () => close(id));
    dialog.addEventListener('pointerdown', () => raise(panel));
    dialog.addEventListener('focusin', () => raise(panel));
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      close(id);
    });
    tab.addEventListener('click', () => show(panel));
    setUpDrag(panel);
    return panel;
  }

  function open({ id, title, kind, content, dockLabel = kind, wide = false, trigger }) {
    let panel = panels.get(id);
    if (!panel) {
      panel = createPanel(id, wide);
      panels.set(id, panel);
    }
    if (trigger && !panel.dialog.contains(trigger)) panel.trigger = trigger;
    panel.tabLabel = `${dockLabel} · ${title}`;
    panel.heading.textContent = title;
    panel.kind.textContent = kind;
    panel.tab.textContent = panel.tabLabel;
    panel.tab.title = panel.tabLabel;
    panel.content.innerHTML = content;
    panel.dialog.classList.toggle('workspace-wide', wide);
    show(panel);
  }

  function syncLayout() {
    if (narrow.matches) {
      if (active?.dialog.open) show(active, false);
      return;
    }

    for (const panel of panels.values()) {
      if (!panel.dialog.open) continue;
      if (panel.mode === 'sheet') show(panel, false);
      else if (panel.position) move(panel, panel.position);
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.repeat || !active?.dialog.open) return;
    const focusedPanel = [...panels.values()].find(panel => panel.dialog.open && panel.dialog.contains(event.target));
    event.preventDefault();
    close((focusedPanel || active).id, Boolean(focusedPanel));
  });
  narrow.addEventListener('change', syncLayout);
  window.addEventListener('resize', syncLayout);

  return { open, close, closeAll };
}
