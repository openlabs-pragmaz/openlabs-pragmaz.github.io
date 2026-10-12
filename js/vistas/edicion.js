import { el, avisar, mensajeError, campo, selector, conBoton, soltarBoton, errorEn, errorCampo } from '../ui.js?v=202610121404';
import { actualizarIniciativa, crearEquivalencia, crearArea, olvidarCatalogos, nivelDelRegistro,
  respuestasPendientesDe, consultasSinResponderDe, corregirOrganizacion, MEDIDAS } from '../datos.js?v=202610121404';
import { opcionesArea, esRegistroV3, escritoPorNivel, NIVELES_V3 } from '../etiquetas.js?v=202610121404';

// Formularios para corregir una iniciativa (admin y facilitador). Se usan en el detalle del
// registro y en Respuestas en revisión. La base decide si cada cambio se guarda: el facilitador
// solo cambia el área de la iniciativa, y solo en sus empresas.
// alGuardar(): vuelve a cargar la vista para mostrar lo que quedó en la base.
// quitarMvp(): lleva al botón "Quitar la selección" de esta misma ficha (solo para quien puede quitarla).
export function formulariosEdicion(ini, cat, { alGuardar, prefijo = `ed-${ini.id}`, quitarMvp = null }) {
  return el('div', { class: 'edicion' },
    ini.mvp_seleccionada ? avisoMvp(ini, quitarMvp) : null,
    formularioIniciativa(ini, cat, prefijo, alGuardar),
    formularioDatos(ini, cat, prefijo, alGuardar),
    formularioArea(ini, cat, prefijo, alGuardar),
    formularioLineaBase(ini, prefijo, alGuardar),
    formularioActiva(ini, prefijo, alGuardar),
  );
}

// Bloques de corrección con algo cambiado y sin guardar (cada formulario se guarda con su botón).
// Devuelve [{ titulo, control }] con el primer campo cambiado de cada bloque. Sirve para no
// resolver una revisión creyendo que el cambio ya quedó en la base.
export function sinGuardar(contenedor) {
  const cambiado = (c) => {
    if (c.type === 'checkbox') return c.checked !== c.defaultChecked;
    if (c.tagName === 'SELECT') return [...c.options].some((o) => o.selected !== o.defaultSelected);
    return c.value !== c.defaultValue;
  };
  return [...contenedor.querySelectorAll('.edicion form')].flatMap((f) => {
    const control = [...f.querySelectorAll('input, textarea, select')].find(cambiado);
    return control ? [{ titulo: f.dataset.titulo ?? f.querySelector('h3')?.textContent ?? 'un bloque', control }] : [];
  });
}

// Guarda solo lo que cambió (accion devuelve false si no había cambios). Si no se puede
// guardar, el error queda dentro del formulario hasta el siguiente intento.
async function guardar(formulario, boton, accion, alGuardar, enCurso = 'Guardando…') {
  errorEn(formulario, null);
  try {
    const hubo = await conBoton(boton, enCurso, accion);
    if (hubo === false) {
      soltarBoton(boton);
      avisar('No hay cambios para guardar.', 'info');
      return;
    }
    avisar(typeof hubo === 'string' ? hubo : 'Guardado.', 'exito');
    alGuardar();
  } catch (e) {
    errorEn(formulario, mensajeError(e));
  }
}

// Botón con id: al volver a pintar, el foco regresa a él.
const botonGuardar = (id, texto, clase = 'boton boton--principal') => el('button', { type: 'submit', id, class: clase }, texto);

// El texto original se compara recortado (como se envía el nuevo): un espacio o salto de línea
// al final de lo que llegó del formulario no cuenta como cambio, y no se reescribe sin querer.
function cambios(original, nuevos) {
  const salida = {};
  for (const [clave, valor] of Object.entries(nuevos)) {
    const antes = typeof original[clave] === 'string' ? (original[clave].trim() || null) : (original[clave] ?? null);
    if (antes !== (valor ?? null)) salida[clave] = valor;
  }
  return salida;
}

const vacioANull = (texto) => (texto.trim() === '' ? null : texto.trim());

