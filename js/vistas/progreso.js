import { el, pintar, repintar, mensajeError, rolesDeTabla, turnoActual, vigente, campo, selector, formatoFecha } from '../ui.js?v=202610151749';
import { cargarCatalogos, listarIniciativas, ultimosAvances } from '../datos.js?v=202610151749';
import { cadenaArea, unidadesIniciativa, opcionesArea } from '../etiquetas.js?v=202610151749';

// Progreso, el tablero del observador: cómo van las iniciativas de la empresa o del
// área de quien mira. Todo sale de datos que ya llegan: la etapa (el estado, con los pasos propios
// de cada track), el ritmo (la etapa de cada iniciativa frente a la fecha límite de cada etapa,
// `estado_iniciativa.fecha_meta`) y el impacto (medida inicial medible y selección para el MVP Day). Lo que cada quien ve lo decide
// la base: un observador con áreas asignadas solo recibe esas áreas. El equipo lo abre desde
// Inicio con el interruptor "Tablero observador".

// Filtros: se conservan mientras dura la sesión en esta pestaña.
const filtros = { empresa: '', area: '', herramienta: '' };
export function olvidarFiltrosProgreso() {
  Object.assign(filtros, { empresa: '', area: '', herramienta: '' });
}

// Bajo el título de cada sección, una línea que dice cómo leerla y, solo si hace falta, una
// leyenda con lo que no se deduce mirando el tablero (menos carga para quien llega).
const ayuda = (texto, leyenda = null) => [
  el('p', { class: 'bloque__ayuda', text: texto }),
  leyenda ? el('p', { class: 'claves' }, leyenda) : null,
];
const cifraColor = (clase, texto) => el('span', { class: `claves__cifra claves__cifra--${clase}`, text: texto });

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const porcentaje = (n, total) => (total ? Math.round((n / total) * 100) : 0);

// Interruptor de Inicio ↔ tablero, para quien no es observador (el observador entra directo al tablero).
export function interruptorTablero(activo) {
  return el('button', {
    type: 'button', role: 'switch', class: 'interruptor', 'aria-checked': String(activo),
    onclick: () => { location.hash = activo ? '#/' : '#/progreso'; },
  }, el('span', { class: 'interruptor__pista', 'aria-hidden': 'true' }, el('span', { class: 'interruptor__perilla' })),
  'Tablero observador');
}

// Fecha de hoy en Managua (AAAA-MM-DD), para compararla con el calendario.
const hoyManagua = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua' }).format(new Date());
// Una fecha del calendario (sin hora) se lee a mediodía: así no cambia de día por la zona horaria.
const fechaCalendario = (dia) => formatoFecha(`${dia}T12:00:00`);

// Lo último que ya venció de una lista con fecha (el mismo día todavía no cuenta: el Avance se
// envía ese día). undefined = nada tiene fecha; null = todavía no vence nada.
function vencido(lista, campo, hoy) {
  if (!lista.some((x) => x[campo])) return undefined;
  return lista.filter((x) => x[campo] && x[campo] < hoy).at(-1) ?? null;
}

const entregada = (ini) => ini.estado?.nombre === 'Entregada';

// Va al día si su etapa llega a la meta de hoy: la última etapa del track cuya fecha límite ya
// pasó. null = no se puede saber (sin herramienta o sin fechas límite).
function alDia(ini, meta) {
  if (!ini.track_id || meta === undefined) return null;
  if (meta === null) return true;
  return (ini.estado?.orden ?? 0) >= meta.orden;
}

const medible = (ini) => Boolean(ini.medida_tipo) && ini.medida_tipo !== 'No se mide';

// Color de una cifra "al día": verde desde 80 %, ámbar desde 50 %, rojo por debajo.
const semaforo = (pct) => (pct >= 80 ? 'bien' : pct >= 50 ? 'regular' : 'mal');

