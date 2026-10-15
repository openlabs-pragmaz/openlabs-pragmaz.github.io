import {
  el, pintar, repintar, enfocar, insignia, formatoFecha, mensajeError, avisar, campo, selector,
  conBoton, errorCampo, errorEn, conteoRevision, turnoActual, vigente,
} from '../ui.js?v=202610151749';
import {
  cargarCatalogos, listarRevisiones, listarResueltas, iniciativasEnRevision, iniciativasDePersona,
  nombresEquipo, reintentar, resolverRevision, reabrirRevision, estadoRespuesta, actualizarIniciativa, asociarTicket,
  corregirEmpresaRegistro, corregirPuntoAvance, reemplazarConRegistro, obtenerIniciativa, agregarIntegrante,
  gruposActivosDe, quitarIntegrante, integrantesDe, descartarRegistro, crearIniciativaAparte, asociarAvance,
} from '../datos.js?v=202610151749';
import { FORMULARIOS, paresRespuesta, motivos, estadoConsulta } from '../etiquetas.js?v=202610151749';
import { formulariosEdicion, sinGuardar } from './edicion.js?v=202610151749';

let pestana = 'registro';
const LIMITE_RESUELTAS = 50;

// Respuestas en revisión (admin y facilitador), como una bandeja de entrada: cada tarjeta dice
// primero por qué está aquí; se corrige lo que haga falta y se resuelve con una nota, y el foco
// pasa a la siguiente. Nada se borra: la base guarda quién y cuándo.
// recarga: después de una acción, se vuelve a pintar sin mover la página.
// enfocar: código de iniciativa (INI-001) cuyas tarjetas se resaltan y reciben el foco al abrir.
// foco: { panel, indice } tarjeta a la que pasa el foco si el control usado ya no existe
// (la tarjeta se resolvió): la que quedó en su lugar, es decir, la siguiente.
export async function vistaRevision(contenedor, perfil, { recarga = false, enfocar: codigo = null, foco = null } = {}) {
  const turno = turnoActual();
  // Si la persona ya se fue a otra sección mientras se guardaba, no se vuelve a pintar.
  const recargar = (opciones = {}) => { if (vigente(turno)) vistaRevision(contenedor, perfil, { recarga: true, ...opciones }); };
  if (!recarga) pintar(contenedor, el('h1', { text: 'Respuestas en revisión' }), el('p', { class: 'cargando', text: 'Cargando…' }));

  let cat; let pendientes; let iniciativas; let resueltas; let nombres;
  try {
    [cat, pendientes, iniciativas, resueltas, nombres] = await Promise.all([
      cargarCatalogos(), listarRevisiones(), iniciativasEnRevision(), listarResueltas(LIMITE_RESUELTAS), nombresEquipo(),
    ]);
  } catch (e) {
    if (!vigente(turno)) return;
    pintar(contenedor, el('h1', { text: 'Respuestas en revisión' }), el('p', { class: 'mensaje mensaje--error', role: 'alert', text: mensajeError(e) }));
    return;
  }
  if (!vigente(turno)) return;

  // Iniciativas en revisión cuya respuesta de origen no está en la lista (datos sintéticos,
  // creadas por el admin o con la respuesta ya resuelta): se resuelven quitando la marca.
  const enLista = new Set(pendientes.map((r) => r.iniciativa?.id).filter(Boolean));
  const sueltas = iniciativas.filter((i) => !enLista.has(i.id));
  const total = pendientes.length + sueltas.length;
  conteoRevision(total);
  // Lo que queda después de resolver una: se dice al confirmar, para que se note el avance.
  const quedan = total - 1;

  const quien = (r) => {
    if (!r.resuelto_por) return 'Sin usuario: se resolvió al volver a procesarla o desde la base';
    if (r.resuelto_por === perfil.usuarioId) return 'Tú';
    return nombres.get(r.resuelto_por) ?? 'Otra persona del equipo';
  };

  // Pendientes separadas por formulario: un problema del Registro (datos de la
  // persona) no significa lo mismo que uno del Avance (cómo va) o de una Consulta. Las iniciativas
  // en revisión sin respuesta pendiente van con el Registro: son datos de la iniciativa.
  const deFormulario = (formulario) => pendientes.filter((r) => r.formulario === formulario);
  const VACIO = {
    registro: 'Todo al día: no hay Registros en revisión.',
    avance: 'Todo al día: no hay Avances en revisión.',
    consulta: 'Todo al día: no hay Consultas en revisión.',
  };
  const panelPendientes = (formulario, lista, extra = null) => el('div', {
    id: `panel-${formulario}`, role: 'tabpanel', 'aria-labelledby': `pestana-${formulario}`,
  },
    lista.length || extra
      ? null
      : el('p', { class: 'vacio vacio--al-dia', text: VACIO[formulario] }),
    lista.length
      ? el('ol', { class: 'lista-tarjetas' }, lista.map((r) => el('li', {}, tarjetaRespuesta(r, cat, recargar, quedan, perfil.rol === 'admin'))))
      : null,
    extra);
  const deRegistro = deFormulario('registro');
  const deAvance = deFormulario('avance');
  const deConsulta = deFormulario('consulta');
  const panelRegistro = panelPendientes('registro', deRegistro, sueltas.length
    ? el('section', { class: 'bloque', 'aria-labelledby': 'sueltas-titulo' },
        el('h2', { id: 'sueltas-titulo', text: 'Iniciativas en revisión sin respuesta pendiente' }),
        el('p', { class: 'texto-secundario', text: 'Vienen de datos cargados a mano o su respuesta ya se resolvió. Corrige en su registro y quita la marca.' }),
        el('ol', { class: 'lista-tarjetas' }, sueltas.map((i) => el('li', {}, tarjetaIniciativa(i, recargar, quedan)))))
    : null);
  const panelAvance = panelPendientes('avance', deAvance);
  const panelConsulta = panelPendientes('consulta', deConsulta, el('p', { class: 'nota', text:
    'Respuestas del formulario de Consulta de una iniciativa que no se pudieron procesar (por ejemplo, correo sin registro o código de otra persona). Las que llegan bien se vuelven tickets; las preguntas generales llegan por correo a openlabs@pragmaz.com.' }));
  const panelResueltas = el('div', { id: 'panel-resueltas', role: 'tabpanel', 'aria-labelledby': 'pestana-resueltas' },
    resueltas.length
      ? el('ol', { class: 'lista-tarjetas' }, resueltas.map((r) => el('li', {}, tarjetaResuelta(r, quien(r), perfil.rol === 'admin', recargar))))
      : el('p', { class: 'vacio', text: 'Todavía no hay respuestas resueltas.' }),
    resueltas.length === LIMITE_RESUELTAS
      ? el('p', { class: 'nota', text: `Se muestran las ${LIMITE_RESUELTAS} resueltas más recientes.` })
      : null);

  const pestanas = [
    { id: 'registro', texto: `Registro (${deRegistro.length + sueltas.length})`, panel: panelRegistro, codigos: [...deRegistro.map(codigoDe), ...sueltas.map((i) => i.codigo)] },
    { id: 'avance', texto: `Avance (${deAvance.length})`, panel: panelAvance, codigos: deAvance.map(codigoDe) },
    // Consulta, solo si hay alguna con problemas.
    ...(deConsulta.length ? [{ id: 'consulta', texto: `Consulta (${deConsulta.length})`, panel: panelConsulta, codigos: deConsulta.map(codigoDe) }] : []),
    { id: 'resueltas', texto: `Resueltas (${resueltas.length})`, panel: panelResueltas, codigos: [] },
  ];
  const botones = pestanas.map((t) => el('button', {
    type: 'button', role: 'tab', id: `pestana-${t.id}`, class: 'pestana', 'aria-controls': `panel-${t.id}`,
    onclick: () => { pestana = t.id; mostrarPestana(); },
  }, t.texto));
  const lista = el('div', { class: 'pestanas', role: 'tablist', 'aria-label': 'Respuestas' }, botones);
  // Flechas, Inicio y Fin para moverse entre pestañas (patrón de pestañas accesibles).
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

  // Al abrir: la pestaña de la iniciativa pedida (#/revision?iniciativa=INI-001) o, si no, la
  // primera con pendientes. Al recargar después de una acción, se queda en la que estaba, salvo que
  // ya no exista (la pestaña Consulta desaparece al resolver la última): entonces, la primera con
  // pendientes, para que nunca quede la pantalla sin panel.
  if (recarga && !pestanas.some((t) => t.id === pestana)) {
    pestana = (pestanas.find((t) => t.id !== 'resueltas' && t.codigos.length) ?? pestanas[0]).id;
  }
  if (!recarga) {
    const buscado = codigo ? String(codigo).toUpperCase() : null;
    const conCodigo = buscado ? pestanas.find((t) => t.codigos.includes(buscado)) : null;
    const conPendientes = pestanas.find((t) => t.id !== 'resueltas' && t.codigos.length);
    pestana = (conCodigo ?? conPendientes ?? pestanas[0]).id;
  }
  const partes = [
    el('h1', { text: 'Respuestas en revisión' }),
    el('p', { class: 'texto-secundario', text: 'Lo que no calzó al procesar un formulario queda aquí, a la vista, separado por formulario. Corrige lo que haga falta y resuélvelo con una nota.' }),
    lista, panelRegistro, panelAvance, deConsulta.length ? panelConsulta : null, panelResueltas,
  ];
  if (recarga) {
    mostrarPestana();
    const volvio = repintar(contenedor, ...partes);
    if (!volvio && foco) enfocarSiguiente(foco);
    return;
  }
  pintar(contenedor, ...partes);
  mostrarPestana();
  if (codigo) enfocarIniciativa(pestanas.find((t) => t.id === pestana).panel, codigo);
}