// Una iniciativa seleccionada para el MVP Day no cambia de estado ni de herramienta ni se
// desactiva hasta quitar la selección (la base lo rechaza; aquí se avisa antes). Un aviso al
// inicio explica qué hacer; cada campo bloqueado lleva solo esta nota corta.
const BLOQUEADO_MVP = 'Bloqueado mientras esté seleccionada para MVP Day (ver el aviso de arriba).';

function avisoMvp(ini, quitarMvp) {
  return el('div', { class: 'mensaje mensaje--mvp' },
    el('p', { class: 'mensaje__titulo', text: 'Seleccionada para MVP Day' }),
    el('p', {}, 'El estado, la herramienta y "Desactivar" quedan bloqueados mientras siga seleccionada. ',
      quitarMvp
        ? ['Si hace falta cambiarlos, primero ',
            el('button', { type: 'button', class: 'boton-en-texto', onclick: quitarMvp }, 'quita la selección'), '.']
        : 'Si hace falta cambiarlos, primero hay que quitar la selección: la quitan el administrador y quien elige el MVP Day.'));
}

// Nombre, estado y lo que escribió sobre su idea: lo que cambia cuando la persona pide un cambio
// en el Avance ("¿Cambió algo de tu iniciativa?"). El estado sale de la lista de su herramienta.
function formularioIniciativa(ini, cat, p, alGuardar) {
  const nombre = el('input', { type: 'text', value: ini.nombre ?? '', required: true });
  const estados = cat.estados.filter((e) => e.track_id === ini.track_id && (e.activo || e.id === ini.estado_id));
  const estado = selector(estados.map((e) => ({ valor: e.id, texto: e.nombre })), ini.estado_id ?? '');
  estado.disabled = ini.mvp_seleccionada;
  const resultado = el('textarea', { rows: 3 }, ini.resultado_esperado ?? '');
  const usuario = el('input', { type: 'text', value: ini.usuario_identificado ?? '' });
  const datos = el('textarea', { rows: 2 }, ini.datos_disponibles ?? '');
  const boton = botonGuardar(`${p}-guardar-iniciativa`, 'Guardar datos de la iniciativa');

  const formulario = el('form', { class: 'tarjeta tarjeta--plana', novalidate: true },
    el('h3', { text: 'Nombre, estado y propósito' }),
    el('div', { class: 'rejilla' },
      campo(`${p}-nombre`, 'Nombre de la iniciativa', nombre),
      ini.track_id && estados.length
        ? campo(`${p}-estado`, 'Estado', estado, ini.mvp_seleccionada
          ? BLOQUEADO_MVP : 'El que valida Pragmaz; el participante lo propone en cada Avance.')
        : el('p', { class: 'campo__ayuda', text: 'Sin herramienta asignada no hay estado: asígnala abajo.' }),
    ),
    campo(`${p}-resultado`, '¿Cómo imagina el resultado final?', resultado),
    el('div', { class: 'rejilla' },
      campo(`${p}-usuario`, '¿Quién más usaría el resultado?', usuario),
      campo(`${p}-datos`, '¿Qué fuentes de datos o archivos usaría?', datos),
    ),
    el('div', { class: 'acciones' }, boton),
  );
  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!nombre.value.trim()) {
      errorCampo(nombre, 'La iniciativa necesita un nombre.');
      return;
    }
    guardar(formulario, boton, async () => {
      const nuevos = cambios(ini, {
        nombre: nombre.value.trim(),
        ...(ini.track_id && estados.length ? { estado_id: estado.value ? Number(estado.value) : null } : {}),
        resultado_esperado: vacioANull(resultado.value),
        usuario_identificado: vacioANull(usuario.value),
        datos_disponibles: vacioANull(datos.value),
      });
      if (!Object.keys(nuevos).length) return false;
      await actualizarIniciativa(ini.id, nuevos);
      return true;
    }, alGuardar);
  });
  return formulario;
}

