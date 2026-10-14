import {
  el, pintar, repintar, enfocar, insignia, formatoFecha, mensajeError, avisar, campo, selector,
  conBoton, errorCampo, errorEn, conteoConsultas, turnoActual, vigente,
} from '../ui.js?v=202610132104';
import {
  cargarCatalogos, listarTickets, nombresEquipo, guardarBorradorTicket, responderTicket,
  deshacerEnvioTicket, cerrarTicketSinResponder, soltarConsulta, reabrirConsulta,
} from '../datos.js?v=202610132104';

let pestana = 'sin-responder';
// Filtros de la bandeja: se conservan mientras dura la sesión en esta pestaña.
const filtros = { empresa: '', urgencia: '' };
const ESPERA_MINUTOS = 15;
// Una consulta queda a cargo de quien guarda primero; se libera sola tras estas horas sin cambios.
const HORAS_A_CARGO = 24;
// Urgencias que van primero, en este orden ("Me tiene bloqueado(a)" desde la Consulta v3, 12 oct).
const URGENTES = ['Me tiene bloqueado(a)', 'Antes de la próxima sesión'];
const prioridad = (urgencia) => { const i = URGENTES.indexOf(urgencia); return i < 0 ? URGENTES.length : i; };
// Temas que no dicen de qué se trata: el título usa el inicio de lo que escribió.
const TEMAS_GENERICOS = ['Mi iniciativa', 'Otro'];

export function olvidarFiltrosConsultas() {
  Object.assign(filtros, { empresa: '', urgencia: '' });
}