// Tarjetas de un panel, en orden (las respuestas y luego las iniciativas sueltas).
const tarjetasDe = (panel) => [...panel.querySelectorAll('.lista-tarjetas > li > article')];

// Posición de la tarjeta en su panel: para saber cuál queda en su lugar después de resolverla.
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

// Resalta las tarjetas de una iniciativa, lleva la página a la primera y le pasa el foco.
function enfocarIniciativa(panel, codigo) {
  const buscado = String(codigo).toUpperCase();
  if (!/^INI-\d+$/.test(buscado)) return;
  const tarjetas = [...panel.querySelectorAll('[data-iniciativa]')].filter((t) => t.dataset.iniciativa === buscado);
  if (!tarjetas.length) {
    avisar(`${buscado} ya no tiene respuestas pendientes de revisión.`, 'info');
    return;
  }
  for (const t of tarjetas) t.classList.add('tarjeta--enfocada');
  const primera = tarjetas[0];
  primera.setAttribute('tabindex', '-1');
  primera.scrollIntoView({ block: 'start' });
  primera.focus({ preventScroll: true });
  if (tarjetas.length > 1) avisar(`${buscado} tiene ${tarjetas.length} tarjetas en revisión, resaltadas.`, 'info');
}

// Código de la iniciativa a la que pertenece una respuesta (la que creó, o la de su avance o consulta).
function codigoDe(r) {
  return r.iniciativa?.codigo ?? r.bitacora?.iniciativa?.codigo ?? r.ticket?.iniciativa?.codigo
    ?? (r.codigo_iniciativa ? r.codigo_iniciativa.trim().toUpperCase() : null);
}

// "Sí" tal como llega del formulario (con o sin tilde).
const esSi = (texto) => /^s[ií]$/i.test(String(texto ?? '').trim());

const textoQuedan = (n) => (n > 0 ? `Quedan ${n}.` : 'No queda ninguna pendiente.');

// Con varios motivos, el principal es el que pide una acción antes que los demás:
// la empresa, un grupo que choca con otro, un correo sin grupo, el área, el código. Si ninguno
// calza, el primero que escribió la base.
const PRIORIDAD = [
  /empresa/i,
  /otras? iniciativas?|ya están en la iniciativa|envío repetido|ya tiene|reemplaz|tiene varias iniciativas/i,
  /no está en ningún grupo|no tiene registro/i,
  /área/i,
  /código/i,
];
function principal(lista) {
  for (const patron of PRIORIDAD) {
    const m = lista.find((x) => patron.test(x));
    if (m) return m;
  }
  return lista[0];
}

// El título de la tarjeta es el motivo principal: lo primero que hay que leer. Si hay más, el
// título dice cuántos y debajo van los demás, uno por línea (sin repetir el del título). El código
// (a la derecha) lleva al registro de la iniciativa a la que pertenece. Después, de qué formulario
// vino y quién lo envió.
function cabecera(textoMotivo, idTitulo, codigo, nivel = 'h2') {
  const lista = motivos(textoMotivo);
  const primero = principal(lista);
  const resto = lista.filter((m) => m !== primero);
  const titulo = !primero
    ? 'Sin motivo registrado'
    : resto.length ? `${primero} · y ${resto.length} ${resto.length === 1 ? 'punto' : 'puntos'} más` : primero;
  return [
    el('div', { class: 'tarjeta__cabecera' },
      el(nivel, { id: idTitulo, class: 'tarjeta__titulo', text: titulo }),
      codigo ? el('a', { class: 'enlace codigo tarjeta__codigo enlace--tactil', href: `#/registros/${codigo}` }, codigo) : null),
    resto.length ? el('ul', { class: 'tarjeta__motivos' }, resto.map((m) => el('li', { text: m }))) : null,
  ];
}

function meta(r) {
  return el('p', { class: 'tarjeta__meta' },
    insignia(FORMULARIOS[r.formulario] ?? r.formulario),
    r.estado_procesamiento === 'pendiente' ? insignia('Sin procesar', 'atencion') : null,
    el('span', { text: formatoFecha(r.enviado_en, { conHora: true }) }),
    el('span', { class: 'tarjeta__correo', text: r.correo || '(sin correo)' }));
}

function respuestasCrudas(r, id) {
  const pares = paresRespuesta(r.formulario, r.respuestas);
  return el('details', { class: 'desplegable', id: `${id}-respuesta` },
    el('summary', { text: 'Ver la respuesta tal como llegó' }),
    // Google guarda el correo de quien envía aparte de las preguntas: se muestra primero para compararlo.
    el('p', {}, 'Correo de quien envió (verificado por Google): ', el('strong', { text: r.correo || '(sin correo)' })),
    pares
      ? el('dl', { class: 'datos datos--respuesta' }, pares.flatMap(([p, v]) => [el('dt', { text: p }), el('dd', { class: 'texto-libre', text: v })]))
      : el('pre', { class: 'texto-libre', text: JSON.stringify(r.respuestas, null, 2) }));
}