function formularioDatos(ini, cat, p, alGuardar) {
  const herramienta = selector([
    ...(ini.track_id ? [] : [{ valor: '', texto: 'Sin herramienta asignada' }]),
    ...cat.tracks.map((t) => ({ valor: t.id, texto: t.nombre })),
    // Una herramienta ya desactivada en el catálogo sigue como opción: si no, el selector
    // mostraría otra y "Guardar" la cambiaría sin que nadie lo pidiera.
    ...(ini.track_id && !cat.tracks.some((t) => t.id === ini.track_id)
      ? [{ valor: ini.track_id, texto: ini.track?.nombre ?? 'Herramienta actual' }] : []),
  ], ini.track_id ?? '');
  herramienta.disabled = ini.mvp_seleccionada;
  const tipo = selector([
    { valor: '', texto: 'Por definir' },
    ...cat.tipos.filter((t) => t.activo || t.id === ini.tipo_iniciativa_id).map((t) => ({ valor: t.id, texto: t.nombre })),
  ], ini.tipo_iniciativa_id ?? '');
  const detalle = el('input', { type: 'text', value: ini.tipo_detalle ?? '' });
  const boton = botonGuardar(`${p}-guardar-datos`, 'Guardar herramienta y tipo');

  const formulario = el('form', { class: 'tarjeta tarjeta--plana', novalidate: true },
    el('h3', { text: 'Herramienta y tipo' }),
    el('div', { class: 'rejilla' },
      campo(`${p}-track`, 'Herramienta', herramienta, ini.mvp_seleccionada ? BLOQUEADO_MVP : 'Al cambiarla, el estado se ajusta solo.'),
      campo(`${p}-tipo`, 'Tipo de iniciativa', tipo),
      campo(`${p}-detalle`, 'Detalle del tipo', detalle, 'Lo que escribió en "Otro".'),
    ),
    el('div', { class: 'acciones' }, boton),
  );
  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    guardar(formulario, boton, async () => {
      const nuevos = cambios(ini, {
        track_id: herramienta.value ? Number(herramienta.value) : null,
        tipo_iniciativa_id: tipo.value ? Number(tipo.value) : null,
        tipo_detalle: vacioANull(detalle.value),
      });
      if (!Object.keys(nuevos).length) return false;
      await actualizarIniciativa(ini.id, nuevos);
      return true;
    }, alGuardar);
  });
  return formulario;
}

const NIVELES = ['Dirección', 'Gerencia', 'Jefatura'];

// Igual que privado.normalizar_texto de la base: minúsculas, sin tildes (ñ → n), espacios simples.
const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