export async function vistaProgreso(contenedor, perfil) {
  const turno = turnoActual();
  const observador = perfil.rol === 'observador';
  const encabezado = () => el('div', { class: 'encabezado' },
    el('h1', { text: 'Progreso' }),
    observador ? null : interruptorTablero(true));
  pintar(contenedor, encabezado(), el('p', { class: 'cargando', text: 'Cargando…' }));
  let cat; let iniciativas; let ultimos;
  try {
    [cat, iniciativas, ultimos] = await Promise.all([cargarCatalogos(), listarIniciativas(), ultimosAvances()]);
  } catch (e) {
    if (!vigente(turno)) return;
    pintar(contenedor, encabezado(), el('p', { class: 'mensaje mensaje--error', role: 'alert', text: mensajeError(e) }));
    return;
  }
  if (!vigente(turno)) return;

  const hoy = hoyManagua();
  const puntosDe = (trackId) => cat.puntos.filter((p) => p.activo && p.track_id === trackId).sort((a, b) => a.orden - b.orden);
  const estadosDe = (trackId) => cat.estados.filter((e) => e.activo && e.track_id === trackId).sort((a, b) => a.orden - b.orden);
  // Meta de hoy por track (etapa) y último punto de guardado vencido (para quién no envió el Avance).
  // CG no cuenta para el Avance: desde el 12 oct es el último día de la Entrega de Gemini, sin sesión.
  const metas = new Map(cat.tracks.map((t) => [t.id, vencido(estadosDe(t.id), 'fecha_meta', hoy)]));
  const esperado = new Map(cat.tracks.map((t) => [t.id, vencido(puntosDe(t.id).filter((p) => p.codigo !== 'CG'), 'fecha_esperada', hoy)]));
  const area = new Map(cat.areas.map((a) => [a.id, a]));

  // cadena: su unidad y las de arriba (Jefatura → Gerencia → Dirección); cada una la cuenta.
  const todas = iniciativas.filter((i) => i.activa).map((ini) => {
    const ultimo = ultimos.get(ini.id);
    // unidades: para filtrar (incluye los tres niveles del Registro v3); cadena: para agrupar por área.
    return { ini, ultimo, cadena: cadenaArea(ini.area_id, area), unidades: unidadesIniciativa(ini, area), alDia: alDia(ini, metas.get(ini.track_id)) };
  });

  const empresas = cat.empresas.filter((e) => todas.some((x) => x.ini.participante.empresa_id === e.id));
  // Un filtro que ya no tiene iniciativas (la empresa o el área quedaron sin ninguna desde la
  // última visita) no aparece en su lista y no se podría quitar: se limpia.
  const conIniciativas = new Set(todas.flatMap(({ unidades }) => unidades));
  if (filtros.empresa && !empresas.some((e) => String(e.id) === filtros.empresa)) filtros.empresa = '';
  if (filtros.area && !conIniciativas.has(filtros.area)) filtros.area = '';

  // Al cambiar un filtro se vuelve a dibujar con los datos ya cargados, sin volver arriba.
  const dibujar = (primera) => {
    const enFiltro = todas.filter(({ ini, unidades }) => {
      if (filtros.empresa && String(ini.participante.empresa_id) !== filtros.empresa) return false;
      if (filtros.area && !unidades.includes(filtros.area)) return false;
      if (filtros.herramienta && String(ini.track_id) !== filtros.herramienta) return false;
      return true;
    });
    (primera ? pintar : repintar)(contenedor,
      encabezado(),
      el('p', { class: 'texto-secundario', text: alcance(perfil, cat, empresas) }),
      barraFiltros(cat, empresas, todas, () => dibujar(false)),
      todas.length === 0
        ? el('p', { class: 'vacio', text: 'Todavía no hay iniciativas activas para mostrar.' })
        : enFiltro.length === 0
          ? el('p', { class: 'vacio', text: 'No hay iniciativas con estos filtros.' })
          : [
              resumen(enFiltro, metas),
              etapas(enFiltro, cat),
              calendario(enFiltro, cat, metas, esperado, hoy),
              porArea(enFiltro, cat, perfil, empresas.length > 1 && !filtros.empresa),
            ],
    );
  };
  dibujar(true);
}