function loCreado(r) {
  // Sin el código: ya está en la cabecera de la tarjeta.
  if (r.iniciativa) {
    // Excepción del admin: sus integrantes ya estaban en otra iniciativa.
    if (r.aparte_autorizado_en) {
      return el('p', {}, 'Creó la iniciativa aparte ', el('strong', { text: r.iniciativa.nombre }),
        ` (autorizada por el admin el ${formatoFecha(r.aparte_autorizado_en, { conHora: true })}: ${r.aparte_nota}).`);
    }
    return el('p', {}, 'Creó la iniciativa ', el('strong', { text: r.iniciativa.nombre }));
  }
  if (r.descartado_en) {
    return el('p', {}, el('strong', { text: 'Registro descartado' }), ': no creó ni cambió ninguna iniciativa.');
  }
  // Una iniciativa por persona: un segundo Registro no crea otra.
  // Se pidió reemplazar pero la base no lo aplicó (por ejemplo, alguien del Registro ya está en otra
  // iniciativa): la iniciativa no cambió.
  if (r.formulario === 'registro' && r.reemplaza_iniciativa_id && !r.reemplazo_aplicado_en) {
    return el('p', {}, 'Se intentó reemplazar los datos de ', el('strong', { text: r.iniciativaExistente?.nombre ?? r.codigo_iniciativa }),
      ` (${formatoFecha(r.reemplazo_en, { conHora: true })}), pero no se aplicó: la iniciativa no cambió. Mira el motivo; si no corresponde, descarta este Registro.`);
  }
  if (r.formulario === 'registro' && r.reemplaza_iniciativa_id) {
    return el('p', {}, 'Reemplazó los datos de su iniciativa ', el('strong', { text: r.iniciativaExistente?.nombre ?? r.codigo_iniciativa }),
      ` (${formatoFecha(r.reemplazo_en, { conHora: true })}). Los datos anteriores siguen en su primer Registro. Revisa y resuélvela con una nota.`);
  }
  if (r.formulario === 'registro' && r.codigo_iniciativa) {
    return el('p', {}, 'No se creó otra iniciativa: la persona ya tiene ',
      el('strong', { text: r.iniciativaExistente?.nombre ?? r.codigo_iniciativa }), ' (una por persona).');
  }
  if (r.bitacora?.iniciativa) {
    return el('p', {}, 'Se guardó en la bitácora de ', el('strong', { text: r.bitacora.iniciativa.nombre }));
  }
  if (r.ticket) {
    const t = r.ticket;
    return el('p', {}, `Creó una consulta (${t.tema}) de ${t.participante?.nombre ?? 'la persona'}: `,
      t.iniciativa ? `asociada a ${t.iniciativa.nombre}.` : t.es_general ? 'consulta general.' : 'sin iniciativa asociada.');
  }
  return el('p', { class: 'texto-secundario', text: 'No se creó nada a partir de esta respuesta.' });
}

// Empresa elegida en la revisión (corregir_empresa_registro): se dice cuál quedó, para que el
// motivo "Empresa corregida en la revisión" no se lea como algo pendiente.
function empresaCorregida(r, cat) {
  if (!r.empresa_corregida_id) return null;
  const nombre = cat.empresas.find((e) => e.id === r.empresa_corregida_id)?.nombre ?? 'la empresa elegida';
  return el('p', {}, 'Empresa asignada en la revisión: ', el('strong', { text: nombre }),
    ` el ${formatoFecha(r.empresa_corregida_en, { conHora: true })} (escribió "${r.respuestas?.empresa ?? 'nada'}").`,
    ' Para cerrarla, corrige lo que falte y resuélvela con una nota.');
}

// Pidió ayuda en el Avance: se creó una consulta, que se responde por correo desde Consultas.
// Resolver esta revisión no la responde ni la cierra.
function ayudaPedida(t) {
  const enlace = el('a', { class: 'enlace', href: `#/consultas?consulta=${t.id}` }, 'Consultas');
  if (t.estado === 'Resuelto') return el('p', {}, `Pidió ayuda de Pragmaz (${estadoConsulta(t)} en `, enlace, ').');
  return el('div', { class: 'mensaje mensaje--atencion' },
    el('p', { class: 'mensaje__titulo', text: 'Pidió ayuda de Pragmaz (sin responder)' }),
    el('p', { class: 'texto-libre', text: t.descripcion }),
    el('p', {}, 'Se responde por correo desde ', enlace, '. Resolver esta revisión no la responde.'));
}

// Cambio de equipo en un Avance: quiénes dice que se sumaron o salieron, los integrantes de hoy
// (se cargan aparte; si fallan, solo esta parte avisa) y el atajo a la ficha, donde se agregan y quitan.
function equipoCambiado(r, cambio, ini) {
  const hoy = el('div', {}, el('p', { class: 'cargando', text: 'Cargando los integrantes…' }));
  integrantesDe(ini.id).then((lista) => {
    const activos = lista.filter((g) => g.activo);
    hoy.replaceChildren(
      el('p', { class: 'mensaje__titulo', text: `Integrantes hoy (${activos.length})` }),
      el('ul', { class: 'integrantes__lista' }, activos.map((g) => el('li', { class: 'integrante' },
        el('div', { class: 'integrante__datos' },
          el('span', { class: 'integrante__nombre' }, g.nombre || g.participante?.nombre || 'Sin nombre',
            g.rol === 'coordinador' ? [' ', insignia('Coordina')] : null),
          g.participante?.correo ? el('span', { class: 'integrante__correo', text: g.participante.correo }) : null)))));
  }, (e) => {
    hoy.replaceChildren(el('p', { class: 'mensaje mensaje--error', role: 'alert', text: mensajeError(e) }));
  });
  return el('div', { class: 'mensaje mensaje--atencion' },
    el('p', { class: 'mensaje__titulo', text: `Cambio de equipo: ${cambio}` }),
    el('p', { class: 'texto-libre', text: r.respuestas?.cambio_equipo_detalle
      || 'No escribió quiénes: revisa la respuesta o pregúntale.' }),
    hoy,
    el('div', { class: 'acciones' },
      el('a', { class: 'boton boton--secundario', href: `#/registros/${ini.codigo}?seccion=integrantes` }, 'Agregar o quitar integrantes')),
    el('p', { class: 'texto-secundario', text: 'Después de aplicarlo en la ficha, vuelve y resuelve esta respuesta con una nota.' }));
}

// Punto de un Avance ya corregido en la revisión, o entrada ignorada: se dice qué quedó.
function puntoCorregido(r, cat) {
  const b = r.bitacora;
  if (!b?.punto_corregido_en) return null;
  const cuando = formatoFecha(b.punto_corregido_en, { conHora: true });
  if (b.ignorada) return el('p', {}, el('strong', { text: 'Entrada ignorada' }), ` en el seguimiento el ${cuando}. Resuélvela con una nota.`);
  const codigo = (id) => cat.puntos.find((x) => x.id === id)?.codigo ?? '?';
  return el('p', {}, 'Punto de guardado corregido a ', el('strong', { text: codigo(b.punto_guardado_id) }),
    ` el ${cuando} (eligió ${codigo(b.punto_original_id)}). Resuélvela con una nota.`);
}