// Consultas (admin, facilitador y soporte): las del formulario de Consulta y los Avances que
// respondieron "¿Necesitas ayuda de Pragmaz?" = Sí. Se responde por correo: la
// respuesta sale desde la cuenta de Open Labs ("Open Labs · Pragmaz") 15 minutos después de "Responder y
// enviar", y en ese tiempo se puede deshacer. No se cierra sin responder salvo con la opción
// explícita "Cerrar sin responder" y una nota; la base lo exige igual.
// A cargo: la primera persona que guarda (borrador, envío o cierre) se queda con la consulta; los
// demás solo la leen hasta que la suelte o pasen 24 horas sin cambios. El admin puede tomarla.
// enfocar: id de la consulta que recibe el foco al abrir (#/consultas?consulta=42).
export async function vistaConsultas(contenedor, perfil, { recarga = false, enfocar: buscado = null, foco = null } = {}) {
  const turno = turnoActual();
  const recargar = (opciones = {}) => { if (vigente(turno)) vistaConsultas(contenedor, perfil, { recarga: true, ...opciones }); };
  if (!recarga) pintar(contenedor, el('h1', { text: 'Consultas' }), el('p', { class: 'cargando', text: 'Cargando…' }));

  let cat; let tickets; let nombres;
  try {
    [cat, tickets, nombres] = await Promise.all([cargarCatalogos(), listarTickets(), nombresEquipo().catch(() => new Map())]);
  } catch (e) {
    if (!vigente(turno)) return;
    pintar(contenedor, el('h1', { text: 'Consultas' }), el('p', { class: 'mensaje mensaje--error', role: 'alert', text: mensajeError(e) }));
    return;
  }
  if (!vigente(turno)) return;

  const yo = { id: perfil.usuarioId, admin: perfil.rol === 'admin' };
  const quien = (id) => {
    if (!id) return null;
    if (id === perfil.usuarioId) return 'Tú';
    return nombres.get(id) ?? 'Otra persona del equipo';
  };

  // El conteo del menú es el total, sin filtros.
  conteoConsultas(tickets.filter((t) => t.estado !== 'Resuelto').length);
  const empresas = [...new Map(tickets.filter((t) => t.participante?.empresa?.nombre)
    .map((t) => [t.participante.empresa.nombre, t.participante.empresa.nombre])).keys()].sort();
  const urgencias = [...new Set(tickets.map((t) => t.urgencia).filter(Boolean))].sort((a, b) => prioridad(a) - prioridad(b));
  // Se llegó a una consulta concreta (por ejemplo, "Responderla" desde el detalle): si un filtro
  // puesto antes la deja fuera, se quitan los filtros para poder mostrarla.
  const idPedido = !recarga && Number(buscado);
  const pedida = idPedido ? tickets.find((t) => t.id === idPedido) : null;
  if (pedida && ((filtros.empresa && pedida.participante?.empresa?.nombre !== filtros.empresa)
      || (filtros.urgencia && pedida.urgencia !== filtros.urgencia))) {
    olvidarFiltrosConsultas();
  }
  if (filtros.empresa && !empresas.includes(filtros.empresa)) filtros.empresa = '';
  if (filtros.urgencia && !urgencias.includes(filtros.urgencia)) filtros.urgencia = '';
  const visibles = tickets.filter((t) => (!filtros.empresa || t.participante?.empresa?.nombre === filtros.empresa)
    && (!filtros.urgencia || t.urgencia === filtros.urgencia));

  // Primero las urgentes; dentro de cada grupo, la más antigua.
  const sinResponder = visibles.filter((t) => t.estado !== 'Resuelto')
    .sort((a, b) => prioridad(a.urgencia) - prioridad(b.urgencia) || a.abierto_en.localeCompare(b.abierto_en));
  const programadas = visibles.filter((t) => t.estado === 'Resuelto' && !t.cerrado_sin_respuesta && !t.enviado_en)
    .sort((a, b) => (a.enviar_desde ?? '').localeCompare(b.enviar_desde ?? ''));
  const cerradas = visibles.filter((t) => t.estado === 'Resuelto' && (t.cerrado_sin_respuesta || t.enviado_en))
    .sort((a, b) => (b.enviado_en ?? b.cerrado_en ?? '').localeCompare(a.enviado_en ?? a.cerrado_en ?? ''));

  // Con filtros puestos, una lista vacía no quiere decir "todo al día".
  const filtrando = Boolean(filtros.empresa || filtros.urgencia);
  const panel = (idPanel, lista, vacio, tarjeta, nota = null) => el('div', {
    id: `panel-${idPanel}`, role: 'tabpanel', 'aria-labelledby': `pestana-${idPanel}`,
  },
    nota,
    lista.length
      ? el('ol', { class: 'lista-tarjetas' }, lista.map((t) => el('li', {}, tarjeta(t))))
      : filtrando
        ? el('p', { class: 'vacio', text: 'No hay consultas con estos filtros.' })
        : el('p', { class: `vacio${idPanel === 'sin-responder' ? ' vacio--al-dia' : ''}`, text: vacio }));

  const pestanas = [
    { id: 'sin-responder', texto: `Sin responder (${sinResponder.length})`, lista: sinResponder,
      panel: panel('sin-responder', sinResponder, 'Todo al día: no hay consultas sin responder.',
        (t) => tarjetaSinResponder(t, cat, quien, yo, recargar)) },
    { id: 'programadas', texto: `Por enviar (${programadas.length})`, lista: programadas,
      panel: panel('programadas', programadas, 'No hay respuestas esperando su envío.',
        (t) => tarjetaProgramada(t, cat, quien, yo, recargar),
        el('p', { class: 'nota', text: `Cada respuesta sale ${ESPERA_MINUTOS} minutos después de enviarla, en el siguiente envío automático. Mientras esté aquí puedes deshacerla para corregirla.` })) },
    { id: 'cerradas', texto: `Cerradas (${cerradas.length})`, lista: cerradas,
      panel: panel('cerradas', cerradas, 'Todavía no hay consultas cerradas.', (t) => tarjetaCerrada(t, cat, quien, yo, recargar)) },
  ];
  const botones = pestanas.map((t) => el('button', {
    type: 'button', role: 'tab', id: `pestana-${t.id}`, class: 'pestana', 'aria-controls': `panel-${t.id}`,
    onclick: () => { pestana = t.id; mostrarPestana(); },
  }, t.texto));
  const lista = el('div', { class: 'pestanas', role: 'tablist', 'aria-label': 'Consultas' }, botones);
  lista.addEventListener('keydown', (e) => {
    const i = pestanas.findIndex((t) => t.id === pestana);
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1 + pestanas.length, Home: 0, End: pestanas.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    pestana = pestanas[destino % pestanas.length].id;
    mostrarPestana();
    botones[pestanas.findIndex((t) => t.id === pestana)].focus();
  });
  function mostrarPestana() {
    pestanas.forEach((t, i) => {
      const activa = t.id === pestana;
      botones[i].setAttribute('aria-selected', String(activa));
      botones[i].tabIndex = activa ? 0 : -1;
      t.panel.hidden = !activa;
    });
  }

  // Al abrir: la pestaña de la consulta pedida o "Sin responder". Al recargar, la que estaba.
  const idBuscado = Number(buscado) || null;
  if (!recarga) {
    pestana = (idBuscado && pestanas.find((t) => t.lista.some((x) => x.id === idBuscado)))?.id ?? 'sin-responder';
  }
  const partes = [
    el('h1', { text: 'Consultas' }),
    el('p', { class: 'texto-secundario', text: 'Preguntas del formulario de Consulta y pedidos de ayuda del Avance.' }),
    barraFiltros(empresas, urgencias, () => recargar()),
    lista, pestanas.map((t) => t.panel),
  ];
  if (recarga) {
    mostrarPestana();
    const volvio = repintar(contenedor, ...partes);
    if (!volvio && foco) enfocarSiguiente(foco);
    return;
  }
  pintar(contenedor, ...partes);
  mostrarPestana();
  if (idBuscado) {
    const tarjeta = document.getElementById(`tarjeta-t${idBuscado}`);
    if (tarjeta) {
      tarjeta.classList.add('tarjeta--enfocada');
      tarjeta.scrollIntoView({ block: 'start' });
      enfocar(tarjeta);
    } else {
      avisar('Esa consulta no está a la vista: puede ser de una empresa que no tienes asignada.', 'info');
    }
  }
}