// Qué ve quien mira, en una línea.
function alcance(perfil, cat, empresas) {
  const nombres = (cat.empresas.length ? cat.empresas : empresas).map((e) => e.nombre).join(', ');
  const propias = (perfil.areas ?? []).map((id) => cat.areas.find((a) => a.id === id)).filter(Boolean);
  if (propias.length && (perfil.rol === 'observador' || perfil.rol === 'soporte')) {
    const empresa = (a) => cat.empresas.find((e) => e.id === a.empresa_id)?.nombre;
    return `Ves las iniciativas de ${propias.map((a) => `${a.nombre} (${empresa(a)})`).join(', ')} y de las unidades que dependen de ${propias.length === 1 ? 'ella' : 'ellas'}.`;
  }
  if (perfil.rol !== 'observador') return `Lo que ve una gerencia de ${nombres || 'tus empresas'}. Una jefatura ve solo su unidad.`;
  return nombres ? `Iniciativas activas de ${nombres}.` : 'Iniciativas activas de tus empresas.';
}

function barraFiltros(cat, empresas, todas, alCambiar) {
  // Solo unidades con iniciativas a la vista (propias o de las que dependen de ellas), en árbol:
  // cada dirección es un grupo y dentro va el camino desde ella.
  const conIniciativas = new Set(todas.flatMap(({ cadena }) => cadena.map((a) => a.id)));
  const nombreEmpresa = new Map(cat.empresas.map((e) => [e.id, e.nombre]));
  const areas = cat.areas
    .filter((a) => conIniciativas.has(a.id) && (!filtros.empresa || String(a.empresa_id) === filtros.empresa));
  const varias = empresas.length > 1;

  const empresa = selector([{ valor: '', texto: 'Todas' }, ...empresas.map((e) => ({ valor: e.id, texto: e.nombre }))], filtros.empresa);
  const area = selector([{ valor: '', texto: 'Todas' },
    ...opcionesArea(areas, (a) => (varias && !filtros.empresa ? nombreEmpresa.get(a.empresa_id) : null))], filtros.area);
  const herramienta = selector([{ valor: '', texto: 'Todas' }, ...cat.tracks.map((t) => ({ valor: t.id, texto: t.nombre }))], filtros.herramienta);
  const leer = () => {
    // Otra empresa: el área elegida puede no ser de ella.
    if (empresa.value !== filtros.empresa) area.value = '';
    Object.assign(filtros, { empresa: empresa.value, area: area.value, herramienta: herramienta.value });
    alCambiar();
  };
  for (const control of [empresa, area, herramienta]) control.addEventListener('change', leer);
  return el('form', { class: 'filtros filtros--consultas', role: 'search', 'aria-label': 'Filtrar el progreso', onsubmit: (e) => e.preventDefault() },
    varias ? campo('p-empresa', 'Empresa', empresa) : null,
    areas.length > 1 ? campo('p-area', 'Unidad', area) : null,
    campo('p-herramienta', 'Herramienta', herramienta));
}

