import {
  el, pintar, repintar, insignia, formatoFecha, mensajeError, normalizar, turnoActual, vigente, conBoton, errorEn, avisar,
} from '../ui.js?v=202610121404';
import {
  cargarCatalogos, obtenerIniciativa, respuestasPendientesDe, consultasSinResponderDe, bitacoraDe, ayudasDe, seleccionarMvp,
  integrantesDe, cambiosEstadoDatos, nombresEquipo,
} from '../datos.js?v=202610121404';
import {
  FORMULARIOS, textoHerramienta, textoTipo, textoArea, textoMedida, motivos,
  MODALIDAD, FRECUENCIA, esRegistroV3, escritoPorNivel, NIVELES_V3,
} from '../etiquetas.js?v=202610121404';
import { formulariosEdicion, sinGuardar } from './edicion.js?v=202610121404';
import { seccionSeguimiento } from './seguimiento.js?v=202610121404';
import { seccionIntegrantes } from './integrantes.js?v=202610121404';
import { seccionUsoDatos } from './semaforo.js?v=202610121404';

const esOperador = (perfil) => perfil.rol === 'admin' || perfil.rol === 'facilitador';
const gestionaTickets = (perfil) => esOperador(perfil) || perfil.rol === 'soporte';

// El detalle es para ver: los formularios para corregir se abren con un botón.
// Se recuerda qué fichas están en edición, para que siga abierta al volver a pintar después de guardar.
const enEdicion = new Set();
// Control que recibe el foco después de volver a pintar ("Validar el estado" abre la edición en el estado).
let enfocarTrasPintar = null;