// Empresa y urgencia: para atender primero lo de la próxima sesión o una empresa a la vez.
// Solo aparece si hay algo que elegir.
function barraFiltros(empresas, urgencias, alCambiar) {
  if (empresas.length < 2 && urgencias.length < 2) return null;
  const empresa = selector([{ valor: '', texto: 'Todas' }, ...empresas.map((e) => ({ valor: e, texto: e }))], filtros.empresa);
  const urgencia = selector([{ valor: '', texto: 'Todas' }, ...urgencias.map((u) => ({ valor: u, texto: u }))], filtros.urgencia);
  const leer = () => { filtros.empresa = empresa.value; filtros.urgencia = urgencia.value; alCambiar(); };
  empresa.addEventListener('change', leer);
  urgencia.addEventListener('change', leer);
  return el('form', { class: 'filtros filtros--consultas', role: 'search', 'aria-label': 'Filtrar consultas', onsubmit: (e) => e.preventDefault() },
    empresas.length > 1 ? campo('c-empresa', 'Empresa', empresa) : null,
    urgencias.length > 1 ? campo('c-urgencia', '¿Para cuándo?', urgencia) : null);
}

const tarjetasDe = (panel) => [...panel.querySelectorAll('.lista-tarjetas > li > article')];

function posicion(articulo) {
  const panel = articulo.closest('[role="tabpanel"]');
  return { panel: panel.id, indice: tarjetasDe(panel).indexOf(articulo) };
}