// Elegir el punto correcto (solo los del track de la iniciativa) o ignorar la entrada cuando no se
// sabe cuál era. La respuesta cruda no cambia y la revisión se resuelve después con una nota.
function corregirPunto(r, id, ini, cat, recargarAqui) {
  const puntos = cat.puntos.filter((x) => x.activo && x.track_id === ini.track_id);
  const punto = selector([
    { valor: '', texto: 'Elige el punto de guardado' },
    ...puntos.map((x) => ({ valor: String(x.id), texto: `${x.codigo} — ${x.nombre}` })),
    { valor: 'ignorar', texto: 'Ignorar (no se sabe el punto de guardado)' },
  ], '');
  const boton = el('button', { type: 'submit', id: `${id}-corregir-punto`, class: 'boton boton--principal' }, 'Guardar punto');
  const formulario = el('form', { class: 'resolver__nota', novalidate: true },
    el('p', { class: 'texto-secundario', text: `${ini.codigo} es de ${ini.track?.nombre ?? 'otro track'}. Elige el punto de guardado en el que debía enviarse este Avance. Si no se sabe, "Ignorar": la entrada no cuenta en el seguimiento, pero no se borra.` }),
    campo(`${id}-punto`, 'Punto de guardado correcto', punto),
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!punto.value) {
      errorCampo(punto, 'Elige el punto de guardado o "Ignorar".');
      return;
    }
    try {
      const ignorar = punto.value === 'ignorar';
      const res = await conBoton(boton, 'Guardando…', () => corregirPuntoAvance(r.id, ignorar ? null : Number(punto.value)));
      avisar(res?.ignorada
        ? 'Entrada ignorada en el seguimiento. Resuelve la respuesta con una nota.'
        : `Punto de guardado corregido a ${res?.punto}. Resuelve la respuesta con una nota.`);
      recargarAqui();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('details', { class: 'desplegable', id: `${id}-punto-corregir` },
    el('summary', { text: 'Corregir el punto de guardado' }),
    formulario);
}

function tarjetaRespuesta(r, cat, recargar, quedan, esAdmin) {
  const id = `r${r.id}`;
  let articulo;
  const recargarAqui = () => recargar({ foco: posicion(articulo) });

  const editable = r.iniciativa ?? r.iniciativaAvance ?? r.iniciativaExistente;
  const partes = [cabecera(r.motivo_revision, `${id}-titulo`, codigoDe(r)), meta(r), loCreado(r), empresaCorregida(r, cat), puntoCorregido(r, cat)];
  // Reabierta por el admin: se muestra la resolución anterior y por qué se reabrió.
  if (r.resuelto_en) {
    partes.push(el('div', { class: 'mensaje mensaje--atencion' },
      el('p', { class: 'mensaje__titulo', text: `Reabierta (se había resuelto el ${formatoFecha(r.resuelto_en, { conHora: true })})` }),
      el('p', { class: 'texto-libre', text: r.nota_resolucion || 'Sin nota.' })));
  }
  // Avance en el que la persona dice que cambió algo: qué pidió, y el formulario de su iniciativa
  // (plegado, para no ocupar la pantalla) para aplicarlo.
  const pidioCambio = r.formulario === 'avance' && esSi(r.respuestas?.hubo_cambio);
  if (pidioCambio) {
    partes.push(el('div', { class: 'mensaje mensaje--atencion' },
      el('p', { class: 'mensaje__titulo', text: 'Pidió un cambio en su iniciativa' }),
      el('p', { class: 'texto-libre', text: r.respuestas?.cambio_detalle || 'No escribió qué cambió: revisa la respuesta o pregúntale.' }),
      el('p', { text: 'Aplícalo en "Corregir" (más abajo) y después resuelve la respuesta con una nota.' })));
  }
  // Avance v3 con cambio de equipo: lo que escribió, junto a los integrantes de hoy.
  const cambioEquipo = r.formulario === 'avance' ? (r.respuestas?.cambio_equipo ?? '').trim() : '';
  if (cambioEquipo && !/^no$/i.test(cambioEquipo) && editable) partes.push(equipoCambiado(r, cambioEquipo, editable));
  // Avance que pidió ayuda: se responde en Consultas (ahí se envía el correo), no aquí.
  if (r.formulario === 'avance' && r.ticket) partes.push(ayudaPedida(r.ticket));
  // Ya tiene iniciativa: reemplazar sus datos con este Registro o descartarlo (resolver con nota).
  if (r.formulario === 'registro' && !r.iniciativa && r.codigo_iniciativa && !r.reemplaza_iniciativa_id) {
    partes.push(reemplazarDatos(r, id, recargarAqui));
  }
  // Integrantes que ya están en otro grupo activo (una iniciativa por persona): no se cierra con
  // "Resolver". Se pueden quitar de su grupo anterior y volver a procesar, descartar el Registro o,
  // solo el admin, crearlo como iniciativa aparte.
  const reemplazoFallido = r.formulario === 'registro' && r.reemplaza_iniciativa_id && !r.reemplazo_aplicado_en;
  const choque = r.formulario === 'registro' && !r.iniciativa && !r.reemplaza_iniciativa_id
    && /otras iniciativas|ya están en la iniciativa|envío repetido|ya tiene/i.test(r.motivo_revision ?? '');
  if (choque) {
    partes.push(quitarDeGrupoAnterior(r, id, quedan, recargarAqui));
    partes.push(descartarOAparte(r, id, quedan, esAdmin, recargarAqui));
  } else if (reemplazoFallido) {
    // Reemplazo que no se aplicó: no se cierra con "Resolver" (la base lo rechaza) y volver a
    // procesarlo intentaría lo mismo. Queda descartarlo; "aparte" también reintentaría el reemplazo.
    partes.push(descartarOAparte(r, id, quedan, false, recargarAqui));
  }
  // Avance de alguien con varias iniciativas: se elige a cuál va.
  if (r.formulario === 'avance' && !r.bitacora && /tiene varias iniciativas/i.test(r.motivo_revision ?? '')) {
    partes.push(elegirIniciativaAvance(r, id, quedan, recargarAqui));
  }
  partes.push(respuestasCrudas(r, id));
  if (editable) {
    partes.push(el('details', { class: 'desplegable', id: `${id}-corregir` },
      el('summary', { text: `Corregir ${editable.codigo}` }),
      formulariosEdicion(editable, cat, { alGuardar: recargarAqui, prefijo: `${id}-ini` })));
  }
  if (r.ticket && !r.ticket.es_general && !r.ticket.iniciativa_id) {
    partes.push(asociarConsulta(r.ticket, id, recargarAqui));
  }
  // Avance que llegó por un punto de otro track: se corrige el punto o se ignora la entrada.
  if (r.bitacora && editable?.track_id
      && (/es de otro track/i.test(r.motivo_revision ?? '') || r.bitacora.punto_original_id || r.bitacora.ignorada)) {
    partes.push(corregirPunto(r, id, editable, cat, recargarAqui));
  }
  // Avance o Consulta de un correo que no está en ningún grupo: se agrega al grupo y se vuelve a procesar.
  if (['avance', 'consulta'].includes(r.formulario) && !r.bitacora && !r.ticket
      && /no está en ningún grupo|no tiene registro/i.test(r.motivo_revision ?? '')) {
    partes.push(agregarAlGrupo(r, id, quedan, recargarAqui));
  }
  // Registro que no creó nada (empresa "Otro" o vacía de alguien que aún no es participante).
  // Solo si lo que falló es la empresa: si no se creó por otra razón (integrantes en otro grupo,
  // sin correo), corregir la empresa no lo arregla y dejaría una corrección inútil guardada.
  if (r.formulario === 'registro' && !r.iniciativa && !r.codigo_iniciativa && cat.empresas.length
      && /Empresa ("Otra" o )?no reconocida|Empresa corregida/i.test(r.motivo_revision ?? '')) {
    partes.push(corregirEmpresa(r, id, cat, recargarAqui));
  }
  partes.push(resolver(r, id, quedan, () => posicion(articulo), recargar, choque || reemplazoFallido));

  articulo = el('article', {
    class: 'tarjeta tarjeta--revision', id: `tarjeta-${id}`, 'data-iniciativa': codigoDe(r), 'aria-labelledby': `${id}-titulo`,
  }, partes);
  return articulo;
}

// Una iniciativa por persona: quien ya tiene una y vuelve a registrarse. Lado a
// lado, lo que tiene y lo que trae este Registro; "Reemplazar" pasa los datos nuevos a su
// iniciativa (mismo código, seguimiento e integrantes; el estado no cambia y la herramienta solo
// se pone si faltaba; el área, si el Registro trae una de la lista). Descartar o crear aparte:
// descartarOAparte().
function reemplazarDatos(r, id, recargarAqui) {
  const actual = r.iniciativaExistente;
  const codigo = actual?.codigo ?? r.codigo_iniciativa.trim().toUpperCase();
  const nuevo = r.respuestas ?? {};
  const fila = (etiqueta, antes, despues) => [
    el('dt', { text: etiqueta }),
    el('dd', {}, el('span', { class: 'texto-secundario', text: 'Tiene: ' }), antes || '—', el('br'),
      el('span', { class: 'texto-secundario', text: 'Trae: ' }), el('strong', { class: 'texto-libre', text: despues || '—' })),
  ];
  const boton = el('button', { type: 'button', id: `${id}-reemplazar`, class: 'boton boton--secundario' }, `Reemplazar los datos de ${codigo}`);
  const zona = el('div', { class: 'mensaje mensaje--atencion' },
    el('p', { class: 'mensaje__titulo', text: `Ya tiene ${codigo}` }),
    el('dl', { class: 'datos' },
      fila('Nombre', actual?.nombre, nuevo.iniciativa_nombre),
      fila('Descripción', actual?.situacion_antes, nuevo.situacion_antes)),
    el('p', { text: `Si el grupo quiere cambiar su iniciativa, "Reemplazar" pone estos datos en ${codigo}: mismo código y mismo seguimiento; entran las personas nuevas que trae y quien lo envió pasa a coordinar. Si alguien del Registro ya está en otra iniciativa, no se aplica. El estado no cambia y la herramienta tampoco, salvo que aún no tuviera: entonces toma la de este Registro. La unidad cambia solo si este Registro trae una de la lista. Si es un envío repetido o no corresponde, descártalo más abajo y no cambia nada.` }),
    el('div', { class: 'acciones' }, boton));
  // Antes de presionar: si alguien del Registro está en otra iniciativa, el reemplazo no se aplicaría.
  // Se revisa al abrir la tarjeta (el motivo pudo calcularse antes de que esa persona se registrara).
  gruposDelRegistro(r).then((todos) => {
    const otros = todos.filter((c) => c.iniciativa.codigo !== codigo);
    if (!otros.length) return;
    boton.hidden = true;
    zona.append(el('div', { class: 'mensaje mensaje--error', role: 'alert' },
      el('p', { class: 'mensaje__titulo', text: 'Así no se puede reemplazar' }),
      el('ul', { class: 'tarjeta__motivos' }, otros.map((c) => el('li', {},
        `${c.nombre || c.correo} ya está en `, el('a', { class: 'enlace', href: `#/registros/${c.iniciativa.codigo}` }, c.iniciativa.codigo),
        ` «${c.iniciativa.nombre}»`))),
      el('p', { text: `Si esa persona también va en ${codigo}: quítala de su otra iniciativa en "Integrantes que ya están en otro grupo" (más abajo), reemplaza y, si sigue en las dos, el admin la vuelve a agregar allá con "Agregar de todos modos (excepción)". Si no va en ${codigo}, descarta este Registro.` })));
  }).catch(() => {
    zona.append(el('p', { class: 'texto-secundario', text: 'No se pudo comprobar si alguien del Registro está en otra iniciativa: si "Reemplazar" no se aplica, mira el motivo.' }));
  });
  boton.addEventListener('click', async () => {
    errorEn(zona, null);
    if (!window.confirm(`¿Reemplazar los datos de ${codigo} con este Registro?\n\nLos datos actuales siguen guardados en su primer Registro.`)) return;
    try {
      await conBoton(boton, 'Reemplazando…', () => reemplazarConRegistro(r.id));
      avisar(`Datos de ${codigo} reemplazados. Revisa y resuelve la respuesta con una nota.`);
      recargarAqui();
    } catch (err) {
      errorEn(zona, mensajeError(err));
    }
  });
  return zona;
}

// Una iniciativa activa por persona : si integrantes de este
// Registro ya están en otro grupo, la base no crea la iniciativa nueva. Si en realidad cambiaron de
// grupo, aquí se los quita del anterior (con una nota) y el Registro se vuelve a procesar. Si fue un
// error del Registro, se descarta con una nota y no cambia nada. El único integrante de una
// iniciativa no se quita: primero se desactiva esa iniciativa.
// Correos de quien envía y de los integrantes. Registro v2: un párrafo; v3: integrante_1_correo … _5.
function correosDeRegistro(r) {
  const delV3 = [1, 2, 3, 4, 5].map((i) => r.respuestas?.[`integrante_${i}_correo`] ?? '').join(' ');
  const texto = `${r.respuestas?.integrantes ?? ''} ${delV3} ${r.correo ?? ''}`.toLowerCase();
  return [...new Set(texto.match(/[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+/g) ?? [])];
}

// Grupos activos de las personas del Registro: una consulta por tarjeta, compartida por el aviso de
// "Reemplazar" y "Integrantes que ya están en otro grupo".
const gruposPorRegistro = new WeakMap();
function gruposDelRegistro(r) {
  if (!gruposPorRegistro.has(r)) gruposPorRegistro.set(r, gruposActivosDe(correosDeRegistro(r)));
  return gruposPorRegistro.get(r);
}

// Iniciativa que este Registro puede reemplazar (la tarjeta "Ya tiene …"): sus integrantes no son
// "otro grupo" y no se quitan de ella.
const codigoAReemplazar = (r) => (r.formulario === 'registro' && !r.iniciativa && r.codigo_iniciativa && !r.reemplaza_iniciativa_id
  ? r.codigo_iniciativa.trim().toUpperCase() : null);

function quitarDeGrupoAnterior(r, id, quedan, recargarAqui) {
  const titulo = () => el('p', { class: 'mensaje__titulo', text: 'Integrantes que ya están en otro grupo' });
  const zona = el('div', { class: 'mensaje mensaje--atencion' }, titulo(), el('p', { class: 'cargando', text: 'Buscando sus grupos…' }));
  const propia = codigoAReemplazar(r);
  gruposDelRegistro(r).then((todos) => {
    // Solo se ofrecen quienes están en otras iniciativas: quitar a los de la propia la dejaría sin el
    // grupo que se quiere actualizar.
    const choques = todos.filter((c) => c.iniciativa.codigo !== propia);
    if (!choques.length) {
      zona.replaceChildren(titulo(), el('p', { text: propia && todos.length
        ? `Solo están en ${propia}, la iniciativa que este Registro puede reemplazar: usa "Reemplazar los datos de ${propia}" o descártalo. Si de verdad se van de ${propia}, quítalos desde su ficha y vuelve a procesar.`
        : 'Ya ninguno está en otro grupo activo: usa "Volver a procesar".' }));
      return;
    }
    const nota = el('input', { type: 'text' });
    const boton = el('button', { type: 'submit', id: `${id}-quitar-anterior`, class: 'boton boton--secundario' },
      choques.length === 1 ? `Quitar a ${choques[0].nombre || choques[0].correo} de ${choques[0].iniciativa.codigo} y procesar` : `Quitarlos de sus grupos anteriores y procesar`);
    const unicos = choques.filter((c) => c.integrantes <= 1);
    const formulario = el('form', { novalidate: true },
      el('ul', { class: 'tarjeta__motivos' }, choques.map((c) => el('li', {},
        `${c.nombre || c.correo} (${c.correo}) está en `, el('a', { class: 'enlace', href: `#/registros/${c.iniciativa.codigo}` }, c.iniciativa.codigo),
        ` «${c.iniciativa.nombre}»`, c.integrantes <= 1 ? ' — es su único integrante' : ` — grupo de ${c.integrantes}`))),
      choques.length < todos.length
        ? el('p', { class: 'texto-secundario', text: `Quienes ya están en ${propia} no aparecen aquí: siguen en ${propia}.` })
        : null,
      unicos.length
        ? el('p', { text: `${unicos.map((c) => c.iniciativa.codigo).join(', ')} quedaría sin integrantes: si ya no sigue, desactívala primero desde su registro; si este Registro fue un error, descártalo.` })
        : el('p', { text: 'Si cambiaron de grupo, quítalos del anterior: se guarda tu nota y el Registro se vuelve a procesar. Si este Registro fue un error, descártalo y no cambia nada.' }),
      unicos.length ? null : campo(`${id}-quitar-nota`, 'Por qué se quitan de su grupo anterior', nota, 'Queda guardada en cada integrante quitado.'),
      unicos.length ? null : el('div', { class: 'acciones' }, boton));
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEn(formulario, null);
      if (!nota.value.trim()) { errorCampo(nota, 'Escribe por qué se quitan de su grupo anterior.'); return; }
      try {
        const estado = await conBoton(boton, 'Procesando…', async () => {
          for (const c of choques) await quitarIntegrante(c.iniciativa.id, c.participanteId, nota.value.trim());
          await reintentar(r.id);
          return estadoRespuesta(r.id);
        });
        avisar(estado?.estado_procesamiento === 'procesado'
          ? `Se quitaron de su grupo anterior y el Registro quedó procesado. ${textoQuedan(quedan)}`
          : `Se quitaron de su grupo anterior; el Registro sigue en revisión: ${motivos(estado?.motivo_revision).join(' · ') || 'sin motivo'}.`,
        estado?.estado_procesamiento === 'procesado' ? 'exito' : 'info');
        recargarAqui();
      } catch (err) {
        errorEn(formulario, mensajeError(err));
      }
    });
    zona.replaceChildren(titulo(), formulario);
  }).catch((e) => {
    zona.replaceChildren(titulo(), el('p', { class: 'mensaje mensaje--error', role: 'alert', text: mensajeError(e) }));
  });
  return zona;
}

