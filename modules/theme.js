(() => {
  const KEY = 'jezero-theme-v31';
  const DEFAULT = 'nasa-classic';
  const THEMES = {
    'nasa-classic': {
      label:{es:'NASA Clásico',en:'NASA Classic'},
      description:{es:'Azul NASA, rojo de misión y blanco técnico.',en:'NASA blue, mission red and technical white.'},
      colors:{
        bg:'#020611',bg2:'#040B16',panel:'#06101F',panel2:'#08192D',panel3:'#0C2440',line:'#1F4F7D',lineStrong:'#4F95D1',
        text:'#F7FBFF',muted:'#A9BFD4',soft:'#6E8BA6',primary:'#0B3D91',primary2:'#1769D2',accent:'#FC3D21',accent2:'#55C8FF',
        success:'#54D6A5',warning:'#FFC857',danger:'#FC3D21',grid:'rgba(72,142,207,.15)',glow:'rgba(23,105,210,.22)',mapText:'#FFFFFF'
      }
    },
    'artemis-lunar': {
      label:{es:'Artemis Lunar',en:'Artemis Lunar'},
      description:{es:'Grafito, plata lunar y azul frío de navegación.',en:'Graphite, lunar silver and cold navigation blue.'},
      colors:{
        bg:'#07090C',bg2:'#0C1015',panel:'#10151B',panel2:'#151C24',panel3:'#1B2632',line:'#344657',lineStrong:'#7A9AB8',
        text:'#F4F7FA',muted:'#B6C0CA',soft:'#7D8C99',primary:'#263B52',primary2:'#5EA6FF',accent:'#D9E3ED',accent2:'#81D4FF',
        success:'#68D6A2',warning:'#F2C65C',danger:'#FF5B4D',grid:'rgba(170,195,218,.12)',glow:'rgba(94,166,255,.18)',mapText:'#FFFFFF'
      }
    },
    'deep-space': {
      label:{es:'Espacio Profundo',en:'Deep Space'},
      description:{es:'Índigo, violeta y cian para una consola futurista.',en:'Indigo, violet and cyan for a futuristic console.'},
      colors:{
        bg:'#05040B',bg2:'#090713',panel:'#0F0B1E',panel2:'#17102A',panel3:'#21163A',line:'#46346B',lineStrong:'#8C6BE0',
        text:'#FAF8FF',muted:'#BDB2D7',soft:'#8175A0',primary:'#432B80',primary2:'#7056D9',accent:'#D14CFF',accent2:'#3DDCFF',
        success:'#54E0A0',warning:'#F5C860',danger:'#FF5268',grid:'rgba(115,86,217,.14)',glow:'rgba(209,76,255,.16)',mapText:'#FFFFFF'
      }
    },
    'mars-science': {
      label:{es:'Ciencia Marciana',en:'Mars Science'},
      description:{es:'Rojo mineral, cobre y azul de instrumentación.',en:'Mineral red, copper and instrumentation blue.'},
      colors:{
        bg:'#080505',bg2:'#100807',panel:'#170B0A',panel2:'#21100E',panel3:'#2C1713',line:'#653527',lineStrong:'#C96A4B',
        text:'#FFF7F2',muted:'#D2B8AA',soft:'#95776B',primary:'#7D2A1C',primary2:'#C4472F',accent:'#F49B63',accent2:'#6BC7F0',
        success:'#5ED09B',warning:'#FFCC66',danger:'#FF4935',grid:'rgba(196,71,47,.12)',glow:'rgba(244,155,99,.14)',mapText:'#FFFFFF'
      }
    },
    'aurora-teal': {
      label:{es:'Aurora Teal',en:'Aurora Teal'},
      description:{es:'Verde azulado, menta y azul eléctrico científico.',en:'Teal, mint and scientific electric blue.'},
      colors:{
        bg:'#020A0B',bg2:'#041213',panel:'#071A1C',panel2:'#0A2427',panel3:'#0D3034',line:'#205B60',lineStrong:'#3AB8B9',
        text:'#F2FFFF',muted:'#A8CFD0',soft:'#6D999B',primary:'#0D5C63',primary2:'#168E96',accent:'#29E6C7',accent2:'#55B7FF',
        success:'#4DE3A4',warning:'#F6C453',danger:'#FF5C5C',grid:'rgba(41,230,199,.10)',glow:'rgba(22,142,150,.18)',mapText:'#FFFFFF'
      }
    },
    'eva-contrast': {
      label:{es:'EVA Alto Contraste',en:'EVA High Contrast'},
      description:{es:'Negro, blanco y amarillo para máxima lectura operacional.',en:'Black, white and yellow for maximum operational readability.'},
      colors:{
        bg:'#000000',bg2:'#050607',panel:'#0B0D0F',panel2:'#11151A',panel3:'#171C22',line:'#4B535C',lineStrong:'#F5F7FA',
        text:'#FFFFFF',muted:'#D1D7DD',soft:'#929AA3',primary:'#252B32',primary2:'#F5F7FA',accent:'#FFE600',accent2:'#48C6FF',
        success:'#39E58C',warning:'#FFE600',danger:'#FF3B30',grid:'rgba(255,255,255,.10)',glow:'rgba(255,230,0,.12)',mapText:'#FFFFFF'
      }
    }
  };

  const normalize = key => THEMES[key] ? key : DEFAULT;
  const language = () => window.JEZERO_I18N?.getLanguage?.() || document.documentElement.lang || 'es';
  const currentKey = () => normalize(localStorage.getItem(KEY) || DEFAULT);

  function applyVariables(colors){
    const root=document.documentElement;
    const vars={
      '--theme-bg':colors.bg,'--theme-bg-2':colors.bg2,'--theme-panel':colors.panel,'--theme-panel-2':colors.panel2,'--theme-panel-3':colors.panel3,
      '--theme-line':colors.line,'--theme-line-strong':colors.lineStrong,'--theme-text':colors.text,'--theme-muted':colors.muted,'--theme-soft':colors.soft,
      '--theme-primary':colors.primary,'--theme-primary-2':colors.primary2,'--theme-accent':colors.accent,'--theme-accent-2':colors.accent2,
      '--theme-success':colors.success,'--theme-warning':colors.warning,'--theme-danger':colors.danger,'--theme-grid':colors.grid,'--theme-glow':colors.glow,
      '--bg':colors.bg,'--panel':colors.panel,'--panel-2':colors.panel2,'--panel-3':colors.panel3,'--line':colors.line,'--text':colors.text,
      '--muted':colors.muted,'--soft':colors.soft,'--mars':colors.accent,'--mars-2':colors.primary,'--sand':colors.accent2,'--teal':colors.success,
      '--cyan':colors.accent2,'--danger':colors.danger,'--warning':colors.warning,'--nasa-blue':colors.primary,'--nasa-blue-bright':colors.primary2,
      '--nasa-red':colors.accent,'--mission-white':colors.text
    };
    Object.entries(vars).forEach(([k,v])=>root.style.setProperty(k,v));
  }

  function syncUi(key){
    document.querySelectorAll('input[name="themeSetting"]').forEach(input=>{ input.checked=input.value===key; });
    document.querySelectorAll('[data-theme-choice]').forEach(el=>el.classList.toggle('is-selected',el.dataset.themeChoice===key));
    const info=THEMES[key]; const lang=language()==='en'?'en':'es';
    const name=document.getElementById('themeCurrentName'); if(name) name.textContent=info.label[lang];
    const summary=document.getElementById('settingsThemeSummary'); if(summary) summary.textContent=info.label[lang];
    const langSummary=document.getElementById('settingsLanguageSummary'); if(langSummary) langSummary.textContent=lang==='en'?'English':'Español';
  }

  function setTheme(key,{persist=true,emit=true}={}){
    key=normalize(key); const info=THEMES[key];
    if(persist) localStorage.setItem(KEY,key);
    document.documentElement.dataset.theme=key;
    if(document.body) document.body.dataset.theme=key;
    applyVariables(info.colors);
    syncUi(key);
    if(emit) window.dispatchEvent(new CustomEvent('jezero:themechange',{detail:{theme:key,colors:{...info.colors}}}));
    return key;
  }

  function initControls(){
    const key=currentKey(); setTheme(key,{persist:false,emit:false});
    document.querySelectorAll('input[name="themeSetting"]').forEach(input=>input.addEventListener('change',()=>{
      if(input.checked) setTheme(input.value);
    }));
    document.querySelectorAll('[data-theme-choice]').forEach(card=>card.addEventListener('click',e=>{
      if(e.target.closest('input')) return;
      const input=card.querySelector('input[name="themeSetting"]'); if(input){input.checked=true;setTheme(input.value);}
    }));
    window.addEventListener('jezero:languagechange',()=>syncUi(currentKey()));
    syncUi(key);
  }

  window.JEZERO_THEMES=Object.freeze({
    keys:()=>Object.keys(THEMES),
    getTheme:currentKey,
    setTheme,
    getColors:()=>({...THEMES[currentKey()].colors}),
    getThemeInfo:(lang=language())=>{const k=currentKey(),i=THEMES[k],l=lang==='en'?'en':'es';return {key:k,label:i.label[l],description:i.description[l],colors:{...i.colors}};},
    getLabel:(key=currentKey(),lang=language())=>{const i=THEMES[normalize(key)],l=lang==='en'?'en':'es';return i.label[l];}
  });

  // Aplicación temprana para evitar un destello del tema predeterminado.
  setTheme(currentKey(),{persist:false,emit:false});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initControls,{once:true}); else initControls();
})();