// Detalle de un registro: lo que llegó del formulario de Registro y, para admin y facilitador,
// los formularios para corregirlo. Arriba, el seguimiento: los Avances recibidos por punto de guardado.
// recarga: después de guardar, se vuelve a pintar sin mover el foco ni la página.
// seccion: 'integrantes' abre la ficha en esa sección, con "Agregar un integrante" desplegado.
export async function vistaRegistro(contenedor, perfil, codigo, { recarga = false, seccion: irA = null } = {}) {
  const turno = turnoActual();
  const volver = el('a', { class: 'enlace volver', href: '#/registros' }, '← Volver a Registros');
  const dibujar = recarga ? repintar : pintar;
  if (!recarga) pintar(contenedor, volver, el('h1', { text: codigo }), el('p', { class: 'cargando', text: 'Cargando…' }));

  let cat; let ini;
  try {
    [cat, ini] = await Promise.all([cargarCatalogos(), obtenerIniciativa(codigo)]);
  } catch (e) {
    if (!vigente(turno)) return;
    pintar(contenedor, volver, el('h1', { text: codigo }), el('p', { class: 'mensaje mensaje--error', role: 'alert', text: mensajeError(e) }));
    return;
  }
  if (!vigente(turno)) return;
  if (!ini) {
    // Igual si no existe o si no está a su alcance: la página no sugiere datos que el usuario no ve.
    pintar(contenedor, volver, el('h1', { text: codigo }), el('p', { text: 'No hay una iniciativa con ese código para mostrar.' }));
    return;
  }

  const p = ini.participante;
  // Si la persona ya se fue a otra sección mientras se guardaba, no se vuelve a pintar.
  const recargar = () => { if (vigente(turno)) vistaRegistro(contenedor, perfil, codigo, { recarga: true }); };

  // Avances o Consultas de esta iniciativa que esperan revisión, aunque la iniciativa misma
  // no esté marcada. Si no se pueden consultar, simplemente no se avisa.
  // El seguimiento (bitácora) lo ven todos los roles; si falla, solo esa sección avisa.
  const gestiona = gestionaTickets(perfil);
  // El semáforo de uso de datos solo lo ven admin y facilitador (Registro v3).
  const conSemaforo = esOperador(perfil) && Boolean(ini.estado_datos);
  const [pendientes, consultas, seguimiento, integrantes, cambiosColor, nombresQuien] = await Promise.all([
    esOperador(perfil) ? respuestasPendientesDe(ini).catch(() => []) : [],
    gestiona ? consultasSinResponderDe(ini.id).catch(() => []) : [],
    Promise.all([bitacoraDe(ini.id), gestiona ? ayudasDe(ini.id).catch(() => []) : []])
      .then(([entradas, ayudas]) => ({ entradas, ayudas }), (error) => ({ error })),
    integrantesDe(ini.id).catch(() => null),
    conSemaforo ? cambiosEstadoDatos(ini.id).catch(() => null) : [],
    conSemaforo ? nombresEquipo().catch(() => new Map()) : new Map(),
  ]);
  if (!vigente(turno)) return;
  // Quién envió cada Avance (en un grupo, cualquiera de los integrantes).
  const nombres = new Map((integrantes ?? []).map((g) => [g.participante_id, g.nombre || g.participante?.nombre]));
  const enGrupo = (integrantes ?? []).filter((g) => g.activo).length > 1;
  const area = textoArea(ini, cat.areas);
  // El bloque "MVP Day" va arriba solo cuando hay algo que hacer: está seleccionada o se puede
  // seleccionar. Si no, una línea discreta al final del seguimiento.
  const mvpActivo = perfil.eligeMvp && (ini.mvp_seleccionada || (ini.activa && ini.estado?.nombre === 'Entregada'));
  const abrirEnEstado = () => {
    enEdicion.add(ini.codigo);
    enfocarTrasPintar = `ed-${ini.id}-estado`;
    recargar();
  };
  const distintos = tareaAvancesDistintos(ini, cat, seguimiento.entradas ?? [], nombres, esOperador(perfil), abrirEnEstado);
  const ultimoPunto = (seguimiento.entradas ?? []).find((e) => e.estado_propuesto_id)?.punto_guardado_id;

  dibujar(contenedor,
    volver,
    el('h1', {}, el('span', { class: 'codigo', text: ini.codigo }), ` · ${ini.nombre}`),
    el('div', { class: 'insignias' },
      ini.activa ? null : insignia('Desactivada', 'apagada'),
      ini.requiere_revision ? insignia('En revisión', 'atencion') : null,
      ini.track ? insignia(ini.track.nombre) : insignia('Sin herramienta asignada', 'apagada'),
      ini.estado ? insignia(ini.estado.nombre) : null,
      ini.mvp_seleccionada ? insignia('Seleccionada para MVP Day', 'mvp') : null,
    ),
    seccionPorAtender([
      // Desactivada: ya no se valida su etapa; solo quedan las
      // respuestas y consultas que aún esperan.
      ini.activa ? distintos : null,
      // Si el último Avance está entre los distintos, esa tarea ya lo dice: no se repite.
      !ini.activa || distintos?.puntos.includes(ultimoPunto) ? null : tareaEstadoPropuesto(ini, cat, seguimiento.entradas ?? [], esOperador(perfil), abrirEnEstado),
      ini.requiere_revision
        ? {
            tipo: 'revision',
            titulo: motivos(ini.motivo_revision).length === 1 ? 'En revisión' : `En revisión: ${motivos(ini.motivo_revision).length} puntos`,
            detalle: el('ul', { class: 'por-atender__motivos' }, motivos(ini.motivo_revision).map((m) => el('li', { text: m }))),
            accion: esOperador(perfil) ? el('a', { class: 'enlace enlace--tactil', href: `#/revision?iniciativa=${ini.codigo}` }, 'Resolver') : null,
          }
        : null,
      !ini.requiere_revision && pendientes.length
        ? {
            tipo: 'revision',
            titulo: pendientes.length === 1 ? '1 respuesta esperando revisión' : `${pendientes.length} respuestas esperando revisión`,
            detalle: [...new Set(pendientes.map((r) => FORMULARIOS[r.formulario] ?? r.formulario))].join(' y '),
            accion: el('a', { class: 'enlace enlace--tactil', href: `#/revision?iniciativa=${ini.codigo}` }, pendientes.length === 1 ? 'Revisarla' : 'Revisarlas'),
          }
        : null,
      consultas.length
        ? {
            tipo: 'consultas',
            titulo: consultas.length === 1 ? '1 consulta sin responder' : `${consultas.length} consultas sin responder`,
            accion: el('a', { class: 'enlace enlace--tactil', href: `#/consultas?consulta=${consultas[0].id}` }, consultas.length === 1 ? 'Responderla' : 'Responderlas'),
          }
        : null,
    ]),
    mvpActivo ? seccionMvp(ini, perfil, recargar) : null,
    seccionSeguimiento(ini, cat, { ...seguimiento, esOperador: esOperador(perfil), nombres: (integrantes ?? []).length > 1 ? nombres : null }),
    perfil.eligeMvp && !mvpActivo
      ? el('p', { class: 'texto-secundario nota-mvp' }, ini.activa
        ? `MVP Day: se podrá seleccionar cuando esté "Entregada" (hoy: ${ini.estado?.nombre ?? 'sin estado'}).`
        : 'MVP Day: está desactivada, no se puede seleccionar.')
      : null,
    el('div', { class: 'columnas' },
      seccion(enGrupo ? 'Quien llenó el Registro' : 'Persona', [
        ['Nombre', p.nombre],
        ['Correo', p.correo],
        ['Empresa', p.empresa?.nombre],
        // El Registro anterior pedía el nombre de la jefatura; el v3, su correo.
        p.jefatura_nombre ? ['Jefatura', p.jefatura_nombre] : null,
        // Con semáforo, el correo de la jefatura va en "Uso responsable", junto a la autorización.
        p.jefatura_correo && !conSemaforo ? ['Correo de la jefatura directa', p.jefatura_correo] : null,
      ]),
      seccion('Iniciativa', [
        // El área es de la iniciativa: va aquí, no con la persona. Desde el Registro v3, los tres
        // niveles tal como los eligió (listas sin cadena).
        ...(esRegistroV3(ini) ? paresOrganizacion(ini, cat.areas) : [
          ['Unidad', area],
          // Lo que escribió, solo si dice algo distinto del área asignada ("Por clasificar" ya lo incluye).
          ini.area_id && normalizar(ini.area_declarada) && normalizar(ini.area_declarada) !== normalizar(area)
            ? ['Unidad que escribió', ini.area_declarada] : null,
        ]),
        ['Herramienta', textoHerramienta(ini)],
        ['Estado', ini.estado?.nombre ?? '—'],
        ['Tipo', textoTipo(ini)],
        ini.modalidad ? ['Forma de trabajo', MODALIDAD[ini.modalidad] ?? ini.modalidad] : null,
        ['Registrada', formatoFecha(ini.creado_en, { conHora: true })],
      ]),
    ),
    conSemaforo ? seccionUsoDatos(ini, cambiosColor, nombresQuien, { recargar, entradas: seguimiento.entradas ?? [] }) : null,
    seccionIntegrantes(ini, integrantes, { operador: esOperador(perfil), recargar }),
    seccion('Lo que escribió', [
      ['Describe tu iniciativa y qué problema resuelve', ini.situacion_antes],
      // Solo lo trae la versión anterior del formulario: si está vacío, no se muestra.
      ini.problema ? ['Problema que resuelve (formulario anterior)', ini.problema] : null,
      ['¿Cómo imaginas el resultado final?', ini.resultado_esperado],
      ['¿Quién más usaría el resultado?', ini.usuario_identificado],
      ['¿Qué fuentes de datos o archivos usarías?', ini.datos_disponibles],
    ]),
    seccion('Medida inicial (tal como la escribió)', [
      ['Tipo de medida', textoMedida(ini)],
      ['Valor inicial', ini.valor_antes],
      ini.frecuencia ? ['Frecuencia de la tarea', FRECUENCIA[ini.frecuencia] ?? ini.frecuencia] : null,
    ]),
    esOperador(perfil) ? seccionEdicion(ini, cat, recargar, perfil) : null,
  );
  if (irA === 'integrantes' && !recarga) {
    const titulo = document.getElementById('integrantes-titulo');
    const agregar = document.getElementById('integrante-agregar');
    if (agregar) agregar.open = true;
    if (titulo) {
      titulo.setAttribute('tabindex', '-1');
      (titulo.closest('section') ?? titulo).scrollIntoView({ block: 'start' });
      titulo.focus({ preventScroll: true });
    }
  }
  if (enfocarTrasPintar) {
    const control = document.getElementById(enfocarTrasPintar);
    enfocarTrasPintar = null;
    if (control) {
      control.scrollIntoView({ block: 'center' });
      control.focus({ preventScroll: true });
    }
  }
}

