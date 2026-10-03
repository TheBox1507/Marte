(() => {
  const KEY = 'jezero-language-v36';
  const LEGACY_KEY = 'jezero-language-v31';
  const VALID = new Set(['es','en']);

  const ES_EN = {
    'EVA MISSION SYSTEM':'EVA MISSION SYSTEM',
    'TERRAIN · ROUTING · NAVIGATION':'TERRAIN · ROUTING · NAVIGATION',
    'Define la base, agrega puntos de misión y deja que JEZERO optimice automáticamente el orden de visita sobre el terreno marciano.':'Define the base, add mission points, and let JEZERO automatically optimize the visit order across Martian terrain.',
    'PUNTOS DE MISIÓN':'MISSION POINTS','ORDEN AUTOMÁTICO':'AUTOMATIC ORDER','La numeración final se asigna después de calcular la ruta óptima; el orden en que agregas los puntos no obliga al recorrido.':'Final numbering is assigned after calculating the optimized route; the order in which you add points does not constrain the traverse.',
    'Optimizar automáticamente el orden de visita':'Automatically optimize visit order','Punto de misión':'Mission point','Tiempo de parada (min)':'Stop time (min)','PARADA':'STOP','ORDEN CALCULADO':'CALCULATED ORDER','PENDIENTE DE CÁLCULO':'PENDING CALCULATION','ORDEN MANUAL':'MANUAL ORDER','INICIO':'START',
    'Ruta, terreno y desempeño EVA en una sola lectura':'Route, terrain, and EVA performance in one view','Abre el centro de análisis para revisar terreno, movilidad, retorno, estrategias y generar el informe técnico completo.':'Open the analysis center to review terrain, mobility, return margin, strategies, and generate the complete technical report.',
    'ANÁLISIS INTERACTIVO DE MISIÓN':'INTERACTIVE MISSION ANALYSIS','Todos los gráficos están concentrados aquí y sincronizados con la ruta: terreno, movilidad, retorno y comparación de estrategias.':'All charts are concentrated here and synchronized with the route: terrain, mobility, return margin, and strategy comparison.',
    'ESTRATEGIA':'STRATEGY','× LIMPIAR SELECCIÓN':'× CLEAR SELECTION','Mueve el cursor sobre un gráfico para inspeccionar la ruta.':'Move the cursor over a chart to inspect the route.',
    'PERFIL MULTICAPA DE LA RUTA':'MULTI-LAYER ROUTE PROFILE','Elevación · pendiente · rugosidad · transitabilidad · confianza':'Elevation · slope · roughness · traversability · confidence',
    'DISTRIBUCIÓN DE PENDIENTES':'SLOPE DISTRIBUTION','TRANSITABILIDAD':'TRAVERSABILITY','RUGOSIDAD':'ROUGHNESS','CONFIANZA CARTOGRÁFICA':'CARTOGRAPHIC CONFIDENCE',
    'PRESUPUESTO DE TIEMPO':'TIME BUDGET','Tránsito · paradas · reserva / exceso':'Travel · stops · reserve / overrun','RESERVA DE RETORNO':'RETURN RESERVE','Margen estimado conforme avanza la ruta':'Estimated margin along the route',
    'ASCENSO Y DESCENSO ACUMULADO':'CUMULATIVE ASCENT AND DESCENT','Metros acumulados por distancia':'Accumulated meters by distance','DIFICULTAD DEL TERRENO':'TERRAIN DIFFICULTY','Índice derivado de pendiente, movilidad y confianza':'Index derived from slope, mobility, and confidence',
    'COMPARACIÓN INTERACTIVA DE RUTAS':'INTERACTIVE ROUTE COMPARISON','Haz clic en una estrategia para convertirla en la ruta activa':'Click a strategy to make it the active route','ESTADO GLOBAL DEL PLAN':'GLOBAL PLAN STATUS','Solo métricas calculadas':'Calculated metrics only',
    'MAPA ANALÍTICO':'ANALYTICAL MAP','UBICACIÓN DEL TRAMO':'SEGMENT LOCATION','El punto seleccionado se sincroniza con los gráficos':'The selected point is synchronized with the charts','TABLA TÉCNICA INTERACTIVA':'INTERACTIVE TECHNICAL TABLE','Selecciona un tramo para resaltarlo en el mapa':'Select a leg to highlight it on the map',
    'DISTANCIA':'DISTANCE','PEND. MÁX.':'MAX SLOPE','RUGOSIDAD':'ROUGHNESS','PUNTOS':'POINTS','TIEMPO EN PUNTOS':'TIME AT POINTS',
    'SCIENCE · TERRAIN · NAVIGATION':'SCIENCE · TERRAIN · NAVIGATION',
    'MISIÓN':'MISSION','MAPA':'MAP','CONFIG.':'SETTINGS',
    'MAPA Y CAPAS':'MAP & LAYERS','Cartografía científica · NASA / USGS':'Scientific cartography · NASA / USGS',
    'Exploración cartográfica':'Cartographic exploration','Navega por Marte, consulta referencias y activa las capas de terreno que alimentan la planificación EVA.':'Navigate Mars, inspect references and enable terrain layers used by EVA planning.',
    'CAPAS DEL MAPA':'MAP LAYERS','VISTA DEL MAPA':'MAP VIEW','Representación visual; no modifica los cálculos':'Visual representation; it does not change calculations','Estilo cartográfico':'Map style','Mapa base':'Basemap','Geología · color MOLA':'Geology · MOLA color','Relieve · contraste':'Relief · contrast','Monocromo científico':'Scientific monochrome','EVA · baja luminosidad':'EVA · low light','Capas':'Layers','Paneles':'Panels','CARTOGRAFÍA':'CARTOGRAPHY','TERRENO':'TERRAIN','Corredor y rutas EVA':'EVA corridor & routes','Alternativas calculadas':'Calculated alternatives','Base y objetivos':'Base & targets','Simbología JEZERO':'JEZERO symbology',
    'MAPA BASE':'BASEMAP',
    'Marte real · Viking VIS':'Real Mars · Viking VIS','Mosaico fotográfico global · NASA / JPL / USGS':'Global photographic mosaic · NASA / JPL / USGS',
    'Topografía MOLA + HRSC':'MOLA + HRSC topography','Relieve científico coloreado':'Color-coded scientific relief',
    'Híbrido imagen + relieve':'Hybrid image + relief','Viking VIS con topografía semitransparente':'Viking VIS with semi-transparent topography',
    'DISPONIBLE':'AVAILABLE','Nombres oficiales IAU / USGS':'Official IAU / USGS names','Nomenclatura por zona y nivel de zoom':'Nomenclature by area and zoom level',
    'Aterrizajes en Marte':'Mars landings','Misiones exitosas y referencias históricas':'Successful missions and historical references',
    'Topografía · MOLA + HRSC':'Topography · MOLA + HRSC','Híbrido · imagen + relieve':'Hybrid · image + relief',
    'Nombres IAU / USGS':'IAU / USGS names','Se cargan por zona al acercar':'Loaded by area as you zoom in',
    'Aterrizajes':'Landings','NASA + Zhurong y referencias históricas':'NASA + Zhurong and historical references',
    'FUENTES':'SOURCES','Viking VIS / MOLA: NASA Mars Trek · Nombres: USGS Gazetteer / IAU':'Viking VIS / MOLA: NASA Mars Trek · Names: USGS Gazetteer / IAU',
    'NOMBRES GLOBALES':'GLOBAL NAMES','BASE LOCAL':'LOCAL FALLBACK',
    'Construir misión':'Build mission','Base, objetivos y rutas':'Base, targets and routes',
    'TIMELINE DE MISIÓN':'MISSION TIMELINE','EVA NAVIGATOR':'EVA NAVIGATOR','NAVEGACIÓN / PLAN ACTIVO':'NAVIGATION / ACTIVE PLAN',
    'RESULTADOS DE MISIÓN':'MISSION RESULTS','Ruta, ciencia y terreno en una sola lectura':'Route, science and terrain in one view',
    'Revisa el recorrido seleccionado y genera un documento completo con perfil topográfico y análisis por tramos.':'Review the selected traverse and generate a complete document with terrain profile and leg-by-leg analysis.',
    'PERFIL DEL TERRENO':'TERRAIN PROFILE','Calcula una misión para generar el perfil.':'Calculate a mission to generate the profile.',
    'Guardar misión y generar PDF completo':'Save mission and generate complete PDF',
    'PLAN':'PLAN','RETURN RESERVE':'RETURN RESERVE','RUTA ACTIVA':'ACTIVE ROUTE','SIN RUTA':'NO ROUTE',
    'Corredor EVA':'EVA corridor','Zona visual de navegación':'Visual navigation zone',
    'TERRENO / CORREDOR EVA':'TERRAIN / EVA CORRIDOR','PEND. MEDIA':'AVG. SLOPE','TRANSIT. MEDIA':'AVG. TRAVERSABILITY','TRANSIT. MÍN.':'MIN. TRAVERSABILITY','CONF. MÍN.':'MIN. CONFIDENCE',
    'PENDIENTE MÁX.':'MAX. SLOPE','DESNIVEL':'ELEVATION CHANGE','RETORNO':'RETURN',
    'INCLUIDO':'INCLUDED','OMITIDO POR RESTRICCIONES / UTILIDAD':'OMITTED BY CONSTRAINTS / UTILITY','PENDIENTE DE CÁLCULO':'PENDING CALCULATION',
    'SIN ID':'NO ID','OBJETIVOS':'TARGETS','RUTA':'ROUTE',
    'PLATAFORMA MODULAR DE TRAVESÍAS CIENTÍFICAS':'MODULAR SCIENTIFIC TRAVERSE PLATFORM',
    'MARTE GLOBAL · NAVEGACIÓN CIENTÍFICA EVA · NASA / USGS':'GLOBAL MARS · EVA SCIENCE NAVIGATION · NASA / USGS',
    'MÓDULO ACTIVO':'ACTIVE MODULE',
    'PLANIFICADOR DE MISIÓN':'MISSION PLANNER',
    'DATOS CARTOGRÁFICOS · NASA / USGS':'CARTOGRAPHIC DATA · NASA / USGS',
    'EXPLORAR':'EXPLORE','PLANIFICAR':'PLAN','CIENCIA':'SCIENCE','TERRENO':'TERRAIN','NAVEGADOR EVA':'EVA NAVIGATOR','CONTROL':'CONTROL','RESULTADOS':'RESULTS','CONFIGURACIÓN':'SETTINGS',
    'EXPLORAR / COBERTURA':'EXPLORE / COVERAGE','MARTE GLOBAL':'GLOBAL MARS','Cobertura planetaria · NASA / USGS':'Planetary coverage · NASA / USGS',
    'Explora antes de planificar':'Explore before planning','Navega por Marte, consulta referencias y selecciona un sitio de aterrizaje como punto de partida.':'Navigate Mars, review references and select a landing site as your starting point.',
    'REFERENCIAS MARCIANAS':'MARTIAN REFERENCES','Usar un aterrizaje como base':'Use a landing site as base','Selecciona un sitio de aterrizaje…':'Select a landing site…','Usar como base':'Use as base',
    'SIGUIENTE PASO':'NEXT STEP','Planificar una EVA':'Plan an EVA','Crear base, objetivos y recorrido':'Create base, targets and traverse','Analizar el terreno':'Analyze terrain','Pendiente, rugosidad y transitabilidad':'Slope, roughness and traversability','FUENTES NASA ↗':'NASA SOURCES ↗',
    'Construye la travesía':'Build the traverse','Define la base, agrega objetivos y calcula tres estrategias de recorrido sobre el terreno marciano.':'Define the base, add targets and calculate three traverse strategies across Martian terrain.',
    'Nueva misión / agregar puntos':'New mission / add points','AÑADIR POR COORDENADAS':'ADD BY COORDINATES','Nuevo punto de misión':'New mission point','MARTE':'MARS',
    'Introduce latitud y longitud en grados decimales. También puedes tocar directamente el mapa.':'Enter latitude and longitude in decimal degrees. You can also click directly on the map.',
    'Latitud':'Latitude','Longitud':'Longitude','Nombre del punto':'Point name','Tipo':'Type','Punto':'Point','Base':'Base','Tiempo de parada (min)':'Stop time (min)','Agregar punto':'Add point',
    'Fijar base en el primer punto':'Set first point as base','Calcular misión':'Calculate mission','Limpiar misión':'Clear mission','PUNTOS PLANIFICADOS':'PLANNED POINTS','SECUENCIA DE VISITA':'VISIT SEQUENCE','Regresar a la base al finalizar':'Return to base at the end',
    'ESTRATEGIA DE RUTA':'ROUTE STRATEGY','Equilibrada':'Balanced','Distancia + terreno':'Distance + terrain','Menor exposición':'Lower exposure','Penaliza pendientes':'Penalizes slopes','Más directa':'Most direct','Minimiza distancia':'Minimizes distance',
    'Diseño científico de la travesía':'Scientific traverse design','Edita cada objetivo desde aquí. El valor científico, el tiempo de trabajo y si es obligatorio u opcional participan directamente en el cálculo de la misión.':'Edit each target here. Science value, work time and required/optional status directly affect mission calculation.',
    'OBJETIVOS':'TARGETS','VALOR POTENCIAL':'POTENTIAL VALUE','VALOR INCLUIDO':'INCLUDED VALUE','EFICIENCIA':'EFFICIENCY','OBJETIVOS CIENTÍFICOS':'SCIENCE TARGETS','Agrega objetivos en el Planificador para configurarlos científicamente.':'Add targets in the Mission Planner to configure their science parameters.',
    'Aplicar cambios y recalcular':'Apply changes and recalculate','Agregar otro objetivo':'Add another target','Volver al planificador y marcarlo en el mapa':'Return to the planner and mark it on the map',
    'TERRENO Y PELIGROS':'TERRAIN & HAZARDS','Mapa de transitabilidad':'Traversability map','Activa las capas derivadas para estudiar el terreno. En esta versión, pendiente y rugosidad se calculan desde el DEM global.':'Enable derived layers to study the terrain. In this version, slope and roughness are calculated from the global DEM.',
    'BASE CARTOGRÁFICA':'BASEMAP','Relieve MOLA + HRSC':'MOLA + HRSC relief','Base global':'Global base','ACTIVA':'ACTIVE','ANÁLISIS DEL TERRENO':'TERRAIN ANALYSIS','Pendiente calculada':'Calculated slope','Derivada del DEM global':'Derived from global DEM','ACERCA PARA ANALIZAR':'ZOOM IN TO ANALYZE','Rugosidad calculada':'Calculated roughness','Variación local de elevación':'Local elevation variation','REFERENCIAS':'REFERENCES','Ubicaciones conocidas':'Known locations','Regiones de referencia':'Reference regions','Sitios de aterrizaje':'Landing sites','Misiones NASA':'NASA missions','OPERACIÓN':'OPERATION','Rutas calculadas':'Calculated routes','Alternativas de misión':'Mission alternatives','Puntos de misión':'Mission points','Base y objetivos':'Base and targets','Transitabilidad e incertidumbre':'Traversability and uncertainty','El motor combina pendiente direccional, rugosidad local, confianza cartográfica y límites duros. Si un segmento viola los límites, A* no puede atravesarlo.':'The engine combines directional slope, local roughness, cartographic confidence and hard constraints. If a segment violates a limit, A* cannot traverse it.',
    'SIGUIENTE OBJETIVO':'NEXT TARGET','Esperando misión':'Waiting for mission','RETORNO / MARGEN':'RETURN / MARGIN','DIFICULTAD':'DIFFICULTY','Sin evaluación':'Not evaluated','REGRESAR A BASE':'RETURN TO BASE','Recalcular la misión asegurando el retorno a la base':'Recalculate the mission ensuring return to base','Editar la misión':'Edit mission','Ajustar puntos y restricciones':'Adjust points and constraints','El Navegador EVA es todavía un modo de planificación y simulación. No constituye navegación humana certificada.':'The EVA Navigator is still a planning and simulation mode. It is not certified human navigation.',
    'CONTROL DE MISIÓN':'MISSION CONTROL','Vista operacional':'Operational view','Panel pensado para seguir tripulación, progreso, alertas y eventos de una EVA.':'Panel designed to follow crew, progress, alerts and EVA events.','PLAN ACTIVO':'ACTIVE PLAN','DISTANCIA':'DISTANCE','TRAMOS':'LEGS','ESTADO':'STATUS','SIN RUTA':'NO ROUTE','Telemetría y localización':'Telemetry and localization','Preparado para posición de EV1/EV2, comunicaciones, recursos del traje y eventos de misión.':'Prepared for EV1/EV2 position, communications, suit resources and mission events.',
    'Análisis y documentación en un solo lugar':'Analysis and documentation in one place','Revisa el resultado seleccionado, guarda la misión y genera el informe PDF sin cambiar de módulo.':'Review the selected result, save the mission and generate the PDF report without changing modules.','DURACIÓN':'DURATION','TRANSITABILIDAD':'TRAVERSABILITY','CONFIANZA':'CONFIDENCE','Guardar misión y generar PDF':'Save mission and generate PDF','HISTORIAL DE MISIONES':'MISSION HISTORY','El historial se conserva localmente en este navegador.':'History is stored locally in this browser.',
    'Perfil de misión y preferencias':'Mission profile and preferences','Define la identificación del plan, guarda parámetros operacionales como predeterminados y administra los datos locales de JEZERO.':'Define the plan identity, save operational defaults and manage JEZERO local data.','INTERFAZ':'INTERFACE','Idioma':'Language','Español':'Spanish','Inglés':'English','El idioma se guarda en este navegador y se aplica a toda la interfaz.':'The language is stored in this browser and applied across the interface.',
    'Tema visual':'Visual theme','TEMA':'THEME','IDIOMA':'LANGUAGE','La paleta se aplica inmediatamente y queda guardada en este navegador.':'The palette is applied immediately and stored in this browser.',
    'NASA Clásico':'NASA Classic','Azul NASA, rojo de misión y blanco técnico.':'NASA blue, mission red and technical white.',
    'Artemis Lunar':'Artemis Lunar','Grafito, plata lunar y azul frío de navegación.':'Graphite, lunar silver and cold navigation blue.',
    'Espacio Profundo':'Deep Space','Índigo, violeta y cian para una consola futurista.':'Indigo, violet and cyan for a futuristic console.',
    'Marte Mineral':'Mars Mineral','Rojo mineral, cobre y azul de instrumentación.':'Mineral red, copper and instrumentation blue.',
    'Aurora Teal':'Aurora Teal','Verde azulado, menta y azul eléctrico científico.':'Teal, mint and scientific electric blue.',
    'EVA Alto Contraste':'EVA High Contrast','Negro, blanco y amarillo para máxima lectura operacional.':'Black, white and yellow for maximum operational readability.',
    'IDENTIFICACIÓN DE LA MISIÓN':'MISSION IDENTIFICATION','Nombre de misión':'Mission name','Código / ID':'Code / ID','Tripulación':'Crew','Notas del plan':'Plan notes','PARÁMETROS PREDETERMINADOS':'DEFAULT PARAMETERS','Toma los valores actuales del Planificador: velocidad, duración EVA, margen de retorno y límites de navegación.':'Uses the current Planner values: speed, EVA duration, return margin and navigation limits.','Guardar parámetros actuales como predeterminados':'Save current parameters as defaults','Aplicar parámetros predeterminados':'Apply default parameters','Usando valores de fábrica hasta que guardes un perfil.':'Using factory values until you save a profile.','DATOS LOCALES':'LOCAL DATA','Exportar misión a JSON':'Export mission to JSON','Importar misión desde JSON':'Import mission from JSON','Borrar historial local':'Clear local history',
    '−90° a 90° · −180° a 180° · mapa persistente entre módulos':'−90° to 90° · −180° to 180° · map persists across modules','⌖ Centro':'⌖ Center','Activa una misión y selecciona los puntos directamente sobre el mapa':'Start a mission and select points directly on the map','NASA MARS TREK · MOLA / HRSC · MDEM200M PARA ANÁLISIS':'NASA MARS TREK · MOLA / HRSC · MDEM200M FOR ANALYSIS','LEYENDA':'LEGEND','Simbología del mapa':'Map symbology','Sitio de aterrizaje':'Landing site','Misiones que aterrizaron en Marte':'Missions that landed on Mars','Ubicación conocida':'Known location','Regiones destacadas':'Highlighted regions','MISIÓN':'MISSION','Inicio o retorno':'Start or return','Objetivo obligatorio':'Required target','Debe formar parte del recorrido':'Must be part of the traverse','Objetivo opcional':'Optional target','Puede omitirse':'May be omitted','RUTAS':'ROUTES','Ruta seleccionada':'Selected route','Alternativa analizada':'Analyzed alternative','Prioriza distancia':'Prioritizes distance','Penaliza dificultad':'Penalizes difficulty','UBICACIÓN':'LOCATION','Fuente':'Source','Agregar a misión':'Add to mission',
    'MAPA GLOBAL':'GLOBAL MAP','Punto de referencia inicial; la misión puede empezar en cualquier coordenada.':'Initial reference point; the mission can start at any coordinate.','Fuente numérica para elevación y análisis topográfico.':'Numerical source for elevation and topographic analysis.','FLUJO RECOMENDADO':'RECOMMENDED FLOW','Explora':'Explore','Busca una región o aterrizaje.':'Find a region or landing site.','Planifica':'Plan','Define objetivos científicos.':'Define science targets.','Analiza':'Analyze','Evalúa terreno y restricciones.':'Evaluate terrain and constraints.',
    'RUTA SELECCIONADA':'SELECTED ROUTE','Esperando selección':'Waiting for selection','Crea una misión y añade dos o más puntos. Cada tramo se calcula sobre el terreno y luego se consolida la misión.':'Create a mission and add two or more points. Each leg is calculated over the terrain and then consolidated into the mission.','DISTANCIA TOTAL':'TOTAL DISTANCE','DURACIÓN EST.':'EST. DURATION','PENDIENTE MÁX.':'MAX SLOPE','DESNIVEL ACUM.':'TOTAL ELEVATION CHANGE','TIEMPO EN OBJETIVOS':'TIME AT TARGETS','PARÁMETROS OPERACIONALES':'OPERATIONAL PARAMETERS','Velocidad nominal':'Nominal speed','Tiempo máximo EVA':'Maximum EVA time','Margen de retorno':'Return margin','LÍMITES DUROS DE NAVEGACIÓN':'HARD NAVIGATION LIMITS','Pendiente máxima permitida':'Maximum allowed slope','Transitabilidad mínima':'Minimum traversability','Confianza cartográfica mínima':'Minimum cartographic confidence','Recalcular misión':'Recalculate mission','Último cálculo: —':'Last calculation: —',
    'RETORNO CIENTÍFICO':'SCIENCE RETURN','El motor prioriza objetivos opcionales según su valor científico frente al costo adicional de distancia, tiempo, dificultad y confianza cartográfica.':'The engine prioritizes optional targets by science value versus additional distance, time, difficulty and cartographic-confidence cost.','CÓMO AFECTA LA RUTA':'HOW IT AFFECTS THE ROUTE','Valor científico':'Science value','Mayor valor aumenta la prioridad de un objetivo opcional.':'Higher value increases the priority of an optional target.','Tiempo de trabajo':'Work time','Se suma a la duración total de la EVA.':'Added to total EVA duration.','Obligatoriedad':'Requirement','Un objetivo obligatorio debe incluirse para que la misión sea válida.':'A required target must be included for the mission to be valid.',
    'DIFICULTAD TOPOGRÁFICA EXPERIMENTAL':'EXPERIMENTAL TOPOGRAPHIC DIFFICULTY','Derivada del DEM global MDEM200M. No certifica seguridad humana.':'Derived from the global MDEM200M DEM. It does not certify human safety.','Pendiente media':'Average slope','Segmentos evaluados':'Evaluated segments','Margen operacional':'Operational margin','Transitabilidad media':'Average traversability','Confianza cartográfica media':'Average cartographic confidence','Confianza mínima':'Minimum confidence','Valor científico incluido':'Included science value','Fuente del relieve':'Relief source','PRINCIPIO DE SEGURIDAD':'SAFETY PRINCIPLE','SEGURO':'SAFE','NO SEGURO':'UNSAFE','DESCONOCIDO':'UNKNOWN','La arquitectura reserva explícitamente el estado DESCONOCIDO para futuras capas de peligros y datos incompletos.':'The architecture explicitly reserves UNKNOWN for future hazard layers and incomplete data.',
    'ESTADO EVA':'EVA STATUS','RUTA':'ROUTE','RESERVA DE RETORNO':'RETURN RESERVE','TOPOGRAFÍA':'TOPOGRAPHY','RECURSOS EVA':'EVA RESOURCES','BATERÍA':'BATTERY','CONTROL TÉRMICO':'THERMAL CONTROL','FUTURO':'FUTURE','Los recursos se separarán del motor de rutas para que el Planificador, el Navegador EVA y Control de misión consuman el mismo estado.':'Resources will remain separate from the route engine so Mission Planner, EVA Navigator and Mission Control can consume the same state.',
    'TRIPULACIÓN / TELEMETRÍA':'CREW / TELEMETRY','Sin telemetría conectada':'No telemetry connected','EVENTOS DE MISIÓN':'MISSION EVENTS','Aún no existe un registro operativo en tiempo real. Este panel queda desacoplado para implementarlo sin alterar el mapa.':'A real-time operational log is not yet available. This panel remains decoupled so it can be implemented without altering the map.',
    'RESULTADO DE LA RUTA':'ROUTE RESULT','RIESGO / DIFICULTAD':'RISK / DIFFICULTY','PENDIENTE MEDIA':'AVERAGE SLOPE','VALOR CIENTÍFICO':'SCIENCE VALUE','MARGEN':'MARGIN','DOCUMENTO DE MISIÓN':'MISSION DOCUMENT','El PDF incluye identificación de misión, parámetros, objetivos científicos, estrategias, métricas, tramos, coordenadas, nodos de ruta, fuentes y limitaciones.':'The PDF includes mission identification, parameters, science targets, strategies, metrics, legs, coordinates, route nodes, sources and limitations.',
    'PERFIL ACTIVO':'ACTIVE PROFILE','Sin nombre definido':'No name defined','PARÁMETROS':'PARAMETERS','Valores de fábrica':'Factory values','HISTORIAL':'HISTORY','ALCANCE':'SCOPE','La configuración se guarda únicamente en este navegador. Exportar la misión a JSON permite respaldarla o transferirla a otro equipo antes de recalcularla.':'Settings are stored only in this browser. Exporting the mission to JSON lets you back it up or transfer it to another computer before recalculating.',
    'CARGANDO…':'LOADING…','ERROR':'ERROR','Bajo':'Low','Moderado':'Moderate','Alto':'High','Muy alto':'Very high','ninguno':'none'
  };
  const EN_ES = Object.fromEntries(Object.entries(ES_EN).map(([a,b]) => [b,a]));
  let storedLanguage = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY) || localStorage.getItem('jezero-language-v30');
  let current = VALID.has(storedLanguage) ? storedLanguage : 'es';
  let mutating = false;

  const moduleLabels = {
    es:{explorer:'MAPA',planner:'MISIÓN',eva:'EVA',analysis:'RESULTADOS',settings:'CONFIGURACIÓN'},
    en:{explorer:'MAP',planner:'MISSION',eva:'EVA',analysis:'RESULTS',settings:'SETTINGS'}
  };

  function translatePattern(text, lang=current){
    let s=String(text ?? '');
    if(lang==='en'){
      s=s.replace(/^(\d+) misiones$/,'$1 missions').replace(/^1 misión$/,'1 mission');
      s=s.replace(/^(\d+) puntos$/,'$1 points').replace(/^(\d+) punto\(s\)$/,'$1 point(s)');
      s=s.replace(/^Último cálculo: /,'Last calculation: ');
      s=s.replace(/^Guardados: /,'Saved: ').replace(/pendiente ≤/g,'slope ≤').replace(/transitabilidad ≥/g,'traversability ≥').replace(/confianza ≥/g,'confidence ≥').replace(/margen /g,'margin ');
      s=s.replace(/^Misión importada:/,'Mission imported:').replace(/Recalcula para actualizar resultados\./,'Recalculate to update results.');
      s=s.replace(/ se añadió como objetivo opcional\.$/,' was added as an optional target.').replace(/ quedó establecida como BASE \(P0\)\.$/,' was set as BASE (P0).').replace(/ se añadió a la misión\.$/,' was added to the mission.');
      s=s.replace(/^OBJETIVO P(\d+)$/,'TARGET P$1');
      return ES_EN[s] || s;
    }
    s=s.replace(/^(\d+) missions$/,'$1 misiones').replace(/^1 mission$/,'1 misión').replace(/^(\d+) points$/,'$1 puntos').replace(/^(\d+) point\(s\)$/,'$1 punto(s)');
    s=s.replace(/^Last calculation: /,'Último cálculo: ');
    s=s.replace(/^Saved: /,'Guardados: ').replace(/slope ≤/g,'pendiente ≤').replace(/traversability ≥/g,'transitabilidad ≥').replace(/confidence ≥/g,'confianza ≥').replace(/margin /g,'margen ');
    s=s.replace(/^Mission imported:/,'Misión importada:').replace(/Recalculate to update results\./,'Recalcula para actualizar resultados.');
    s=s.replace(/ was added as an optional target\.$/,' se añadió como objetivo opcional.').replace(/ was set as BASE \(P0\)\.$/,' quedó establecida como BASE (P0).').replace(/ was added to the mission\.$/,' se añadió a la misión.');
    s=s.replace(/^TARGET P(\d+)$/,'OBJETIVO P$1');
    return EN_ES[s] || s;
  }

  function translateText(text, lang=current){
    const raw=String(text ?? '');
    const leading=raw.match(/^\s*/)?.[0]||'';
    const trailing=raw.match(/\s*$/)?.[0]||'';
    const core=raw.trim();
    if(!core) return raw;
    const direct=lang==='en' ? (ES_EN[core] || translatePattern(core,lang)) : (EN_ES[core] || translatePattern(core,lang));
    return leading+direct+trailing;
  }

  function translateTree(root=document){
    if(mutating) return;
    mutating=true;
    try{
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
        if(!node.parentElement || ['SCRIPT','STYLE'].includes(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
      }});
      const nodes=[]; let n; while((n=walker.nextNode())) nodes.push(n);
      nodes.forEach(node=>{ const next=translateText(node.nodeValue,current); if(next!==node.nodeValue) node.nodeValue=next; });
      const attrs=['title','placeholder','aria-label'];
      root.querySelectorAll?.('*').forEach(el=>attrs.forEach(a=>{ if(el.hasAttribute(a)){const v=el.getAttribute(a);const nv=translateText(v,current);if(nv!==v)el.setAttribute(a,nv);} }));
    } finally { mutating=false; }
  }

  function applyLanguage(lang,{persist=true}={}){
    if(!VALID.has(lang)) lang='es';
    current=lang;
    if(persist) localStorage.setItem(KEY,lang);
    document.documentElement.lang=lang;
    translateTree(document);
    const selector=document.getElementById('languageSetting');
    if(selector && selector.value!==lang) selector.value=lang;
    window.dispatchEvent(new CustomEvent('jezero:languagechange',{detail:{language:lang}}));
  }

  const observer=new MutationObserver(mutations=>{
    if(mutating) return;
    for(const m of mutations){
      if(m.type==='characterData' && m.target?.nodeValue?.trim()){
        const nv=translateText(m.target.nodeValue,current); if(nv!==m.target.nodeValue){mutating=true;m.target.nodeValue=nv;mutating=false;}
      } else if(m.type==='childList'){
        m.addedNodes.forEach(node=>{ if(node.nodeType===1) translateTree(node); else if(node.nodeType===3 && node.nodeValue.trim()){const nv=translateText(node.nodeValue,current);if(nv!==node.nodeValue){mutating=true;node.nodeValue=nv;mutating=false;}} });
      }
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  window.JEZERO_I18N=Object.freeze({
    getLanguage:()=>current,
    setLanguage:(lang)=>applyLanguage(lang),
    translateText:(text,lang=current)=>translateText(text,lang),
    moduleLabel:(name)=>moduleLabels[current]?.[name] || moduleLabels.es[name] || name,
    ui:(es,en)=>current==='en'?en:es
  });

  applyLanguage(current,{persist:false});
})();