function formularioArea(ini, cat, p, alGuardar) {
  if (esRegistroV3(ini)) return formularioOrganizacion(ini, cat, p, alGuardar);
  const persona = ini.participante;
  const areas = cat.areas.filter((a) => a.empresa_id === persona.empresa_id && (a.activo || a.id === ini.area_id));
  const opciones = [{ valor: '', texto: 'Por clasificar' }, ...opcionesArea(areas)];
  const area = selector(opciones, ini.area_id ?? '');
  const declarada = ini.area_declarada?.trim();
  // Desde el Registro con lista (7 oct), la equivalencia solo sirve para lo escrito en "No está en
  // la lista": si lo escrito ya es el nombre de un área, la base la encuentra sola y no se ofrece.
  const nombrePadre = (a) => areas.find((x) => x.id === a.padre_id)?.nombre;
  const yaEnCatalogo = Boolean(declarada) && areas.some((a) => normalizar(a.nombre) === normalizar(declarada)
    || (a.padre_id && normalizar(`${a.nombre} (${nombrePadre(a)})`) === normalizar(declarada)));
  const ofrecerEquivalencia = Boolean(declarada) && !yaEnCatalogo && areas.length > 0;
  const equivalencia = el('input', { type: 'checkbox', id: `${p}-equiv`, checked: ofrecerEquivalencia && !ini.area_id });
  const boton = botonGuardar(`${p}-guardar-area`, 'Guardar unidad');

  const formulario = el('form', { novalidate: true },
    // El área es de la iniciativa: se toma de quien llenó el Registro y cuenta para
    // todo el grupo.
    el('h3', { text: 'Unidad de la iniciativa' }),
    el('p', { class: 'texto-secundario', text: `Se toma de quien llenó el Registro (${persona.nombre}). Escribió: "${declarada || '(nada)'}".` }),
    areas.length
      ? campo(`${p}-area`, 'Unidad asignada', area)
      : el('p', { class: 'mensaje mensaje--atencion', text: 'Esta empresa todavía no tiene unidades en el catálogo.' }),
    ofrecerEquivalencia
      ? el('div', { class: 'casilla' }, equivalencia,
          el('label', { for: `${p}-equiv`, text: `Recordar "${declarada}" como esta unidad: si otra persona lo escribe en "No está en la lista", la unidad se asigna sola` }))
      : null,
    areas.length ? el('div', { class: 'acciones' }, boton) : null,
  );
  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    guardar(formulario, boton, async () => {
      const nueva = area.value ? Number(area.value) : null;
      const cambia = nueva !== (ini.area_id ?? null);
      const guardarEquivalencia = equivalencia.checked && declarada && nueva;
      if (!cambia && !guardarEquivalencia) return false;
      if (cambia) await actualizarIniciativa(ini.id, { area_id: nueva });
      if (guardarEquivalencia) {
        try {
          await crearEquivalencia(persona.empresa_id, declarada, nueva);
        } catch (err) {
          if (err.code === '23505') {
            return cambia
              ? 'Unidad guardada. Ya había una equivalencia para ese texto: no se cambió.'
              : 'Ya había una equivalencia para ese texto: no se cambió nada.';
          }
          throw err;
        }
        return cambia ? 'Unidad y equivalencia guardadas.' : 'Equivalencia guardada.';
      }
      return true;
    }, alGuardar);
  });
  return el('div', { class: 'tarjeta tarjeta--plana area-persona' },
    formulario, formularioAreaNueva(ini, areas, declarada, p, alGuardar));
}

// Registro v3: Dirección, Gerencia y Jefatura por separado, como en el formulario (listas sin
// cadena). Cada lista ofrece solo las unidades de su nivel en la empresa. Al guardar, la base
// comprueba todo, quita "no aparece" de lo resuelto y vuelve a calcular el cruce con la guía.
// El semáforo no cambia solo: se ajusta con "Cambiar color" en "Uso responsable".
function formularioOrganizacion(ini, cat, p, alGuardar) {
  const persona = ini.participante;
  const areas = cat.areas.filter((a) => a.empresa_id === persona.empresa_id && a.nivel);
  const escrito = escritoPorNivel(ini);
  const controles = NIVELES_V3.map((n) => {
    const actual = ini[n.id] ?? (ini.org_directo_niveles?.includes(n.clave) ? 'directo' : '');
    const unidades = areas.filter((a) => a.nivel === n.nivel && (a.activo || a.id === ini[n.id]))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    const control = selector([
      { valor: '', texto: n.clave === 'direccion' ? 'Sin asignar (no está seguro)' : 'Sin asignar' },
      ...(n.directo ? [{ valor: 'directo', texto: n.directo }] : []),
      ...unidades.map((a) => ({ valor: a.id, texto: a.nombre })),
    ], actual);
    const ayuda = ini.org_otro_niveles?.includes(n.clave)
      ? `No aparecía en la lista; escribió: "${escrito[n.clave] ?? '(nada)'}".` : null;
    return { n, control, ayuda };
  });
  const boton = botonGuardar(`${p}-guardar-organizacion`, 'Guardar unidad');

  const formulario = el('form', { novalidate: true, 'data-titulo': 'Unidad de la iniciativa' },
    el('h3', { text: 'Unidad de la iniciativa' }),
    el('p', { class: 'texto-secundario', text: `Como la eligió ${persona.nombre} en el Registro. Cada nivel se elige por separado; si una unidad no está, créala abajo en "Agregar una unidad nueva".` }),
    el('div', { class: 'rejilla' },
      controles.map(({ n, control, ayuda }) => campo(`${p}-org-${n.clave}`, n.nivel, control, ayuda))),
    el('div', { class: 'acciones' }, boton),
  );
  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    const valor = (clave) => controles.find((c) => c.n.clave === clave).control.value;
    const id = (clave) => (/^\d+$/.test(valor(clave)) ? Number(valor(clave)) : null);
    const nuevos = {
      direccion: id('direccion'), gerencia: id('gerencia'), jefatura: id('jefatura'),
      directo: ['gerencia', 'jefatura'].filter((c) => valor(c) === 'directo'),
    };
    guardar(formulario, boton, async () => {
      const igual = NIVELES_V3.every((n) => (ini[n.id] ?? null) === nuevos[n.clave])
        && [...(ini.org_directo_niveles ?? [])].sort().join() === nuevos.directo.join();
      if (igual) return false;
      const res = await corregirOrganizacion(ini.id, nuevos);
      if (res?.cruce === 'revisar') return 'Unidad guardada. La combinación no coincide con la guía de cruces: revísala.';
      return 'Unidad guardada.';
    }, alGuardar);
  });
  return el('div', { class: 'tarjeta tarjeta--plana area-persona' },
    formulario, formularioAreaNueva(ini, areas.filter((a) => a.activo), null, p, alGuardar));
}