function enfocarSiguiente({ panel, indice }) {
  const contenedor = document.getElementById(panel);
  if (!contenedor) return;
  const tarjetas = tarjetasDe(contenedor);
  enfocar(tarjetas[indice] ?? tarjetas[tarjetas.length - 1] ?? contenedor.querySelector('.vacio'));
}

const hora = (valor) => formatoFecha(valor, { conHora: true });

// De dónde vino: "Avance · C1" o "Consulta".
function origen(t, cat) {
  if (t.origen !== 'avance') return 'Consulta';
  const punto = cat.puntos.find((p) => p.id === t.punto_guardado_id)?.codigo;
  return punto ? `Avance · ${punto}` : 'Avance';
}

// El inicio de lo que escribió, cortado en una palabra: "No sé cómo conectar la hoja…".
function resumen(texto, maximo = 70) {
  const limpio = (texto ?? '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= maximo) return limpio;
  return `${limpio.slice(0, limpio.lastIndexOf(' ', maximo) > 30 ? limpio.lastIndexOf(' ', maximo) : maximo)}…`;
}

// Cabecera: quién y de qué se trata (lo primero que hay que leer); el código lleva al registro.
// Si el tema es genérico ("Mi iniciativa"), el título usa el inicio de lo que escribió.
// Después, el origen, la urgencia, la fecha y la empresa, y la consulta tal como la escribió.
function cabecera(t, cat, idTitulo) {
  const persona = t.participante?.nombre ?? 'Persona sin nombre';
  const codigo = t.iniciativa?.codigo;
  const deQue = TEMAS_GENERICOS.includes(t.tema) && t.descripcion ? resumen(t.descripcion) : t.tema;
  // Si el título ya trae el texto completo, la cita lo repetiría.
  const repetida = deQue === (t.descripcion ?? '').replace(/\s+/g, ' ').trim();
  return [
    el('div', { class: 'tarjeta__cabecera' },
      el('h2', { id: idTitulo, class: 'tarjeta__titulo', text: `${persona} · ${deQue}` }),
      codigo ? el('a', { class: 'enlace codigo tarjeta__codigo enlace--tactil', href: `#/registros/${codigo}` }, codigo) : null),
    el('p', { class: 'tarjeta__meta' },
      insignia(origen(t, cat)),
      TEMAS_GENERICOS.includes(t.tema) ? el('span', { text: t.tema }) : null,
      URGENTES.includes(t.urgencia) ? insignia(t.urgencia, 'atencion') : el('span', { text: t.urgencia }),
      el('span', { text: formatoFecha(t.abierto_en, { conHora: true }) }),
      t.participante?.empresa?.nombre ? el('span', { text: t.participante.empresa.nombre }) : null,
      el('span', { class: 'tarjeta__correo', text: t.participante?.correo || '(sin correo)' })),
    t.iniciativa ? el('p', { class: 'texto-secundario', text: `Iniciativa: ${t.iniciativa.nombre}` })
      : el('p', { class: 'texto-secundario', text: t.es_general ? 'Consulta general.' : 'Sin iniciativa asociada.' }),
    repetida ? null : el('blockquote', { class: 'cita texto-libre', text: t.descripcion }),
    // Si alguna vez se cerró sin responder y se reabrió: por qué (una línea por vez).
    t.historial_cierre ? el('p', { class: 'nota texto-libre', text: t.historial_cierre }) : null,
  ];
}

// Quién la tiene a cargo ahora (null si nadie o si ya pasaron las 24 horas) y cuándo se libera.
function cargo(t) {
  if (!t.a_cargo_de || !t.a_cargo_desde) return null;
  const libera = new Date(new Date(t.a_cargo_desde).getTime() + HORAS_A_CARGO * 3600000);
  return libera > new Date() ? { de: t.a_cargo_de, libera } : null;
}

// "A tu cargo" o "La está respondiendo Ana", con la hora en que se libera.
function lineaCargo(t, c, quien, yo, soltar) {
  if (!c) {
    return t.estado === 'En proceso' && t.respuesta
      ? el('p', { class: 'tarjeta__meta' }, insignia('Borrador guardado'), el('span', { text: 'nadie la tiene a cargo' }))
      : null;
  }
  const mia = c.de === yo.id;
  return el('p', { class: 'tarjeta__meta' },
    mia ? insignia('A tu cargo') : insignia(`La está respondiendo ${quien(c.de)}`, 'atencion'),
    el('span', { text: `${mia ? 'Si no la completas' : 'Si no la completa'}, se libera ${hora(c.libera)}` }),
    soltar);
}

function tarjetaSinResponder(t, cat, quien, yo, recargar) {
  const id = `t${t.id}`;
  let articulo;
  const dondeEsta = () => posicion(articulo);
  const c = cargo(t);
  const deOtro = Boolean(c && c.de !== yo.id);
  // Soltar: quien la tiene, o el admin si la tiene otra persona.
  const soltar = c && (!deOtro || yo.admin) ? el('button', {
    type: 'button', id: `${id}-soltar`, class: 'boton-en-texto',
    onclick: async (e) => {
      const pregunta = deOtro
        ? `¿Soltar la consulta? ${quien(c.de)} deja de tenerla a cargo y cualquiera puede responderla. Su borrador se conserva.`
        : '¿Soltar la consulta? Queda libre para que otra persona la responda. Tu borrador se conserva.';
      if (!window.confirm(pregunta)) return;
      try {
        await conBoton(e.currentTarget, 'Soltando…', () => soltarConsulta(t.id));
        avisar('Consulta libre: cualquiera del equipo puede responderla.');
        recargar({ foco: dondeEsta() });
      } catch (err) {
        avisar(mensajeError(err), 'error');
      }
    },
  }, 'Soltar') : null;

  // La tiene otra persona: se lee, pero no se responde ni se cierra (la base tampoco lo deja).
  if (deOtro && !yo.admin) {
    articulo = el('article', { class: 'tarjeta tarjeta--revision', id: `tarjeta-${id}`, 'aria-labelledby': `${id}-titulo` },
      cabecera(t, cat, `${id}-titulo`),
      lineaCargo(t, c, quien, yo, null),
      t.respuesta ? el('dl', { class: 'datos' },
        el('dt', { text: 'Su borrador' }), el('dd', { class: 'texto-libre', text: t.respuesta })) : null);
    return articulo;
  }

  const respuesta = el('textarea', { rows: 5 });
  respuesta.value = t.respuesta ?? '';
  respuesta.defaultValue = t.respuesta ?? '';
  const enviar = el('button', { type: 'submit', id: `${id}-enviar`, class: 'boton boton--principal' }, 'Responder y enviar');
  const borrador = el('button', { type: 'button', id: `${id}-borrador`, class: 'boton boton--secundario' }, 'Guardar borrador');
  // La caja de respuesta va plegada detrás de "Responder" para recorrer la bandeja rápido;
  // si ya hay un borrador, se muestra abierta.
  const abierta = Boolean(t.respuesta);
  const formulario = el('form', { class: 'resolver__nota', novalidate: true, id: `${id}-responder`, hidden: !abierta || null },
    campo(`${id}-respuesta`, 'Respuesta', respuesta,
      `Le llega por correo desde "Open Labs · Pragmaz" ${ESPERA_MINUTOS} minutos después; mientras tanto puedes deshacerla. Si contesta ese correo, llega a openlabs@pragmaz.com.`),
    el('div', { class: 'acciones' }, enviar, borrador));
  const abrir = abierta ? null : el('button', {
    type: 'button', id: `${id}-abrir`, class: 'boton boton--principal', 'aria-controls': `${id}-responder`, 'aria-expanded': 'false',
    onclick: () => {
      formulario.hidden = false;
      abrir.remove();
      respuesta.focus();
    },
  }, 'Responder');

  const sinTexto = () => {
    if (respuesta.value.trim()) return false;
    errorCampo(respuesta, 'Escribe la respuesta. Si no hace falta responder, usa "Cerrar sin responder".');
    return true;
  };

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (sinTexto()) return;
    const sale = new Date(Date.now() + ESPERA_MINUTOS * 60000);
    const correo = t.participante?.correo ?? 'la persona';
    if (!window.confirm(`Se enviará a ${correo} desde ${formatoFecha(sale, { conHora: true })}\n\nHasta entonces puedes deshacerlo. ¿Enviar?`)) return;
    try {
      await conBoton(enviar, 'Enviando…', () => responderTicket(t.id, respuesta.value.trim()));
      avisar(`Respuesta programada (sale desde ${formatoFecha(sale, { conHora: true })}): está en "Por enviar".`);
      recargar({ foco: dondeEsta() });
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  borrador.addEventListener('click', async () => {
    errorEn(formulario, null);
    if (sinTexto()) return;
    try {
      await conBoton(borrador, 'Guardando…', () => guardarBorradorTicket(t.id, respuesta.value.trim()));
      avisar('Borrador guardado. Todavía no se envía.');
      recargar();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });

  articulo = el('article', { class: 'tarjeta tarjeta--revision', id: `tarjeta-${id}`, 'aria-labelledby': `${id}-titulo` },
    cabecera(t, cat, `${id}-titulo`),
    lineaCargo(t, c, quien, yo, soltar),
    deOtro ? el('p', { class: 'nota', text: `Eres administrador: si guardas o envías, la consulta pasa a tu cargo y reemplaza el borrador de ${quien(c.de)}.` }) : null,
    abrir ? el('div', { class: 'acciones' }, abrir) : null,
    formulario,
    cerrarSinResponder(t, id, () => recargar({ foco: dondeEsta() }), respuesta));
  return articulo;
}

// La opción explícita para no responder (ya se resolvió en una sesión, es repetida…): plegada y
// con nota obligatoria. No se envía nada.
function cerrarSinResponder(t, id, alCerrar, respuesta) {
  const nota = el('textarea', { rows: 2 });
  const boton = el('button', { type: 'submit', id: `${id}-cerrar`, class: 'boton boton--secundario' }, 'Cerrar sin responder');
  const formulario = el('form', { novalidate: true },
    campo(`${id}-nota`, 'Por qué no se responde (obligatorio)', nota,
      'Por ejemplo: se resolvió en la sesión, o es la misma consulta que otra. No se envía ningún correo.'),
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!nota.value.trim()) {
      errorCampo(nota, 'Escribe por qué se cierra sin responder.');
      return;
    }
    const aviso = respuesta.value.trim() ? ' La respuesta escrita no se envía.' : '';
    if (!window.confirm(`¿Cerrar esta consulta sin enviar respuesta?${aviso}`)) return;
    try {
      await conBoton(boton, 'Cerrando…', () => cerrarTicketSinResponder(t.id, nota.value.trim()));
      avisar('Consulta cerrada sin responder. Está en "Cerradas".');
      alCerrar();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('details', { class: 'desplegable', id: `${id}-cerrar-zona` },
    el('summary', { text: 'Cerrar sin responder' }),
    formulario);
}

function tarjetaProgramada(t, cat, quien, yo, recargar) {
  const id = `t${t.id}`;
  let articulo;
  const c = cargo(t);
  // Solo quien la envió (o el admin) la deshace.
  const puede = !c || c.de === yo.id || yo.admin;
  const boton = el('button', { type: 'button', id: `${id}-deshacer`, class: 'boton boton--secundario' }, 'Deshacer el envío');
  const zona = puede
    ? el('div', { class: 'resolver' }, el('div', { class: 'acciones' }, boton))
    : el('p', { class: 'nota', text: `Solo ${quien(c.de)} o el administrador pueden deshacer este envío.` });
  boton.addEventListener('click', async () => {
    errorEn(zona, null);
    try {
      await conBoton(boton, 'Deshaciendo…', () => deshacerEnvioTicket(t.id));
      avisar('Envío deshecho: la respuesta quedó como borrador en "Sin responder".');
      recargar({ foco: posicion(articulo) });
    } catch (err) {
      errorEn(zona, mensajeError(err));
    }
  });
  const yaPuede = t.enviar_desde && new Date(t.enviar_desde) <= new Date();
  articulo = el('article', { class: 'tarjeta tarjeta--revision', id: `tarjeta-${id}`, 'aria-labelledby': `${id}-titulo` },
    cabecera(t, cat, `${id}-titulo`),
    el('div', { class: 'mensaje mensaje--atencion' },
      el('p', { class: 'mensaje__titulo', text: yaPuede
        ? 'Sale en el siguiente envío automático (cada 10 minutos)'
        : `Se enviará a partir de ${hora(t.enviar_desde)}` }),
      el('p', { class: 'texto-libre', text: t.respuesta }),
      quien(t.respondido_por) ? el('p', { class: 'texto-secundario', text: `Respondió: ${quien(t.respondido_por)}` }) : null),
    zona);
  return articulo;
}

function tarjetaCerrada(t, cat, quien, yo, recargar) {
  const id = `t${t.id}`;
  let articulo;
  const datos = t.cerrado_sin_respuesta
    ? [el('dt', { text: 'Cerrada sin responder' }), el('dd', { text: hora(t.cerrado_en) }),
       el('dt', { text: 'Motivo' }), el('dd', { class: 'texto-libre', text: t.nota_cierre || '—' })]
    : [el('dt', { text: 'Enviada' }), el('dd', { text: hora(t.enviado_en) }),
       el('dt', { text: 'Respondió' }), el('dd', { text: quien(t.respondido_por) ?? '—' }),
       el('dt', { text: 'Respuesta' }), el('dd', { class: 'texto-libre', text: t.respuesta || '—' })];
  // Cerrada sin responder por error: solo el admin la reabre. Una enviada no.
  const reabrible = t.cerrado_sin_respuesta && !t.enviado_en;
  articulo = el('article', { class: 'tarjeta tarjeta--revision', id: `tarjeta-${id}`, 'aria-labelledby': `${id}-titulo` },
    cabecera(t, cat, `${id}-titulo`),
    el('dl', { class: 'datos' }, datos),
    reabrible && yo.admin ? reabrir(t, id, () => recargar({ foco: posicion(articulo) })) : null,
    reabrible && !yo.admin ? el('p', { class: 'nota', text: 'Si se cerró por error, el administrador puede reabrirla.' }) : null);
  return articulo;
}

// Plegada y con nota obligatoria: vuelve a "Sin responder", libre para quien la tome.
function reabrir(t, id, alReabrir) {
  const nota = el('textarea', { rows: 2 });
  const boton = el('button', { type: 'submit', id: `${id}-reabrir`, class: 'boton boton--secundario' }, 'Reabrir la consulta');
  const formulario = el('form', { novalidate: true },
    campo(`${id}-nota-reabrir`, 'Por qué se reabre (obligatorio)', nota,
      'Vuelve a "Sin responder" y cualquiera del equipo puede responderla. El motivo del cierre se conserva.'),
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!nota.value.trim()) {
      errorCampo(nota, 'Escribe por qué se reabre.');
      return;
    }
    try {
      await conBoton(boton, 'Reabriendo…', () => reabrirConsulta(t.id, nota.value.trim()));
      avisar('Consulta reabierta: está en "Sin responder".');
      alReabrir();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('details', { class: 'desplegable', id: `${id}-reabrir-zona` },
    el('summary', { text: 'Reabrir' }),
    formulario);
}