// "Por atender": una sola tarjeta con lo que hay que hacer en esta iniciativa, una fila por tarea
// con su acción a la derecha, en vez de avisos apilados. Cada fila lleva un punto
// del color de su tipo, como en Inicio; el texto dice siempre qué pasa.
//   tareas: [{ tipo: 'estado' | 'revision' | 'consultas', titulo, detalle?, accion? }]
function seccionPorAtender(tareas) {
  const lista = tareas.filter(Boolean);
  if (!lista.length) return null;
  return el('section', { class: 'tarjeta por-atender', 'aria-labelledby': 'por-atender-titulo' },
    el('h2', { id: 'por-atender-titulo', text: lista.length === 1 ? 'Por atender' : `Por atender (${lista.length})` }),
    el('ul', { class: 'por-atender__lista' }, lista.map((t) => el('li', { class: `por-atender__fila por-atender__fila--${t.tipo}` },
      el('div', { class: 'por-atender__texto' },
        el('p', { class: 'por-atender__titulo', text: t.titulo }),
        typeof t.detalle === 'string' ? el('p', { class: 'por-atender__detalle', text: t.detalle }) : t.detalle ?? null),
      t.accion ? el('div', { class: 'por-atender__accion' }, t.accion) : null))));
}

// El participante propone un estado en cada Avance; Pragmaz lo valida. Si el último que propuso
// no es el validado, es una tarea (la principal del facilitador en el detalle).
function tareaEstadoPropuesto(ini, cat, entradas, operador, abrirEnEstado) {
  const ultima = entradas.find((e) => e.estado_propuesto_id);
  if (!ultima || !ini.track_id || ultima.estado_propuesto_id === ini.estado_id) return null;
  const propuesto = cat.estados.find((e) => e.id === ultima.estado_propuesto_id)?.nombre;
  if (!propuesto) return null;
  const punto = cat.puntos.find((x) => x.id === ultima.punto_guardado_id)?.codigo;
  let nota = '';
  if (!operador) nota = ' El estado lo valida Pragmaz.';
  else if (ini.mvp_seleccionada) nota = ' Está seleccionada para MVP Day: para cambiar el estado, primero hay que quitar la selección.';
  return {
    tipo: 'estado',
    titulo: `El último Avance propone "${propuesto}"`,
    detalle: `Lo envió en ${punto ?? 'su último punto'} (${formatoFecha(ultima.fecha)}). Estado validado: "${ini.estado?.nombre ?? 'sin estado'}".${nota}`,
    accion: operador && !ini.mvp_seleccionada
      ? el('button', { type: 'button', class: 'boton-en-texto', onclick: abrirEnEstado }, 'Validar el estado')
      : null,
  };
}