// El área que escribió la persona es válida pero no está en el catálogo (llegó por "No está en
// la lista"): se crea con su nivel y su unidad de arriba, y queda asignada a la iniciativa. La crean
// el admin y el facilitador (este, en sus empresas); editarla o desactivarla es solo del admin.
function formularioAreaNueva(ini, areas, declarada, p, alGuardar) {
  const persona = ini.participante;
  const v3 = esRegistroV3(ini);
  const pendiente = v3 ? NIVELES_V3.find((n) => ini.org_otro_niveles?.includes(n.clave)) : null;
  if (v3) declarada = pendiente ? escritoPorNivel(ini)[pendiente.clave] ?? null : null;
  const resumen = el('summary', { text: 'Agregar una unidad nueva' });
  // Si lo escrito empieza por el nivel ("Gerencia de Logística"), el nivel ya viene elegido.
  const sugerido = pendiente?.nivel ?? NIVELES.find((n) => (declarada ?? '').toLowerCase().startsWith(n.toLowerCase())) ?? '';
  const nivel = selector([{ valor: '', texto: 'Elige el nivel' }, ...NIVELES.map((n) => ({ valor: n, texto: n }))], sugerido);
  const nombre = el('input', { type: 'text', value: declarada ?? '' });
  const conNivel = areas.filter((a) => a.nivel);
  const padre = selector([], '');
  const campoPadre = campo(`${p}-area-padre`, 'Depende de', padre, 'La unidad inmediatamente arriba en el organigrama.');
  // Solo unidades de un nivel superior al elegido; una dirección no depende de ninguna.
  const pintarPadres = () => {
    const rango = NIVELES.indexOf(nivel.value);
    const posibles = opcionesArea(conNivel).filter((o) => NIVELES.indexOf(conNivel.find((a) => a.id === o.valor).nivel) < rango);
    const grupos = new Map();
    for (const o of posibles) {
      if (!grupos.has(o.grupo)) grupos.set(o.grupo, el('optgroup', { label: o.grupo }));
      grupos.get(o.grupo).append(el('option', { value: o.valor }, o.texto));
    }
    padre.replaceChildren(
      el('option', { value: '', selected: true }, posibles.length ? 'Elige la unidad de arriba' : 'No hay unidades de un nivel superior'),
      ...grupos.values());
    campoPadre.hidden = rango <= 0;
  };
  nivel.addEventListener('change', pintarPadres);
  pintarPadres();
  // Al abrirlo por primera vez, el nivel que eligió la persona en el Registro (si aún no hay uno).
  let nivelLeido = false;
  const leerNivel = async () => {
    if (v3 || nivelLeido || !detalles.open) return;
    nivelLeido = true;
    const elegido = await nivelDelRegistro(ini.registro_formulario_id).catch(() => null);
    if (elegido && NIVELES.includes(elegido) && !nivel.value) {
      nivel.value = elegido;
      pintarPadres();
    }
  };
  const boton = botonGuardar(`${p}-crear-area`, 'Crear y asignar');

  const formulario = el('form', { novalidate: true, 'data-titulo': 'Agregar una unidad nueva' },
    el('p', { class: 'texto-secundario', text: 'Para una unidad que existe pero no estaba en el catálogo. Queda creada para su empresa y asignada a esta iniciativa. Para que aparezca en el formulario de Registro, agrégala también al archivo del organigrama.' }),
    el('div', { class: 'rejilla' },
      campo(`${p}-area-nivel`, 'Nivel', nivel),
      campo(`${p}-area-nombre`, 'Nombre de la unidad', nombre)),
    campoPadre,
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!nivel.value) { errorCampo(nivel, 'Elige si es una Dirección, una Gerencia o una Jefatura.'); return; }
    if (!nombre.value.trim()) { errorCampo(nombre, 'Escribe el nombre de la unidad.'); return; }
    if (!campoPadre.hidden && !padre.value) { errorCampo(padre, 'Elige de qué unidad depende.'); return; }
    crear();
  });
  async function crear() {
    const texto = nombre.value.trim();
    let id;
    try {
      id = await conBoton(boton, 'Creando…', () => crearArea({
        empresaId: persona.empresa_id, nombre: texto, nivel: nivel.value,
        padreId: campoPadre.hidden ? null : Number(padre.value),
      }));
    } catch (err) {
      errorEn(formulario, err.code === '23505'
        ? `Ya existe una unidad con ese nombre bajo esa misma unidad de arriba: elígela en "${v3 ? nivel.value : 'Unidad asignada'}".`
        : mensajeError(err));
      return;
    }
    // El catálogo se guarda en memoria: se vuelve a leer para que la lista muestre el área nueva.
    olvidarCatalogos();
    try {
      if (v3) {
        // Se asigna en su nivel; los otros dos quedan como estaban.
        const clave = NIVELES_V3.find((n) => n.nivel === nivel.value).clave;
        const actual = (c) => (c === clave ? id : ini[`${c}_id`] ?? null);
        await corregirOrganizacion(ini.id, {
          direccion: actual('direccion'), gerencia: actual('gerencia'), jefatura: actual('jefatura'),
          directo: (ini.org_directo_niveles ?? []).filter((c) => c !== clave),
        });
      } else {
        await actualizarIniciativa(ini.id, { area_id: id });
      }
      avisar(`Unidad "${texto}" creada y asignada.`, 'exito');
    } catch (err) {
      // El área ya quedó creada: al recargar aparece en la lista y se asigna a mano.
      avisar(`La unidad "${texto}" se creó, pero no se pudo asignar (${mensajeError(err)}). Elígela en "Unidad asignada" y guarda.`, 'error');
    }
    alGuardar();
  }
  const detalles = el('details', { class: 'desplegable', id: `${p}-area-nueva` }, resumen, formulario);
  detalles.addEventListener('toggle', leerNivel);
  return detalles;
}

