import { el, pintar, ROLES, mensajeError, rolesDeTabla, turnoActual, vigente, conteoRevision, conteoConsultas } from '../ui.js?v=202610131530';
import {
  cargarCatalogos, listarIniciativas, idsEnRevision, totalPendientes, contarTicketsSinResponder, bloqueosUltimoAvance,
} from '../datos.js?v=202610131530';
import { BLOQUEOS, unidadPorClasificar } from '../etiquetas.js?v=202610131530';
import { interruptorTablero } from './progreso.js?v=202610131530';

const QUE_PUEDE = {
  admin: 'Ves todas las empresas. Puedes revisar y corregir registros, resolver respuestas en revisión y mantener los catálogos.',
  facilitador: 'Puedes revisar y corregir registros de tus empresas, asignar herramienta, tipo y unidad, y resolver respuestas en revisión.',
  soporte: 'Puedes ver las iniciativas de tus empresas y responder sus consultas.',
  observador: 'Puedes ver las iniciativas y avances de tus empresas. Solo lectura.',
};

const esOperador = (perfil) => perfil.rol === 'admin' || perfil.rol === 'facilitador';
const gestionaTickets = (perfil) => esOperador(perfil) || perfil.rol === 'soporte';
const plural = (n, uno, varios) => (n === 1 ? uno : varios);

// Inicio: primero lo que necesita atención (admin y facilitador), luego cuántas iniciativas
// hay por empresa y al final el acceso de quien entró. Todo sale de la base (RLS): cada quien
// cuenta solo lo que puede ver.
export async function vistaInicio(contenedor, perfil) {
  const turno = turnoActual();
  const operador = esOperador(perfil);
  const gestiona = gestionaTickets(perfil);
  // El interruptor abre el tablero que ve el observador (Progreso), con todas las empresas de quien mira.
  const titulo = () => el('div', { class: 'encabezado' }, el('h1', { text: `Hola, ${perfil.nombre}` }), interruptorTablero(false));
  pintar(contenedor, titulo(), el('p', { class: 'cargando', text: 'Cargando…' }));

  let cat; let iniciativas; let ids; let consultas; let bloqueos;
  try {
    [cat, iniciativas, ids, consultas, bloqueos] = await Promise.all([
      cargarCatalogos(), listarIniciativas(), operador ? idsEnRevision() : [],
      gestiona ? contarTicketsSinResponder() : 0,
      // Si la tarjeta de bloqueos falla, Inicio se muestra igual sin ella.
      operador ? bloqueosUltimoAvance().catch(() => null) : null,
    ]);
  } catch (e) {
    if (!vigente(turno)) return;
    pintar(contenedor, titulo(), el('p', { class: 'mensaje mensaje--error', role: 'alert', text: mensajeError(e) }));
    return;
  }
  if (!vigente(turno)) return;

  const activas = iniciativas.filter((i) => i.activa);
  const pendientes = operador ? totalPendientes(ids, iniciativas) : 0;
  if (operador) conteoRevision(pendientes);
  if (gestiona) conteoConsultas(consultas);

  pintar(contenedor,
    titulo(),
    gestiona ? necesitaAtencion(activas, cat, pendientes, consultas, operador) : null,
    operador && bloqueos ? bloqueosEnAvance(bloqueos) : null,
    el('div', { class: 'inicio__columnas' },
      porEmpresa(activas, cat, operador),
      acceso(perfil, cat.empresas)),
  );
}

function necesitaAtencion(activas, cat, pendientes, consultas, operador) {
  const porId = new Map(cat.areas.map((a) => [a.id, a]));
  const sinArea = activas.filter((i) => unidadPorClasificar(i, porId)).length;
  const sinHerramienta = activas.filter((i) => !i.track_id).length;
  // Semáforo de uso de datos (Registro v3): lo que más importa vigilar son las rojas.
  const rojas = activas.filter((i) => i.estado_datos === 'rojo').length;
  const filaConsultas = { n: consultas, href: '#/consultas', tipo: 'consultas',
    texto: plural(consultas, 'consulta sin responder', 'consultas sin responder'),
    ayuda: 'Preguntas de la Consulta y pedidos de ayuda del Avance.' };
  const filas = !operador ? [filaConsultas] : [
    { n: pendientes, href: '#/revision', tipo: 'revision',
      texto: plural(pendientes, 'respuesta en revisión', 'respuestas en revisión'),
      ayuda: 'Lo que no calzó al procesar un formulario.' },
    filaConsultas,
    { n: sinArea, href: '#/registros?atencion=area', tipo: 'area',
      texto: plural(sinArea, 'iniciativa con la unidad por clasificar', 'iniciativas con la unidad por clasificar'),
      ayuda: 'Asigna la unidad de la iniciativa.' },
    { n: sinHerramienta, href: '#/registros?herramienta=sin', tipo: 'herramienta',
      texto: plural(sinHerramienta, 'iniciativa sin herramienta asignada', 'iniciativas sin herramienta asignada'),
      ayuda: 'Sin herramienta no tienen estado ni reciben el Avance.' },
    { n: rojas, href: '#/registros?datos=rojo', tipo: 'rojo',
      texto: plural(rojas, 'iniciativa en rojo por uso de datos', 'iniciativas en rojo por uso de datos'),
      ayuda: 'Se conectarán a un sistema o enviarán información fuera de su área: requieren revisión de TI.' },
  ];
  return el('section', { class: 'bloque bloque--primero', 'aria-labelledby': 'atencion-titulo' },
    el('h2', { id: 'atencion-titulo', text: 'Necesita atención' }),
    el('ul', { class: operador ? 'atencion' : 'atencion atencion--una' }, filas.map((f) => el('li', {},
      el('a', { class: `atencion__fila atencion__fila--${f.tipo}${f.n ? '' : ' atencion__fila--al-dia'}`, href: f.href },
        el('span', { class: 'atencion__numero', text: String(f.n) }),
        el('span', { class: 'atencion__titulo', text: f.texto }),
        el('span', { class: 'atencion__ayuda', text: f.n ? f.ayuda : 'Al día.' }))))));
}