// Iniciativa en grupo: si dos integrantes declaran etapas distintas en el mismo
// punto de guardado, se guardan los dos, cuenta el más reciente y aquí se avisa para que Pragmaz
// decida cuál vale (validando el estado). Si declaran la misma etapa, no pasa nada.
// Solo cuenta lo último que indicó cada integrante en ese punto: una persona que reenvía su Avance
// con otra etapa se está corrigiendo, no es un conflicto. Y deja de ser tarea cuando el estado
// validado ya es una de las etapas indicadas (Pragmaz ya decidió).
function tareaAvancesDistintos(ini, cat, entradas, nombres, operador, abrirEnEstado) {
  const porPunto = new Map();
  for (const e of entradas) {
    if (!e.estado_propuesto_id) continue;
    if (!porPunto.has(e.punto_guardado_id)) porPunto.set(e.punto_guardado_id, new Map());
    // Las entradas llegan de la más nueva a la más vieja: la primera de cada persona es la suya.
    const deCadaUno = porPunto.get(e.punto_guardado_id);
    const quienEnvio = e.participante_id ?? 'sin-dato';
    if (!deCadaUno.has(quienEnvio)) deCadaUno.set(quienEnvio, e);
  }
  const conflictos = [...porPunto.entries()]
    .map(([punto, deCadaUno]) => [punto, [...deCadaUno.values()]])
    .filter(([, lista]) => {
      const etapas = new Set(lista.map((e) => e.estado_propuesto_id));
      return etapas.size > 1 && !etapas.has(ini.estado_id);
    });
  if (!conflictos.length) return null;
  const estado = (id) => cat.estados.find((x) => x.id === id)?.nombre ?? '?';
  const codigo = (id) => cat.puntos.find((x) => x.id === id)?.codigo ?? '?';
  const quien = (e) => nombres.get(e.participante_id) ?? 'Un integrante';
  return {
    tipo: 'estado',
    puntos: conflictos.map(([punto]) => punto),
    titulo: conflictos.length === 1 ? `Avances distintos en ${codigo(conflictos[0][0])}` : `Avances distintos en ${conflictos.length} puntos`,
    // Las entradas llegan de la más nueva a la más vieja: la primera de cada punto es la que cuenta.
    detalle: el('ul', { class: 'por-atender__motivos' }, conflictos.map(([punto, lista]) => el('li', {},
      `${codigo(punto)}: `, lista.map((e, i) => [i ? '; ' : '', `${quien(e)} indicó "${estado(e.estado_propuesto_id)}" (${formatoFecha(e.fecha)})`]),
      `. Cuenta el más reciente.`)),
      el('li', { text: `Estado validado: "${ini.estado?.nombre ?? 'sin estado'}".${operador ? '' : ' El estado lo valida Pragmaz.'}` })),
    accion: operador && !ini.mvp_seleccionada
      ? el('button', { type: 'button', class: 'boton-en-texto', onclick: abrirEnEstado }, 'Validar el estado')
      : null,
  };
}