function formularioLineaBase(ini, p, alGuardar) {
  const medida = selector([
    { valor: '', texto: 'Sin tipo de medida' },
    ...MEDIDAS.map((m) => ({ valor: m, texto: m })),
  ], ini.medida_tipo ?? '');
  const detalle = el('input', { type: 'text', value: ini.medida_detalle ?? '' });
  const valor = el('input', { type: 'text', value: ini.valor_antes ?? '' });
  const situacion = el('textarea', { rows: 4 }, ini.situacion_antes ?? '');
  const boton = botonGuardar(`${p}-guardar-linea`, 'Guardar medida inicial');

  // "Medida inicial" en pantalla (en la base y los documentos: línea base).
  const formulario = el('form', { class: 'tarjeta tarjeta--plana', novalidate: true },
    el('h3', { text: 'Medida inicial' }),
    el('p', { class: 'texto-secundario', text: 'Se guarda tal como lo escribes: sin convertir a número ni asumir moneda o unidad.' }),
    el('div', { class: 'rejilla' },
      campo(`${p}-medida`, 'Tipo de medida', medida),
      campo(`${p}-mdet`, 'Detalle de la medida', detalle, 'Lo que escribió en "Otro".'),
      campo(`${p}-valor`, 'Valor inicial', valor, 'Con su unidad, por ejemplo: 6 horas por semana.'),
    ),
    campo(`${p}-situacion`, 'Descripción de la iniciativa (situación antes)', situacion),
    el('div', { class: 'acciones' }, boton),
  );
  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    guardar(formulario, boton, async () => {
      const nuevos = cambios(ini, {
        medida_tipo: medida.value || null,
        medida_detalle: vacioANull(detalle.value),
        valor_antes: vacioANull(valor.value),
        situacion_antes: vacioANull(situacion.value),
      });
      if (!Object.keys(nuevos).length) return false;
      await actualizarIniciativa(ini.id, nuevos);
      return true;
    }, alGuardar);
  });
  return formulario;
}