// Cuatro cifras: cuántas, cuántas entregadas, cuántas al día y cuántas al MVP Day. El color va en
// el número.
function resumen(lista, metas) {
  const n = lista.length;
  const entregadas = lista.filter((x) => entregada(x.ini)).length;
  const conRitmo = lista.filter((x) => x.alDia !== null);
  const alDiaN = conRitmo.filter((x) => x.alDia).length;
  const pctAlDia = porcentaje(alDiaN, conRitmo.length);
  const mvp = lista.filter((x) => x.ini.mvp_seleccionada).length;
  const hayCalendario = [...metas.values()].some((m) => m !== undefined);
  const cifra = (numero, color, texto, detalle) => el('li', { class: 'cifra' },
    el('span', { class: `cifra__numero cifra__numero--${color}`, text: numero }),
    el('span', { class: 'cifra__texto', text: texto }),
    el('span', { class: 'cifra__detalle', text: detalle }));
  return el('section', { class: 'bloque bloque--primero', 'aria-labelledby': 'resumen-titulo' },
    el('h2', { id: 'resumen-titulo', class: 'solo-lectores', text: 'Resumen' }),
    el('ul', { class: 'cifras' },
      cifra(String(n), 'marca', n === 1 ? 'iniciativa activa' : 'iniciativas activas',
        plural(lista.filter((x) => x.ini.track_id).length, 'con herramienta', 'con herramienta')),
      cifra(String(entregadas), 'bien', entregadas === 1 ? 'entregada' : 'entregadas', `${porcentaje(entregadas, n)} % del total`),
      hayCalendario && conRitmo.length
        ? cifra(`${pctAlDia} %`, semaforo(pctAlDia), 'al día con el calendario', `${alDiaN} de ${conRitmo.length} con herramienta`)
        : cifra('—', 'apagada', 'al día con el calendario', 'Falta cargar las fechas límite de las etapas.'),
      cifra(String(mvp), 'mvp', mvp === 1 ? 'seleccionada para MVP Day' : 'seleccionadas para MVP Day',
        plural(lista.filter((x) => medible(x.ini)).length, 'con medida inicial medible', 'con medida inicial medible'))));
}

// Tono de un paso del track en la escala de etapas: gris (registrada) y verdes cada vez más
// oscuros hasta entregada. Los pasos se reparten sobre los 6 tonos: Claude usa todos y Gemini el
// gris, el verde del medio y el último.
function tono(i, total) {
  return `var(--etapa-${total > 1 ? Math.round((i / (total - 1)) * 5) : 5})`;
}

// Estados de un track para dibujarlo: los activos, más uno inactivo si alguna iniciativa quedó en él.
const estadosParaVer = (cat, trackId, de) => cat.estados
  .filter((e) => e.track_id === trackId && (e.activo || de.some((x) => x.ini.estado_id === e.id)))
  .sort((a, b) => a.orden - b.orden);

// Etapa por herramienta: los estados propios de cada track, en orden, con cuántas hay en cada uno.
function etapas(lista, cat) {
  const sinHerramienta = lista.filter((x) => !x.ini.track_id).length;
  const filas = cat.tracks.map((t) => ({ t, de: lista.filter((x) => x.ini.track_id === t.id) })).filter((f) => f.de.length);
  return el('section', { class: 'bloque bloque--tablero', 'aria-labelledby': 'etapas-titulo' },
    el('h2', { id: 'etapas-titulo', text: 'Etapa' }),
    ayuda('La etapa que cada persona declaró en su último Avance.'),
    el('div', { class: 'tarjeta progreso__tarjeta' },
      filas.map(({ t, de }) => {
        const estados = estadosParaVer(cat, t.id, de);
        const pasos = estados.map((e, i) => ({ e, n: de.filter((x) => x.ini.estado_id === e.id).length, color: tono(i, estados.length) }));
        return el('div', { class: 'etapa' },
          el('p', { class: 'etapa__titulo' }, el('strong', { text: t.nombre }), ` · ${plural(de.length, 'iniciativa', 'iniciativas')}`),
          el('div', { class: 'barra-fases', 'aria-hidden': 'true' },
            pasos.filter((p) => p.n).map((p) => {
              const parte = el('span', { class: 'barra-fases__parte', title: `${p.e.nombre}: ${p.n}` });
              parte.style.flexGrow = String(p.n);
              parte.style.background = p.color;
              return parte;
            })),
          el('ol', { class: 'leyenda' }, pasos.map((p) => {
            const muestra = el('span', { class: 'leyenda__muestra', 'aria-hidden': 'true' });
            muestra.style.background = p.color;
            return el('li', { class: `leyenda__item${p.n ? '' : ' leyenda__item--vacio'}` },
              muestra, `${p.e.nombre} `, el('strong', { text: String(p.n) }));
          })));
      }),
      sinHerramienta
        ? el('p', { class: 'nota', text: `${plural(sinHerramienta, 'iniciativa', 'iniciativas')} sin herramienta asignada: todavía no ${sinHerramienta === 1 ? 'tiene' : 'tienen'} estado.` })
        : null));
}