// Registro con integrantes en otra iniciativa que no es un cambio de grupo: se descarta con una nota
// (admin o facilitador) o, si el grupo de verdad tiene otra idea, el admin lo crea como iniciativa
// aparte (excepción; máximo 5 por persona). Las dos piden una nota, que queda guardada.
function descartarOAparte(r, id, quedan, esAdmin, recargarAqui) {
  const formularioNota = ({ sufijo, etiqueta, ayuda, textoBoton, clase, confirmar, accion }) => {
    const nota = el('textarea', { rows: 2, required: true });
    const boton = el('button', { type: 'submit', id: `${id}-${sufijo}`, class: `boton ${clase}` }, textoBoton);
    const formulario = el('form', { class: 'resolver__nota', novalidate: true },
      ayuda, campo(`${id}-${sufijo}-nota`, etiqueta, nota, 'Queda guardada con tu nombre y la fecha.'),
      el('div', { class: 'acciones' }, boton));
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEn(formulario, null);
      if (!nota.value.trim()) { errorCampo(nota, 'Escribe la nota: es obligatoria.'); return; }
      if (!window.confirm(confirmar)) return;
      try {
        await conBoton(boton, 'Guardando…', () => accion(nota.value.trim()));
        recargarAqui();
      } catch (err) {
        errorEn(formulario, mensajeError(err));
      }
    });
    return formulario;
  };

  const descartar = formularioNota({
    sufijo: 'descartar', etiqueta: 'Por qué se descarta', textoBoton: 'Descartar este Registro', clase: 'boton--secundario',
    ayuda: el('p', { class: 'texto-secundario', text: 'Para un envío repetido o un Registro que no corresponde: no crea ni cambia ninguna iniciativa. La respuesta queda guardada tal como llegó.' }),
    confirmar: '¿Descartar este Registro?\n\nNo se crea ni cambia ninguna iniciativa.',
    accion: async (nota) => {
      await descartarRegistro(r.id, nota);
      avisar(`Registro descartado. ${textoQuedan(quedan)}`);
    },
  });
  const aparte = esAdmin
    ? formularioNota({
        sufijo: 'aparte', etiqueta: 'Por qué se autoriza', textoBoton: 'Crear como iniciativa aparte', clase: 'boton--secundario',
        ayuda: el('p', { class: 'texto-secundario', text: 'Excepción: crea una iniciativa nueva con este Registro y sus integrantes quedan también en la que ya tienen (máximo 5 por persona). Sus Avances ya no se asocian solos: llegarán a Revisión para elegir a cuál van.' }),
        confirmar: '¿Crear una iniciativa aparte con este Registro?\n\nSus integrantes quedarán en más de una iniciativa.',
        accion: async (nota) => {
          const res = await crearIniciativaAparte(r.id, nota);
          avisar(res?.codigo
            ? `Se creó ${res.codigo}. ${res.estado === 'procesado' ? textoQuedan(quedan) : 'Revisa lo que falta y resuélvelo con una nota.'}`
            : `No se creó la iniciativa: ${motivos(res?.motivo).join(' · ') || 'revisa el motivo'}.`, res?.codigo ? 'exito' : 'info');
        },
      })
    : el('p', { class: 'texto-secundario', text: 'Si el grupo de verdad tiene otra idea, solo el admin puede crearla como iniciativa aparte.' });

  return el('div', { class: 'tarjeta tarjeta--plana' },
    el('h3', { text: 'Cerrar este Registro' }),
    el('p', { class: 'texto-secundario', text: 'Sus integrantes ya están en otra iniciativa: no se cierra con "Resolver". Elige qué pasa con él.' }),
    el('details', { class: 'desplegable', id: `${id}-descartar-zona` }, el('summary', { text: 'Descartar este Registro' }), descartar),
    esAdmin
      ? el('details', { class: 'desplegable', id: `${id}-aparte-zona` }, el('summary', { text: 'Crear como iniciativa aparte (excepción)' }), aparte)
      : aparte);
}