// Va aparte del resto, con su propio marco: desactivar saca la iniciativa de listas,
// indicadores y envíos. No se borra y se puede deshacer.
function formularioActiva(ini, p, alGuardar) {
  const bloqueada = ini.activa && ini.mvp_seleccionada;
  const boton = el('button', {
    type: 'button', id: `${p}-activa`,
    class: `boton ${ini.activa ? 'boton--delicado' : 'boton--secundario'}${bloqueada ? ' boton--no-disponible' : ''}`,
    disabled: bloqueada, 'aria-describedby': bloqueada ? `${p}-activa-mvp` : null,
  }, ini.activa ? 'Desactivar iniciativa' : 'Reactivar iniciativa');
  const zona = el('div', { class: ini.activa ? 'tarjeta tarjeta--plana zona-delicada' : 'tarjeta tarjeta--plana' },
    el('h3', { text: ini.activa ? 'Desactivar la iniciativa' : 'Reactivar la iniciativa' }),
    el('p', { class: 'texto-secundario', text: ini.activa
      ? 'Deja de aparecer en listas, indicadores y envíos. Sus Registros y Avances en revisión se resuelven con la nota "Iniciativa desactivada"; sus consultas abiertas siguen abiertas para responderlas o cerrarlas con una nota. Nada se borra y se puede reactivar.'
      : 'Vuelve a aparecer en listas, indicadores y envíos. Lo que se resolvió al desactivarla sigue resuelto.' }),
    bloqueada ? el('p', { id: `${p}-activa-mvp`, class: 'campo__ayuda', text: BLOQUEADO_MVP }) : null,
    el('div', { class: 'acciones' }, boton));
  boton.addEventListener('click', async () => {
    let pregunta = `¿Reactivar ${ini.codigo}? Vuelve a aparecer en listas, indicadores y envíos.`;
    if (ini.activa) {
      // Lo que queda pendiente, para decirlo antes de confirmar (la base resuelve la revisión sola).
      const [pendientes, consultas] = await Promise.all([
        respuestasPendientesDe(ini).catch(() => []), consultasSinResponderDe(ini.id).catch(() => [])]);
      const enRevision = pendientes.filter((r) => r.formulario !== 'consulta').length;
      pregunta = [
        `¿Desactivar ${ini.codigo}? No se borra: deja de aparecer en listas, indicadores y envíos. Se puede reactivar.`,
        enRevision ? `\n${enRevision === 1 ? '1 respuesta en revisión se resolverá' : `${enRevision} respuestas en revisión se resolverán`} con la nota "Iniciativa desactivada".` : '',
        consultas.length === 1 ? '\n1 consulta abierta sigue en Consultas: respóndela o ciérrala sin responder con una nota.' : '',
        consultas.length > 1 ? `\n${consultas.length} consultas abiertas siguen en Consultas: respóndelas o ciérralas sin responder con una nota.` : '',
      ].join('');
    }
    if (!window.confirm(pregunta)) return;
    guardar(zona, boton, async () => {
      await actualizarIniciativa(ini.id, { activa: !ini.activa });
      return ini.activa ? 'Iniciativa desactivada.' : 'Iniciativa reactivada.';
    }, alGuardar, ini.activa ? 'Desactivando…' : 'Reactivando…');
  });
  return zona;
}
