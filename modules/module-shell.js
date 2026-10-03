(() => {
  const MODULE_KEY = 'jezero-active-module-v34';
  const labels = {
    explorer: 'MAPA',
    planner: 'MISIÓN',
    science: 'CIENCIA',
    eva: 'EVA',
    analysis: 'RESULTADOS',
    settings: 'CONFIGURACIÓN'
  };
  const labelFor = name => window.JEZERO_I18N?.moduleLabel?.(name) || labels[name];

  const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];
  const byId = id => document.getElementById(id);
  const validModule = name => Boolean(labels[name]);

  function notify(message){
    if (typeof window.showToast === 'function') return window.showToast(message);
    const toast = byId('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hide');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.add('hide'), 4200);
  }

  function syncMirrors(sourceId){
    const source = byId(sourceId);
    if (!source) return;
    const text = source.textContent;
    qsa(`[data-mirror="${sourceId}"]`).forEach(el => { el.textContent = text; });
  }

  function setupMirrors(){
    const ids = [...new Set(qsa('[data-mirror]').map(el => el.dataset.mirror))];
    ids.forEach(id => {
      const source = byId(id);
      if (!source) return;
      syncMirrors(id);
      const observer = new MutationObserver(() => syncMirrors(id));
      observer.observe(source, { childList:true, characterData:true, subtree:true, attributes:true });
    });
  }

  function activateModule(name, {save=true, openMobile=true}={}){
    if (!validModule(name)) name = 'planner';
    document.body.dataset.module = name;

    qsa('[data-module-target]').forEach(btn => {
      const active = btn.dataset.moduleTarget === name;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-current', active ? 'page' : 'false');
    });
    qsa('[data-module-panel]').forEach(panel => {
      panel.classList.toggle('is-active', panel.dataset.modulePanel === name);
    });

    const label = labelFor(name);
    if (byId('activeModuleLabel')) byId('activeModuleLabel').textContent = label;
    if (byId('mapContext')) byId('mapContext').textContent = label;
    document.title = `JEZERO — ${label}`;
    if (save) localStorage.setItem(MODULE_KEY, name);

    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.matchMedia('(max-width:760px)').matches && openMobile) sidebar.classList.add('mobile-open');

    // OpenLayers recalcula correctamente el viewport al recibir un resize.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    window.dispatchEvent(new CustomEvent('jezero:modulechange', {detail:{module:name}}));
  }

  qsa('[data-module-target]').forEach(btn => btn.addEventListener('click', () => {
    const name = btn.dataset.moduleTarget;
    const sidebar = document.querySelector('.sidebar');
    const sameModule = document.body.dataset.module === name;

    if (sidebar && window.matchMedia('(max-width:760px)').matches) {
      if (sameModule) { sidebar.classList.toggle('mobile-open'); return; }
      activateModule(name);
      return;
    }

    // V34: los botones inferiores son también interruptores de sus opciones.
    // Primera pulsación: activa el módulo y abre ambos paneles.
    // Segunda pulsación sobre el mismo módulo: cierra ambos paneles.
    // Una pulsación posterior vuelve a abrirlos sin perder el módulo activo.
    const panels = window.JEZERO_PANELS;
    if (sameModule && panels) {
      const state = panels.get();
      if (state.left || state.right) panels.close(); else panels.open();
      return;
    }
    activateModule(name);
    panels?.open?.();
  }));

  qsa('[data-jump-module]').forEach(btn => btn.addEventListener('click', () => activateModule(btn.dataset.jumpModule)));

  byId('evaReturnHome')?.addEventListener('click', () => {
    const points = Number(byId('pointCount')?.textContent || 0);
    if (points < 2) {
      notify('Primero crea una misión con base y al menos un objetivo.');
      activateModule('planner');
      return;
    }
    const returnBase = byId('returnBase');
    if (returnBase) returnBase.checked = true;
    // El botón REGRESAR A BASE usa el motor de planificación existente. El motor EVA dinámico
    // se implementará aparte; no se presenta como navegación certificada en tiempo real.
    const button = byId('recalculate') && !byId('recalculate').disabled ? byId('recalculate') : byId('calculate');
    if (button && !button.disabled) {
      button.click();
      notify('Retorno a base activado. Recalculando la misión con el motor disponible.');
    } else {
      notify('La misión todavía no está lista para recalcular.');
    }
  });

  // En móvil el mapa recupera el espacio al tocarlo.
  byId('map')?.addEventListener('pointerdown', () => {
    if (window.matchMedia('(max-width:760px)').matches) document.querySelector('.sidebar')?.classList.remove('mobile-open');
  });

  // La leyenda arranca compacta para dejar el mapa como protagonista.
  const mapLegend = byId('mapLegend');
  const legendToggle = byId('toggleMapLegend');
  if (mapLegend && legendToggle && !mapLegend.classList.contains('is-collapsed')) {
    mapLegend.classList.add('is-collapsed');
    legendToggle.textContent = '＋';
    legendToggle.setAttribute('aria-expanded','false');
  }

  setupMirrors();
  const initialRaw = localStorage.getItem(MODULE_KEY) || localStorage.getItem('jezero-active-module-v33') || localStorage.getItem('jezero-active-module-v32') || localStorage.getItem('jezero-active-module-v31') || localStorage.getItem('jezero-active-module-v30') || localStorage.getItem('jezero-active-module-v29') || localStorage.getItem('jezero-active-module-v28');
  const migrated = initialRaw === 'reports' ? 'analysis' : initialRaw === 'terrain' ? 'explorer' : initialRaw === 'control' ? 'eva' : initialRaw;
  const initial = migrated;
  activateModule(validModule(initial) ? initial : 'planner', {save:false, openMobile:false});

  window.addEventListener('jezero:languagechange',()=>activateModule(document.body.dataset.module||'planner',{save:false,openMobile:false}));

  window.JEZERO_MODULES = Object.freeze({ activate: activateModule, labels:{...labels} });
})();