// Avance de alguien que está en varias iniciativas (excepción del admin): no se adivina. Se elige
// entre las suyas, en el orden que dejó la base (primero las de nombre más parecido al que escribió).
function elegirIniciativaAvance(r, id, quedan, recargarAqui) {
  const suyas = [...(r.motivo_revision ?? '').matchAll(/(INI-\d+) «([^»]*)»/g)].map((m) => ({ codigo: m[1], nombre: m[2] }));
  const eleccion = selector([
    { valor: '', texto: 'Elige la iniciativa' },
    ...suyas.map((x, i) => ({ valor: x.codigo, texto: `${x.codigo} — ${x.nombre}${i === 0 ? ' (nombre más parecido)' : ''}` })),
  ], '');
  const boton = el('button', { type: 'submit', id: `${id}-asociar-avance`, class: 'boton boton--principal' }, 'Asociar a esta iniciativa');
  const formulario = el('form', { class: 'resolver__nota', novalidate: true },
    el('p', { class: 'texto-secundario' }, 'Escribió como nombre: ', el('strong', { text: r.respuestas?.nombre_iniciativa || 'nada' }),
      '. Compáralo con lo que avanzó (en "Ver la respuesta tal como llegó") y elige su iniciativa.'),
    campo(`${id}-avance-iniciativa`, 'Iniciativa de este Avance', eleccion),
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!eleccion.value) { errorCampo(eleccion, 'Elige la iniciativa a la que va este Avance.'); return; }
    try {
      const res = await conBoton(boton, 'Asociando…', async () => {
        const ini = await obtenerIniciativa(eleccion.value);
        if (!ini) throw Object.assign(new Error(`No hay una iniciativa ${eleccion.value} a tu alcance.`), { code: 'P0001' });
        return asociarAvance(r.id, ini.id);
      });
      avisar(res?.estado === 'procesado'
        ? `Avance guardado en ${res.codigo}. ${textoQuedan(quedan)}`
        : `Avance guardado en ${res?.codigo}; sigue en revisión por otro punto.`, res?.estado === 'procesado' ? 'exito' : 'info');
      recargarAqui();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('div', { class: 'tarjeta tarjeta--plana' }, el('h3', { text: 'Elegir la iniciativa de este Avance' }), formulario);
}

// La empresa escrita no se reconoció y la persona no era participante: se elige la correcta y
// la respuesta se vuelve a procesar (crea participante e iniciativa). La respuesta cruda no cambia;
// lo creado queda en revisión para revisarlo y resolverlo con una nota.
function corregirEmpresa(r, id, cat, recargarAqui) {
  const empresa = selector([
    { valor: '', texto: 'Elige la empresa' },
    ...cat.empresas.map((e) => ({ valor: String(e.id), texto: e.nombre })),
  ], '');
  const boton = el('button', { type: 'submit', id: `${id}-corregir-empresa`, class: 'boton boton--principal' }, 'Corregir y procesar');
  const formulario = el('form', { class: 'resolver__nota', novalidate: true },
    el('p', { class: 'texto-secundario', text: 'Si la persona sí es de una empresa del programa, elígela: se crean su registro y su iniciativa con código. La respuesta original no cambia. Si no participa en el programa, no la corrijas: resuélvela con una nota.' }),
    campo(`${id}-empresa`, 'Empresa correcta', empresa),
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!empresa.value) {
      errorCampo(empresa, 'Elige la empresa de la persona.');
      return;
    }
    try {
      const res = await conBoton(boton, 'Procesando…', () => corregirEmpresaRegistro(r.id, Number(empresa.value)));
      avisar(res?.codigo
        ? `Se creó ${res.codigo}. Revisa lo creado y resuelve la respuesta con una nota.`
        : 'Se volvió a procesar, pero no se creó la iniciativa: revisa el motivo.', res?.codigo ? 'exito' : 'info');
      recargarAqui();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('details', { class: 'desplegable', id: `${id}-empresa-corregir` },
    el('summary', { text: 'Corregir la empresa y procesar' }),
    formulario);
}

// Iniciativas en grupo: la iniciativa se reconoce por el correo de quien responde.
// Si el correo no está en ningún grupo (un integrante que faltó en la lista o un correo mal escrito
// en el Registro), se agrega a la iniciativa que corresponde y la respuesta se vuelve a procesar.
// Las iniciativas de nombre parecido son solo una sugerencia: la elige quien revisa.
function agregarAlGrupo(r, id, quedan, recargarAqui) {
  const parecidas = [...(r.motivo_revision ?? '').matchAll(/(INI-\d+) «([^»]*)»/g)].map((m) => ({ codigo: m[1], nombre: m[2] }));
  const escrito = String(r.respuestas?.codigo ?? '').toUpperCase().match(/INI-\d+/)?.[0] ?? '';
  const codigo = el('input', { type: 'text', value: escrito || parecidas[0]?.codigo || '', autocomplete: 'off', spellcheck: 'false' });
  const nombre = el('input', { type: 'text', autocomplete: 'off' });
  const boton = el('button', { type: 'submit', id: `${id}-agregar-grupo`, class: 'boton boton--principal' }, 'Agregar al grupo y procesar');
  const atajos = parecidas.length
    ? el('p', { class: 'campo__ayuda' }, 'Parecidas por el nombre que escribió: ', parecidas.map((x, i) => [i ? ', ' : '',
        el('button', { type: 'button', class: 'boton-en-texto', onclick: () => { codigo.value = x.codigo; codigo.focus(); } }, `${x.codigo} «${x.nombre}»`)]))
    : null;
  const formulario = el('form', { class: 'resolver__nota', novalidate: true },
    el('p', { class: 'texto-secundario', text: `Si ${r.correo || 'esta persona'} es parte de un grupo, escribe el código de su iniciativa: se agrega como integrante y la respuesta se vuelve a procesar. Si no participa, resuélvela con una nota.` }),
    el('div', { class: 'rejilla' },
      campo(`${id}-grupo-codigo`, 'Código de la iniciativa', codigo, 'Por ejemplo, INI-012.'),
      campo(`${id}-grupo-nombre`, 'Nombre de la persona', nombre, 'Obligatorio si todavía no está registrada.')),
    atajos,
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    const buscado = codigo.value.trim().toUpperCase();
    if (!/^INI-\d+$/.test(buscado)) { errorCampo(codigo, 'Escribe el código, por ejemplo INI-012.'); return; }
    try {
      const estado = await conBoton(boton, 'Procesando…', async () => {
        const ini = await obtenerIniciativa(buscado);
        if (!ini) throw Object.assign(new Error(`No hay una iniciativa ${buscado} a tu alcance.`), { code: 'P0001' });
        if (!window.confirm(`¿Agregar ${r.correo} al grupo de ${ini.codigo} «${ini.nombre}» y volver a procesar esta respuesta?`)) {
          throw Object.assign(new Error('No se agregó: cancelaste la confirmación.'), { code: 'P0001' });
        }
        await agregarIntegrante(ini.id, r.correo, nombre.value.trim());
        await reintentar(r.id);
        return estadoRespuesta(r.id);
      });
      avisar(estado?.estado_procesamiento === 'procesado'
        ? `Agregado al grupo y procesada. ${textoQuedan(quedan)}`
        : `Agregado al grupo; la respuesta sigue en revisión: ${motivos(estado?.motivo_revision).join(' · ') || 'sin motivo'}.`,
      estado?.estado_procesamiento === 'procesado' ? 'exito' : 'info');
      recargarAqui();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('details', { class: 'desplegable', id: `${id}-grupo`, open: true },
    el('summary', { text: 'Agregar al grupo de una iniciativa' }),
    formulario);
}

// Resolver va plegado: un botón abre la nota en su lugar. Así cada tarjeta muestra primero el
// motivo y lo que llegó, y la cola se recorre rápido.
// choque: Registro con integrantes en otra iniciativa; no se resuelve (la base tampoco lo deja):
// se cierra con Reemplazar, Descartar o Crear aparte. Solo queda "Volver a procesar".
function resolver(r, id, quedan, dondeEsta, recargar, choque = false) {
  const abrir = el('button', {
    type: 'button', id: `${id}-abrir`, class: 'boton boton--principal', 'aria-expanded': 'false', 'aria-controls': `${id}-resolver`,
  }, 'Resolver…');
  const reintento = el('button', { type: 'button', id: `${id}-reintentar`, class: 'boton boton--texto' }, 'Volver a procesar');
  const inicio = el('div', { class: 'acciones' }, choque ? null : abrir, reintento);

  const nota = el('textarea', { rows: 3, required: true });
  const marcar = el('button', { type: 'submit', id: `${id}-marcar`, class: 'boton boton--principal' }, 'Marcar como resuelta');
  const cancelar = el('button', { type: 'button', class: 'boton boton--secundario' }, 'Cancelar');
  const formulario = el('form', { class: 'resolver__nota', id: `${id}-resolver`, novalidate: true, hidden: true },
    campo(`${id}-nota`, 'Nota de resolución (obligatoria)', nota, 'Qué se revisó o corrigió. Queda guardada con tu nombre y la fecha; no se puede editar después.'),
    el('div', { class: 'acciones' }, marcar, cancelar));
  const zona = el('div', { class: 'resolver' }, inicio, formulario);

  // Un cambio escrito en "Corregir" pero sin su Guardar no está en la base: se avisa y no se
  // resuelve, para no cerrar la revisión creyendo que se corrigió.
  const avisarSinGuardar = (donde) => {
    const pendientesDeGuardar = sinGuardar(zona.closest('article') ?? zona);
    if (!pendientesDeGuardar.length) return false;
    const detalles = pendientesDeGuardar[0].control.closest('details');
    if (detalles) detalles.open = true;
    errorEn(donde, `Tienes cambios sin guardar en: ${pendientesDeGuardar.map((b) => b.titulo).join(', ')}. `
      + 'Pulsa su botón Guardar (o deshaz el cambio) antes de resolver.');
    pendientesDeGuardar[0].control.focus();
    return true;
  };

  abrir.addEventListener('click', () => {
    errorEn(zona, null);
    if (avisarSinGuardar(zona)) return;
    formulario.hidden = false;
    inicio.hidden = true;
    abrir.setAttribute('aria-expanded', 'true');
    nota.focus();
  });
  cancelar.addEventListener('click', () => {
    formulario.hidden = true;
    inicio.hidden = false;
    abrir.setAttribute('aria-expanded', 'false');
    errorEn(formulario, null);
    abrir.focus();
  });

  reintento.addEventListener('click', async () => {
    errorEn(zona, null);
    // Si ya creó algo, volver a procesar no lo repite ni lo cambia: se dice así, sin llamar a la base.
    const creado = r.iniciativa?.codigo ?? r.bitacora?.iniciativa?.codigo ?? (r.ticket ? 'su consulta' : null);
    if (creado) {
      avisar(`Esta respuesta ya se procesó y creó ${creado}: volver a procesarla no cambia nada. Corrige lo que falte y resuélvela con una nota.`, 'info');
      return;
    }
    // Un Registro que ya reemplazó los datos de una iniciativa: procesarlo otra vez los volvería a
    // escribir desde la respuesta original y borraría lo corregido a mano. No se llama a la base.
    if (r.reemplaza_iniciativa_id) {
      const codigo = r.iniciativaExistente?.codigo ?? r.codigo_iniciativa ?? 'la iniciativa';
      avisar(`Este Registro ya reemplazó los datos de ${codigo}: volver a procesarlo borraría lo que corregiste. Corrige lo que falte en "Corregir" y resuélvelo con una nota.`, 'info');
      return;
    }
    try {
      const estado = await conBoton(reintento, 'Procesando…', async () => {
        await reintentar(r.id);
        return estadoRespuesta(r.id);
      });
      const lista = estado?.estado_procesamiento === 'procesado';
      avisar(lista
        ? `Se volvió a procesar y quedó lista. ${textoQuedan(quedan)}`
        : `Se volvió a procesar y sigue en revisión: ${motivos(estado?.motivo_revision).join(' · ') || 'sin motivo'}.`,
      'info');
      recargar({ foco: dondeEsta() });
    } catch (e) {
      errorEn(zona, mensajeError(e));
    }
  });

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (avisarSinGuardar(formulario)) return;
    // La base no deja resolver un Registro sin área (los demás motivos pueden quedar como llegaron);
    // aquí se avisa antes, con dónde corregirla.
    const delRegistro = r.iniciativa ?? (r.reemplaza_iniciativa_id ? r.iniciativaExistente : null);
    if (r.formulario === 'registro' && delRegistro && !delRegistro.area_id) {
      errorEn(formulario, `Asigna la unidad de la iniciativa antes de resolver: abre "Corregir ${delRegistro.codigo}" y guarda la unidad. Si no está en la lista, usa "Agregar una unidad nueva".`);
      return;
    }
    if (!nota.value.trim()) {
      errorCampo(nota, 'Escribe una nota que explique cómo se resolvió.');
      return;
    }
    try {
      await conBoton(marcar, 'Guardando…', () => resolverRevision(r.id, nota.value));
      avisar(`Respuesta resuelta. ${textoQuedan(quedan)}`);
      recargar({ foco: dondeEsta() });
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return zona;
}

// Consulta "sobre mi iniciativa" que no se pudo asociar: se elige entre las iniciativas de los grupos
// de la persona (aunque no haya llenado el Registro), las mismas que acepta la base.
function asociarConsulta(ticket, id, recargar) {
  const titulo = () => el('h3', { text: 'Asociar la consulta a una iniciativa' });
  const contenedor = el('div', { class: 'tarjeta tarjeta--plana' },
    titulo(), el('p', { class: 'cargando', text: 'Cargando sus iniciativas…' }));
  iniciativasDePersona(ticket.participante_id).then((lista) => {
    if (!lista.length) {
      contenedor.replaceChildren(titulo(),
        el('p', { class: 'texto-secundario', text: 'Esta persona no está en el grupo de ninguna iniciativa. Si debería estarlo, agrégala desde el detalle de su iniciativa (Integrantes).' }));
      return;
    }
    const eleccion = selector([
      { valor: '', texto: 'Elige una iniciativa' },
      ...lista.map((i) => ({ valor: i.id, texto: `${i.codigo} · ${i.nombre}${!i.activa ? ' (desactivada)' : i.salio ? ' (ya salió del grupo)' : ''}` })),
    ], '');
    const boton = el('button', { type: 'submit', id: `${id}-asociar`, class: 'boton boton--principal' }, 'Asociar a esta iniciativa');
    const formulario = el('form', { novalidate: true },
      el('p', { class: 'texto-secundario texto-libre', text: `"${ticket.descripcion}"` }),
      campo(`${id}-ticket`, 'Iniciativa', eleccion),
      el('div', { class: 'acciones' }, boton));
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEn(formulario, null);
      if (!eleccion.value) {
        errorCampo(eleccion, 'Elige la iniciativa a la que pertenece la consulta.');
        return;
      }
      try {
        await conBoton(boton, 'Asociando…', () => asociarTicket(ticket.id, Number(eleccion.value)));
        avisar('Consulta asociada. Si ya no falta nada, resuélvela.');
        recargar();
      } catch (err) {
        errorEn(formulario, mensajeError(err));
      }
    });
    contenedor.replaceChildren(titulo(), formulario);
  }).catch((e) => {
    contenedor.replaceChildren(titulo(), el('p', { class: 'mensaje mensaje--error', role: 'alert', text: mensajeError(e) }));
  });
  return contenedor;
}

function tarjetaIniciativa(ini, recargar, quedan) {
  const id = `i${ini.id}`;
  let articulo;
  const boton = el('button', { type: 'button', id: `${id}-quitar`, class: 'boton boton--secundario' }, 'Quitar marca de revisión');
  const acciones = el('div', { class: 'acciones' },
    el('a', { class: 'boton boton--principal', href: `#/registros/${ini.codigo}` }, 'Corregir en su registro'),
    boton);
  const zona = el('div', { class: 'resolver' }, acciones);
  boton.addEventListener('click', async () => {
    if (!window.confirm(`¿Quitar la marca de revisión de ${ini.codigo}? Esta acción no guarda nota ni autor.`)) return;
    errorEn(zona, null);
    try {
      await conBoton(boton, 'Quitando…', () => actualizarIniciativa(ini.id, { requiere_revision: false }));
      avisar(`${ini.codigo} ya no está en revisión. ${textoQuedan(quedan)}`);
      recargar({ foco: posicion(articulo) });
    } catch (e) {
      errorEn(zona, mensajeError(e));
    }
  });
  articulo = el('article', {
    class: 'tarjeta tarjeta--revision', id: `tarjeta-${id}`, 'data-iniciativa': ini.codigo, 'aria-labelledby': `${id}-titulo`,
  },
    cabecera(ini.motivo_revision, `${id}-titulo`, ini.codigo, 'h3'),
    el('p', { class: 'tarjeta__meta' },
      el('strong', { text: ini.nombre }),
      el('span', { text: ini.participante.nombre }),
      ini.activa ? null : insignia('Desactivada', 'apagada')),
    zona);
  return articulo;
}

function tarjetaResuelta(r, quien, esAdmin, recargar) {
  const id = `re${r.id}`;
  let articulo;
  articulo = el('article', { class: 'tarjeta tarjeta--revision', id: `tarjeta-${id}`, 'aria-labelledby': `${id}-titulo` },
    cabecera(r.motivo_revision, `${id}-titulo`, codigoDe(r)),
    meta(r),
    loCreado(r),
    el('dl', { class: 'datos' },
      el('dt', { text: 'Resuelta' }), el('dd', { text: formatoFecha(r.resuelto_en, { conHora: true }) }),
      el('dt', { text: 'Por' }), el('dd', { text: quien }),
      el('dt', { text: 'Nota' }), el('dd', { class: 'texto-libre', text: r.nota_resolucion || '—' })),
    respuestasCrudas(r, id),
    esAdmin ? reabrir(r, id, () => recargar({ foco: posicion(articulo) })) : reabrirSoloAdmin(id));
  return articulo;
}

// Facilitador: la opción se ve, desactivada, para que sepa que existe y a quién pedirla.
function reabrirSoloAdmin(id) {
  const ayuda = `${id}-solo-admin`;
  return el('div', { class: 'acciones acciones--nota' },
    el('button', { type: 'button', class: 'boton boton--secundario boton--no-disponible', disabled: true, 'aria-describedby': ayuda },
      'Reabrir (resuelta por error)'),
    el('p', { class: 'campo__ayuda', id: ayuda, text: 'Solo el administrador puede reabrirla. Si se resolvió por error, avísale.' }));
}

// Solo el admin: devuelve a Pendientes una respuesta resuelta por error, con nota obligatoria.
// Quién y cuándo la resolvió, y su nota, se conservan.
function reabrir(r, id, alReabrir) {
  const nota = el('textarea', { rows: 2, required: true });
  const boton = el('button', { type: 'submit', id: `${id}-reabrir`, class: 'boton boton--secundario' }, 'Reabrir');
  const formulario = el('form', { novalidate: true },
    campo(`${id}-nota`, 'Por qué se reabre (obligatorio)', nota, 'Vuelve a Pendientes. Se conservan quién la resolvió, cuándo y su nota.'),
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!nota.value.trim()) {
      errorCampo(nota, 'Escribe por qué se reabre.');
      return;
    }
    if (!window.confirm('¿Reabrir esta respuesta? Vuelve a Pendientes para revisarla otra vez.')) return;
    try {
      await conBoton(boton, 'Reabriendo…', () => reabrirRevision(r.id, nota.value));
      avisar('Respuesta reabierta: está otra vez en Pendientes.');
      alReabrir();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('details', { class: 'desplegable', id: `${id}-reabrir-zona` },
    el('summary', { text: 'Reabrir (resuelta por error)' }),
    formulario);
}