// Bloqueos que marcaron las iniciativas activas en su Avance más reciente (Avance v3; admin y
// facilitador). Cada cifra abre Registros filtrado por ese bloqueo, donde se combina con empresa y área.
function bloqueosEnAvance(bloqueos) {
  const conAvance = bloqueos.size;
  const cuenta = (clave) => [...bloqueos.values()].filter((b) => b.includes(clave)).length;
  const filas = Object.entries(BLOQUEOS).filter(([clave]) => clave !== 'nada')
    .map(([clave, texto]) => ({ clave, texto, n: cuenta(clave) }));
  const nada = cuenta('nada');
  return el('section', { class: 'bloque', 'aria-labelledby': 'bloqueos-titulo' },
    el('h2', { id: 'bloqueos-titulo', text: 'Bloqueos en el último Avance' }),
    conAvance
      ? el('div', { class: 'tabla-contenedor tabla-contenedor--resumen' },
          rolesDeTabla(el('table', { class: 'tabla tabla--resumen' },
            el('caption', { class: 'solo-lectores', text: 'Iniciativas que marcaron cada bloqueo en su último Avance' }),
            el('thead', {}, el('tr', {}, ['Qué las frena', 'Iniciativas'].map((t) => el('th', { scope: 'col', text: t })))),
            el('tbody', {}, filas.map((f) => el('tr', {},
              el('th', { scope: 'row', 'data-etiqueta': 'Qué las frena', text: f.texto }),
              el('td', { class: 'numero', 'data-etiqueta': 'Iniciativas' },
                f.n ? el('a', { class: 'enlace', href: `#/registros?bloqueo=${f.clave}`, 'aria-label': `${f.n} con ${f.texto}: ver cuáles` }, String(f.n)) : '0')))))))
      : el('p', { class: 'vacio', text: 'Todavía no llega ningún Avance con la nueva pregunta de bloqueos.' }),
    conAvance
      ? el('p', { class: 'nota', text: `${conAvance} ${plural(conAvance, 'iniciativa tiene', 'iniciativas tienen')} su último Avance con esta pregunta; ${nada} ${nada === 1 ? 'dice' : 'dicen'} que nada las frena. Una iniciativa puede marcar varios bloqueos.` })
      : null);
}

// Iniciativas activas por empresa y herramienta. Una sola empresa a la vista: sin fila de total.
function porEmpresa(activas, cat, operador) {
  const columnas = [
    ...cat.tracks.map((t) => ({ texto: t.nombre, cuenta: (lista) => lista.filter((i) => i.track_id === t.id).length })),
    { texto: 'Sin herramienta', cuenta: (lista) => lista.filter((i) => !i.track_id).length },
  ];
  const fila = (nombre, lista, clase) => el('tr', { class: clase },
    el('th', { scope: 'row', 'data-etiqueta': 'Empresa', text: nombre }),
    el('td', { class: 'numero', 'data-etiqueta': 'Iniciativas', text: String(lista.length) }),
    columnas.map((c) => el('td', { class: 'numero', 'data-etiqueta': c.texto, text: String(c.cuenta(lista)) })));

  const filas = cat.empresas.map((e) => fila(e.nombre, activas.filter((i) => i.participante.empresa_id === e.id)));
  if (cat.empresas.length > 1) filas.push(fila('Total', activas, 'fila--total'));

  return el('section', { class: 'bloque', 'aria-labelledby': 'empresas-titulo' },
    el('h2', { id: 'empresas-titulo', text: 'Iniciativas por empresa' }),
    activas.length
      ? el('div', { class: 'tabla-contenedor tabla-contenedor--resumen' },
          rolesDeTabla(el('table', { class: 'tabla tabla--resumen' },
            el('caption', { class: 'solo-lectores', text: 'Iniciativas activas por empresa y herramienta' }),
            el('thead', {}, el('tr', {},
              ['Empresa', 'Iniciativas', ...columnas.map((c) => c.texto)].map((t) => el('th', { scope: 'col', text: t })))),
            el('tbody', {}, filas))))
      : el('p', { class: 'vacio', text: 'Todavía no hay iniciativas registradas.' }),
    operador
      ? null
      : el('p', { class: 'nota', text: '"En revisión" quiere decir que el Admin está revisando un dato del registro: no tienes que hacer nada.' }),
  );
}

function acceso(perfil, empresas) {
  return el('section', { class: 'bloque', 'aria-labelledby': 'acceso-titulo' },
    el('h2', { id: 'acceso-titulo', text: 'Tu acceso' }),
    el('div', { class: 'tarjeta tarjeta--acceso' },
      el('dl', { class: 'datos' },
        el('dt', { text: 'Rol' }), el('dd', { text: ROLES[perfil.rol] || perfil.rol }),
        el('dt', { text: 'Correo' }), el('dd', { text: perfil.correo || '—' }),
        el('dt', { text: 'Empresas' }),
        el('dd', { text: empresas.length ? empresas.map((e) => e.nombre).join(', ') : 'Todavía no tienes empresas asignadas.' })),
      el('p', { class: 'texto-secundario', text: QUE_PUEDE[perfil.rol] || '' })));
}