// Avance frente al calendario: un paso por etapa con cuántas iniciativas hay en
// ella y su fecha límite. La meta de hoy va marcada; lo que está antes de ella va atrasado. Debajo,
// cuántas no enviaron el Avance del último punto de guardado vencido: su etapa puede estar vieja.
function calendario(lista, cat, metas, esperado, hoy) {
  const filas = cat.tracks.map((t) => ({ t, de: lista.filter((x) => x.ini.track_id === t.id) })).filter((f) => f.de.length);
  const hayFechas = filas.some(({ t }) => metas.get(t.id) !== undefined);
  // La sesión de cada fecha límite (REG, G1, C2…), si alguna cae ese día.
  const sesion = (trackId, fecha) => cat.puntos.find((p) => p.activo && p.fecha_esperada === fecha && (p.track_id === trackId || !p.track_id))?.codigo;
  return el('section', { class: 'bloque bloque--tablero', 'aria-labelledby': 'calendario-titulo' },
    el('h2', { id: 'calendario-titulo', text: 'Avance frente al calendario' }),
    ayuda('Cada etapa tiene una fecha límite.',
      [cifraColor('mal', 'Cifras en rojo'), ': atrasadas, siguen en una etapa anterior a la que ya venció.']),
    hayFechas ? null : el('p', { class: 'nota', text: 'Todavía no hay fechas límite para las etapas: se muestra cuántas hay en cada una.' }),
    el('div', { class: 'tarjeta progreso__tarjeta' },
      filas.map(({ t, de }) => {
        const meta = metas.get(t.id);
        const estados = estadosParaVer(cat, t.id, de);
        const atrasadas = de.filter((x) => x.alDia === false).length;
        const punto = esperado.get(t.id);
        const sinAvance = punto ? de.filter((x) => !entregada(x.ini) && (x.ultimo?.orden ?? 1) < punto.orden).length : 0;
        const fechaDe = (e) => {
          if (!e.fecha_meta) return 'Sin fecha límite';
          const codigo = sesion(t.id, e.fecha_meta);
          return `${codigo ? `${codigo} · ` : ''}${e.fecha_meta < hoy ? 'venció' : 'hasta'} ${fechaCalendario(e.fecha_meta)}`;
        };
        // La línea "Hoy" va antes de la primera etapa que todavía no vence (o después de la última).
        const vencida = (e) => Boolean(e.fecha_meta) && e.fecha_meta < hoy;
        const primeraFutura = estados.findIndex((e) => !vencida(e));
        const conLinea = meta === undefined ? -1 : primeraFutura === -1 ? estados.length - 1 : primeraFutura;
        const pasos = el('ol', { class: 'pasos' }, estados.map((e, i) => {
          const n = de.filter((x) => x.ini.estado_id === e.id).length;
          const esMeta = meta && meta.id === e.id;
          const clases = ['paso',
            vencida(e) ? 'paso--vencida' : '',
            meta && e.orden < meta.orden && n ? 'paso--atrasada' : '',
            i === conLinea ? 'paso--hoy' : '',
            i === conLinea && primeraFutura === -1 ? 'paso--hoy-fin' : ''].filter(Boolean).join(' ');
          const color = el('span', { class: 'paso__color', 'aria-hidden': 'true' });
          color.style.background = tono(i, estados.length);
          return el('li', { class: clases, 'data-hoy': i === conLinea ? `Hoy · ${fechaCalendario(hoy)}` : null },
            color,
            esMeta ? el('span', { class: 'paso__meta pildora-meta', text: 'Meta de hoy' }) : null,
            el('strong', { class: 'paso__cifra', text: String(n) }),
            el('span', { class: 'paso__nombre', text: e.nombre }),
            el('span', { class: 'paso__fecha', text: fechaDe(e) }));
        }));
        pasos.style.setProperty('--pasos', String(estados.length));
        return el('div', { class: 'calendario' },
          el('div', { class: 'calendario__cabeza' },
            el('p', { class: 'etapa__titulo' }, el('strong', { text: t.nombre }), ` · ${plural(de.length, 'iniciativa', 'iniciativas')}`,
              meta ? ` · a hoy debían llegar a ${meta.nombre}`
                : meta === null ? ' · todavía no vence ninguna etapa' : null),
            meta ? el('ul', { class: 'calendario__cuentas' },
              el('li', { class: 'calendario__cuenta calendario__cuenta--bien' }, el('strong', { text: String(de.length - atrasadas) }), ' al día'),
              el('li', { class: `calendario__cuenta${atrasadas ? ' calendario__cuenta--mal' : ''}` }, el('strong', { text: String(atrasadas) }), atrasadas === 1 ? ' atrasada' : ' atrasadas'))
              : null),
          pasos,
          punto ? el('p', { class: 'nota calendario__nota', text: sinAvance
            ? `${plural(sinAvance, 'iniciativa no envió', 'iniciativas no enviaron')} el Avance de ${punto.codigo} (${fechaCalendario(punto.fecha_esperada)}): su etapa puede no estar al día.`
            : `Todas enviaron el Avance de ${punto.codigo} (${fechaCalendario(punto.fecha_esperada)}).` }) : null);
      })));
}