// "Modificar datos de la iniciativa" abre los formularios de corrección; "Terminar de modificar"
// los cierra. Cada bloque se guarda con su propio botón.
function seccionEdicion(ini, cat, recargar, perfil) {
  const abierta = enEdicion.has(ini.codigo);
  const boton = el('button', {
    type: 'button', id: 'modificar-datos', class: abierta ? 'boton boton--secundario' : 'boton boton--principal',
    'aria-expanded': String(abierta), 'aria-controls': 'edicion-ficha',
  }, abierta ? 'Terminar de modificar' : 'Modificar datos de la iniciativa');
  const formularios = el('div', { id: 'edicion-ficha', hidden: !abierta || null },
    abierta ? formulariosEdicion(ini, cat, {
      alGuardar: recargar,
      // Quien puede quitar la selección tiene el bloque "MVP Day" arriba, en esta misma ficha.
      quitarMvp: perfil.eligeMvp ? () => { const b = document.getElementById('seleccion-mvp'); b?.scrollIntoView({ block: 'center' }); b?.focus({ preventScroll: true }); } : null,
    }) : null);
  boton.addEventListener('click', () => {
    const pendientes = sinGuardar(formularios);
    if (pendientes.length && !window.confirm(`Tienes cambios sin guardar en: ${pendientes.map((x) => x.titulo).join(', ')}. ¿Cerrar y descartarlos?`)) return;
    if (enEdicion.has(ini.codigo)) enEdicion.delete(ini.codigo);
    else enEdicion.add(ini.codigo);
    recargar();
  });
  return el('section', { class: 'bloque', 'aria-labelledby': 'corregir-titulo' },
    el('h2', { id: 'corregir-titulo', text: 'Corregir' }),
    abierta ? null : el('p', { class: 'texto-secundario', text: 'Esta ficha es para ver. Para corregir algún dato, ábrela en modo de edición.' }),
    el('div', { class: 'acciones' }, boton),
    formularios);
}

