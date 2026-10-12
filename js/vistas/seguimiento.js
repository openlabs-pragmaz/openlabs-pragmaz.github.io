import { el, formatoFecha } from '../ui.js?v=202610121404';
import { pregunta, estadoConsulta, textoBloqueos, textoTiposDatos, CAMBIO_EQUIPO } from '../etiquetas.js?v=202610121404';

// Línea de tiempo del detalle: un paso por punto de guardado del track de la iniciativa
// (Registro y luego sus sesiones). Cada Avance recibido llena su punto; al pulsar un punto
// se ve lo que respondió. No se usa porcentaje: haber enviado un Avance no dice cuánto falta.
//   entradas: bitácora sin las ignoradas, de la más nueva a la más vieja.
//   ayudas: consultas creadas por esos Avances (vacío si el rol no gestiona consultas).
//   nombres: en una iniciativa en grupo, participante_id → nombre, para decir quién envió cada Avance.
export function seccionSeguimiento(ini, cat, { entradas = [], ayudas = [], error = null, esOperador = false, nombres = null } = {}) {
  const titulo = el('h2', { id: 'seguimiento-titulo', text: 'Seguimiento' });
  const seccion = (...hijos) => el('section', { class: 'tarjeta seguimiento', 'aria-labelledby': 'seguimiento-titulo' }, ...hijos);
  if (error) {
    return seccion(titulo, el('p', { class: 'mensaje mensaje--error', role: 'alert', text: 'No se pudieron cargar los avances. Vuelve a abrir la ficha en un momento.' }));
  }

  // Registro (sin track) y, si ya tiene herramienta, los puntos de su track en orden.
  const puntos = cat.puntos.filter((p) => p.activo && (p.track_id === null || (ini.track_id && p.track_id === ini.track_id)));
  const porPunto = new Map(puntos.map((p) => [p.id, []]));
  const fuera = [];
  for (const e of entradas) (porPunto.get(e.punto_guardado_id) ?? fuera).push(e);
  const esRegistro = (p) => p.track_id === null;
  // CG ya no es sesión (12 oct): es el último día para enviar la Entrega de Gemini. Se cumple con la
  // Entrega (estado "Entrega en revisión" o "Entregada") o con un Avance del formulario anterior.
  const esHito = (p) => p.codigo === 'CG';
  const entregaRecibida = ['Entrega en revisión', 'Entregada'].includes(ini.estado?.nombre);
  const hecho = (p) => esRegistro(p) || porPunto.get(p.id).length > 0 || (esHito(p) && entregaRecibida);
  const siguiente = puntos.find((p) => !hecho(p));
  const ayudaDe = new Map(ayudas.map((t) => [t.registro_formulario_id, t]));
  const ayudaAbierta = (p) => porPunto.get(p.id).some((e) => {
    const t = ayudaDe.get(e.registro_formulario_id);
    return t && t.estado !== 'Resuelto';
  });

  const detalle = el('div', { id: 'seguimiento-detalle', class: 'linea__detalle', 'aria-live': 'polite' });
  const botones = [];
  const elegir = (p) => {
    for (const b of botones) b.setAttribute('aria-pressed', String(b.dataset.punto === String(p.id)));
    detalle.replaceChildren(detallePunto(p));
  };

  const pasos = puntos.map((p, i) => {
    const lista = porPunto.get(p.id);
    const estado = hecho(p) ? 'hecho' : p === siguiente ? 'siguiente' : 'pendiente';
    const boton = el('button', {
      type: 'button', class: 'linea__boton', 'aria-pressed': 'false', 'aria-controls': 'seguimiento-detalle', 'data-punto': p.id,
      onclick: () => elegir(p),
    },
    el('span', { class: 'linea__marca', 'aria-hidden': 'true' }),
    el('span', { class: 'linea__texto' },
      el('span', { class: 'linea__codigo', text: p.codigo }),
      el('span', { class: 'linea__nombre', text: p.nombre }),
      el('span', { class: 'linea__estado', text: textoPaso(p, lista, estado, esHito(p) && entregaRecibida) }),
      ayudaAbierta(p) ? el('span', { class: 'insignia insignia--atencion linea__ayuda', text: 'Pidió ayuda' }) : null));
    botones.push(boton);
    // El tramo hacia el siguiente punto se pinta cuando ese punto también está hecho.
    const tramo = puntos[i + 1] && hecho(puntos[i + 1]) ? ' linea__paso--tramo' : '';
    return el('li', { class: `linea__paso linea__paso--${estado}${tramo}`, 'aria-current': estado === 'siguiente' ? 'step' : null }, boton);
  });

  function detallePunto(p) {
    const lista = porPunto.get(p.id);
    const cabecera = el('h3', { class: 'linea__titulo' }, el('span', { class: 'codigo', text: p.codigo }), ` · ${p.nombre}`);
    const registro = esRegistro(p)
      ? el('p', {}, `Lo que escribió en el Registro (${formatoFecha(ini.creado_en, { conHora: true })}) está más abajo, en "Lo que escribió" y "Medida inicial".`)
      : null;
    if (!lista.length && esHito(p)) {
      return el('div', {}, cabecera, el('p', { class: entregaRecibida ? null : 'texto-secundario',
        text: entregaRecibida
          ? `Envió la Entrega (estado: ${ini.estado.nombre}).`
          : `No es una sesión: es el último día para enviar la Entrega de Gemini${p.fecha_esperada ? ` (${formatoFecha(`${p.fecha_esperada}T12:00:00`)})` : ''}.` }));
    }
    if (!lista.length) {
      return el('div', {}, cabecera, registro ?? el('p', { class: 'texto-secundario', text: 'Aún no llega el Avance de este punto.' }));
    }
    return el('div', {}, cabecera, registro,
      lista.length > 1 ? el('p', { class: 'texto-secundario', text: `Envió ${lista.length} Avances en este punto; primero el más reciente.` }) : null,
      el('ol', { class: 'linea__avances' }, lista.map((e) => el('li', {}, avance(e)))));
  }

  function avance(e) {
    const estadoPropuesto = cat.estados.find((x) => x.id === e.estado_propuesto_id)?.nombre;
    const original = e.punto_original_id ? cat.puntos.find((x) => x.id === e.punto_original_id)?.codigo : null;
    const t = ayudaDe.get(e.registro_formulario_id);
    const extras = Object.entries(e.respuestas_punto ?? {})
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
      .map(([clave, v]) => [pregunta('avance', clave), typeof v === 'object' ? JSON.stringify(v) : String(v)]);
    const equipo = e.cambio_equipo && e.cambio_equipo !== 'sin_cambio'
      ? `${CAMBIO_EQUIPO[e.cambio_equipo] ?? e.cambio_equipo}${e.cambio_equipo_detalle ? `: ${e.cambio_equipo_detalle}` : ' (no escribió quiénes)'}`
      : null;
    const pares = [
      ['¿Qué avanzó?', e.que_avanzo],
      e.bloqueos_tipo?.length ? ['¿Qué lo frena?', textoBloqueos(e.bloqueos_tipo)] : null,
      e.bloqueos ? [e.bloqueos_tipo?.length ? 'Más sobre lo que lo frena' : '¿Qué lo frena?', e.bloqueos] : null,
      ['Estado que indicó', estadoPropuesto],
      e.necesita_ayuda ? ['Pidió ayuda', ayuda(e, t)] : null,
      e.hubo_cambio ? ['Cambió algo', e.cambio_detalle || 'Sí (no escribió qué)'] : null,
      equipo ? ['Cambió el equipo', equipo] : null,
      e.cambio_datos ? ['Cambió el tipo de información', el('span', { class: 'insignia insignia--atencion', text: 'Sí: hay que revisar el uso de datos' })] : null,
      e.tipos_datos?.length ? ['¿Con qué datos trabaja?', textoTiposDatos(e.tipos_datos)] : null,
      ...extras,
    ].filter(Boolean);
    return el('article', { class: 'linea__avance' },
      el('p', { class: 'linea__fecha' }, `Avance del ${formatoFecha(e.fecha, { conHora: true })}`,
        nombres && e.participante_id ? el('span', { class: 'texto-secundario', text: ` · lo envió ${nombres.get(e.participante_id) ?? 'un integrante'}` }) : null,
        original ? el('span', { class: 'texto-secundario', text: ` · llegó como ${original} y se corrigió en la revisión` }) : null),
      el('dl', { class: 'datos' }, pares.flatMap(([etiqueta, valor]) => [
        el('dt', { text: etiqueta }),
        valor instanceof Node ? el('dd', {}, valor) : el('dd', { class: valor ? 'texto-libre' : 'texto-secundario', text: valor || '—' }),
      ])));
  }

  // Lo que pidió y, si el rol ve las consultas, en qué va y el enlace para responderla.
  function ayuda(e, t) {
    const texto = e.ayuda_detalle || '(no escribió en qué)';
    if (!t) return el('span', { class: 'texto-libre', text: texto });
    return el('span', {}, el('span', { class: 'texto-libre', text: texto }), el('br'),
      el('a', { class: 'enlace', href: `#/consultas?consulta=${t.id}` }, `Consulta ${estadoConsulta(t)}`));
  }

  // Avances que no caben en la línea: de un punto de otro track, o enviados sin herramienta asignada.
  const avisoFuera = fuera.length
    ? el('p', { class: 'mensaje mensaje--atencion' },
        ini.track_id
          ? (fuera.length === 1 ? '1 Avance llegó por un punto de otro track y espera revisión. ' : `${fuera.length} Avances llegaron por un punto de otro track y esperan revisión. `)
          : (fuera.length === 1 ? '1 Avance espera revisión hasta asignar la herramienta. ' : `${fuera.length} Avances esperan revisión hasta asignar la herramienta. `),
        esOperador ? el('a', { class: 'enlace enlace--tactil', href: `#/revision?iniciativa=${ini.codigo}` }, 'Revisar') : null)
    : null;

  // Sin herramienta no hay puntos que mostrar: solo cuándo se registró.
  if (!ini.track_id) {
    return seccion(titulo,
      el('p', {}, `Registrada el ${formatoFecha(ini.creado_en, { conHora: true })}`,
        el('br'), el('span', { class: 'texto-secundario', text: 'Sin herramienta asignada: los puntos de guardado aparecen al asignarla.' })),
      avisoFuera);
  }

  const hechos = puntos.filter(hecho).length;
  // Gemini "Entregada" sin ningún Avance de sus sesiones (G1; CG es un hito sin Avance): el estado y
  // el seguimiento no cuentan lo mismo; conviene revisar el estado o pedir el Avance.
  const sesiones = puntos.filter((p) => !esRegistro(p) && !esHito(p));
  const entregadaSinAvances = ini.track?.nombre === 'Gemini' && ini.estado?.nombre === 'Entregada'
    && sesiones.length && sesiones.every((p) => !porPunto.get(p.id).length);
  // Se abre el último punto con avance (o el Registro, si aún no hay ninguno).
  elegir([...puntos].reverse().find((p) => porPunto.get(p.id).length) ?? puntos[0]);
  return seccion(
    el('div', { class: 'seguimiento__cabecera' }, titulo,
      el('p', { class: 'seguimiento__conteo', text: `${hechos} de ${puntos.length} puntos de guardado` })),
    entregadaSinAvances
      ? el('p', { class: 'mensaje mensaje--atencion' },
          `Está "Entregada", pero no llegó ningún Avance de ${sesiones.map((p) => p.codigo).join(' ni de ')}. `
          + 'Revisa si el estado es correcto o pídele que envíe su Avance.')
      : null,
    el('ol', { class: 'linea' }, pasos),
    detalle,
    avisoFuera);
}

function textoPaso(p, lista, estado, entregaRecibida = false) {
  if (p.track_id === null) return 'Registrada';
  if (!lista.length && entregaRecibida) return 'Entrega recibida';
  if (lista.length > 1) return `${lista.length} Avances · ${formatoFecha(lista[0].fecha)}`;
  if (lista.length) return `Avance · ${formatoFecha(lista[0].fecha)}`;
  return estado === 'siguiente' ? 'Siguiente' : 'Sin avance';
}