// Por área, en árbol: Dirección → Gerencia → Jefatura (o área → subárea en el
// catálogo anterior), por empresa y en orden alfabético. Cada unidad suma las suyas y las de las
// unidades que dependen de ella; las de abajo van debajo, con sangría, y lo que falta clasificar,
// al final. Un observador con unidades asignadas ve el árbol desde ellas. Cada fila dice cuántas
// tiene, cuántas entregó, cuántas van al día, cuántas atrasadas y cuántas en el MVP Day; tocarla
// abre sus iniciativas.
function porArea(lista, cat, perfil, conEmpresa) {
  const nombreEmpresa = new Map(cat.empresas.map((e) => [e.id, e.nombre]));
  const propias = new Set(perfil.rol === 'observador' || perfil.rol === 'soporte' ? perfil.areas ?? [] : []);
  // Nodos del árbol: id → { area, de: iniciativas que suma, hijos: ids }; raíces y sin área, por empresa.
  const nodos = new Map();
  const raices = new Map();
  const sinArea = new Map();
  for (const x of lista) {
    const e = x.ini.participante.empresa_id;
    let camino = [...x.cadena].reverse(); // de la raíz a su unidad
    const desde = camino.findIndex((a) => propias.has(a.id));
    if (desde > 0) camino = camino.slice(desde);
    if (!camino.length) {
      if (!sinArea.has(e)) sinArea.set(e, []);
      sinArea.get(e).push(x);
      continue;
    }
    if (!raices.has(e)) raices.set(e, new Set());
    raices.get(e).add(camino[0].id);
    camino.forEach((a, k) => {
      if (!nodos.has(a.id)) nodos.set(a.id, { area: a, de: [], hijos: new Set() });
      nodos.get(a.id).de.push(x);
      if (k > 0) nodos.get(camino[k - 1].id).hijos.add(a.id);
    });
  }

  const celdaEntregadas = (de) => {
    const n = de.filter((x) => entregada(x.ini)).length;
    const relleno = el('span', { class: 'ritmo__relleno ritmo__relleno--bien' });
    relleno.style.width = `${porcentaje(n, de.length)}%`;
    return [el('span', { class: 'celda__cifra', text: `${n} de ${de.length}` }), el('span', { class: 'ritmo__barra ritmo__barra--celda', 'aria-hidden': 'true' }, relleno)];
  };
  const celdaAlDia = (de) => {
    const con = de.filter((x) => x.alDia !== null);
    if (!con.length) return el('span', { class: 'texto-secundario', text: '—' });
    const n = con.filter((x) => x.alDia).length;
    return el('span', { class: `celda__cifra cifra__numero--${semaforo(porcentaje(n, con.length))}`, text: `${porcentaje(n, con.length)} %` });
  };
  const fila = (titulo, de, { nivel = 0, conSub = false, href = null, nota = null } = {}) => {
    const atrasadas = de.filter((x) => x.alDia === false).length;
    const clases = [nivel ? 'fila--sub' : '', nivel > 1 ? 'fila--sub-2' : '', !nivel && conSub ? 'fila--con-sub' : ''];
    return el('tr', { class: clases.filter(Boolean).join(' ') },
      el('th', { scope: 'row', 'data-etiqueta': 'Unidad' },
        href ? el('a', { class: 'enlace', href }, titulo) : titulo,
        nota ? el('span', { class: 'celda__nota', text: nota }) : null),
      el('td', { class: 'numero', 'data-etiqueta': 'Iniciativas', text: String(de.length) }),
      el('td', { 'data-etiqueta': 'Entregadas' }, celdaEntregadas(de)),
      el('td', { class: 'numero', 'data-etiqueta': 'Al día' }, celdaAlDia(de)),
      el('td', { class: `numero${atrasadas ? ' celda--alerta' : ''}`, 'data-etiqueta': 'Atrasadas', text: String(atrasadas) }),
      el('td', { class: 'numero', 'data-etiqueta': 'MVP Day', text: String(de.filter((x) => x.ini.mvp_seleccionada).length) }));
  };

  const porNombre = (a, b) => nodos.get(a).area.nombre.localeCompare(nodos.get(b).area.nombre);
  const rama = (id, nivel) => {
    const n = nodos.get(id);
    const hijos = [...n.hijos].sort(porNombre);
    return [
      // Con la herramienta elegida en el tablero, para que la lista dé el mismo número que la fila.
      fila(n.area.nombre, n.de, { nivel, conSub: hijos.length > 0, href: `#/registros?area=${id}${filtros.herramienta ? `&herramienta=${filtros.herramienta}` : ''}` }),
      ...hijos.flatMap((h) => rama(h, nivel + 1)),
    ];
  };
  const empresasOrdenadas = [...new Set([...raices.keys(), ...sinArea.keys()])]
    .sort((a, b) => (nombreEmpresa.get(a) ?? '').localeCompare(nombreEmpresa.get(b) ?? ''));
  const filas = empresasOrdenadas.flatMap((e) => {
    const total = lista.filter((x) => x.ini.participante.empresa_id === e);
    const encabezado = conEmpresa
      ? [el('tr', { class: 'fila--grupo' }, el('th', { scope: 'colgroup', colspan: '6' },
          nombreEmpresa.get(e), el('span', { class: 'celda__nota', text: ` · ${plural(total.length, 'iniciativa', 'iniciativas')}` })))]
      : [];
    const sin = sinArea.get(e);
    return [
      ...encabezado,
      ...[...(raices.get(e) ?? [])].sort(porNombre).flatMap((id) => rama(id, 0)),
      ...(sin ? [fila('Unidad por clasificar', sin, { nota: 'El facilitador le asigna la unidad' })] : []),
    ];
  });

  return el('section', { class: 'bloque bloque--tablero', 'aria-labelledby': 'areas-titulo' },
    el('h2', { id: 'areas-titulo', text: 'Por unidad' }),
    ayuda('Las mismas cifras por unidad; cada una suma también las de las unidades que dependen de ella. Toca una unidad para ver sus iniciativas.',
      ['% al día: ', cifraColor('bien', 'verde'), ' desde 80 %, ', cifraColor('regular', 'ámbar'), ' (en riesgo) desde 50 %, ', cifraColor('mal', 'rojo'), ' debajo.']),
    el('div', { class: 'tabla-contenedor tabla-contenedor--resumen' },
      rolesDeTabla(el('table', { class: 'tabla tabla--resumen tabla--progreso' },
        el('caption', { class: 'solo-lectores', text: 'Progreso por unidad: iniciativas, entregadas, % al día con el calendario, atrasadas y seleccionadas para MVP Day' }),
        el('thead', {}, el('tr', {},
          ['Unidad', 'Iniciativas', 'Entregadas', 'Al día', 'Atrasadas', 'MVP Day'].map((t) => el('th', { scope: 'col', text: t })))),
        el('tbody', {}, filas)))));
}