// Selección para el MVP Day: la ven y la cambian el admin y quien tiene el permiso. Este bloque
// solo aparece cuando está seleccionada o se puede seleccionar (activa y "Entregada"); quitarla
// siempre se puede. La base vuelve a comprobarlo.
function seccionMvp(ini, perfil, recargar) {
  const marcada = ini.mvp_seleccionada;
  // Sin punto final: la hora termina en "p. m."
  const cuando = ini.mvp_marcada_en
    ? ` el ${formatoFecha(ini.mvp_marcada_en, { conHora: true })}${ini.mvp_marcada_por === perfil.usuarioId ? ', por ti' : ''}`
    : '';
  const texto = marcada
    ? `Seleccionada para MVP Day${cuando}`
    : 'Está "Entregada": se puede seleccionar para el MVP Day.';

  const boton = el('button', {
    type: 'button', id: 'seleccion-mvp', class: marcada ? 'boton boton--secundario' : 'boton boton--principal',
  }, marcada ? 'Quitar la selección' : 'Seleccionar para MVP Day');
  const bloque = el('section', { class: 'tarjeta mvp', 'aria-labelledby': 'mvp-titulo' },
    el('h2', { id: 'mvp-titulo', text: 'MVP Day' }),
    el('p', { text: texto }),
    el('div', { class: 'acciones' }, boton));
  boton.addEventListener('click', async () => {
    if (marcada && !window.confirm(`¿Quitar ${ini.codigo} de la selección para MVP Day?`)) return;
    errorEn(bloque, null);
    try {
      await conBoton(boton, marcada ? 'Quitando…' : 'Seleccionando…', () => seleccionarMvp(ini.id, !marcada));
      avisar(marcada ? `${ini.codigo} ya no está seleccionada para MVP Day.` : `${ini.codigo} quedó seleccionada para MVP Day.`);
      recargar();
    } catch (e) {
      errorEn(bloque, mensajeError(e));
    }
  });
  return bloque;
}

// Cada nivel como lo eligió: la unidad, "Directamente en…", lo que escribió si no aparecía en la
// lista, o "No está seguro(a)" (solo Dirección). Al final, si la combinación contradice la guía de cruces.
function paresOrganizacion(ini, areas) {
  const porId = new Map(areas.map((a) => [a.id, a]));
  const escrito = escritoPorNivel(ini);
  const pares = NIVELES_V3.map((n) => {
    const unidad = porId.get(ini[n.id]);
    if (unidad) return [n.nivel, unidad.nombre];
    if (ini.org_directo_niveles?.includes(n.clave)) return [n.nivel, n.directo];
    if (ini.org_otro_niveles?.includes(n.clave)) {
      return [n.nivel, `No aparece en la lista; escribió: ${escrito[n.clave] ?? '(nada)'}`];
    }
    if (new RegExp(`${n.nivel} no reconocida`, 'i').test(ini.motivo_revision ?? '')) return [n.nivel, 'No reconocida en el catálogo (ver la revisión)'];
    return [n.nivel, n.clave === 'direccion' ? 'No está seguro(a)' : null];
  });
  if (ini.org_cruce_estado === 'revisar') {
    pares.push(['Cruce de unidades', 'La combinación no coincide con la guía de cruces del cliente: conviene revisarla.']);
  }
  return pares;
}

// Pares [etiqueta, valor]; un valor vacío se muestra como "—".
function seccion(titulo, pares) {
  return el('section', { class: 'tarjeta' },
    el('h2', { text: titulo }),
    el('dl', { class: 'datos' },
      pares.filter(Boolean).flatMap(([etiqueta, valor]) => [
        el('dt', { text: etiqueta }),
        el('dd', { class: valor ? 'texto-libre' : 'texto-secundario', text: valor || '—' }),
      ])));
}
