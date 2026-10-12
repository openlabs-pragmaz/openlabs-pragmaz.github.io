import { supabase } from './cliente.js?v=202610121404';

// Consultas a Supabase. Cada consulta devuelve solo lo que RLS deja ver a quien tiene la sesión:
// aquí no se filtra por rol ni por empresa.

// Las relaciones se nombran por su restricción (hay dos caminos entre iniciativa y estado).
const SELECT_INICIATIVA = `
  id, codigo, nombre, problema, activa, requiere_revision, motivo_revision, creado_en,
  registro_formulario_id, tipo_iniciativa_id, tipo_detalle, track_id, estado_id,
  medida_tipo, medida_detalle, valor_antes, situacion_antes, valor_despues, situacion_despues,
  datos_disponibles, resultado_esperado, dato_confidencial, usuario_identificado,
  mvp_seleccionada, mvp_marcada_por, mvp_marcada_en,
  area_id, area_declarada, frecuencia,
  direccion_id, gerencia_id, jefatura_id, org_otro_niveles, org_directo_niveles, org_cruce_estado,
  modalidad, equipo_nombre, equipo_transversal,
  tipos_datos, autorizacion_jefatura, fecha_autorizacion, origen_datos, envio_externo,
  declaracion_uso, fecha_declaracion, estado_datos, estado_datos_calculado, estado_datos_motivos,
  track:track!iniciativa_track_id_fkey(id, nombre),
  estado:estado_iniciativa!iniciativa_estado_id_track_id_fkey(id, nombre, orden),
  tipo:tipo_iniciativa!iniciativa_tipo_iniciativa_id_fkey(id, nombre),
  participante:participante!iniciativa_participante_id_fkey!inner(
    id, nombre, correo, jefatura_nombre, jefatura_correo, empresa_id,
    empresa:empresa!participante_empresa_id_fkey(id, nombre)
  )`;

export const MEDIDAS = ['Tiempo', 'Costo', 'Errores o reprocesos', 'Días de demora', 'Otra', 'No se mide'];

let catalogos = null;

// Catálogos (cambian poco): se cargan una vez por sesión; olvidarCatalogos() al cerrar sesión.
export async function cargarCatalogos({ forzar = false } = {}) {
  if (catalogos && !forzar) return catalogos;
  const [tracks, estados, tipos, empresas, areas, puntos] = await Promise.all([
    supabase.from('track').select('id, nombre, orden').eq('activo', true).order('orden'),
    supabase.from('estado_iniciativa').select('id, track_id, nombre, orden, activo, fecha_meta').order('track_id').order('orden'),
    supabase.from('tipo_iniciativa').select('id, nombre, orden, activo').order('orden'),
    supabase.from('empresa').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('area').select('id, empresa_id, nombre, nivel, padre_id, activo').order('nombre'),
    supabase.from('punto_guardado').select('id, codigo, nombre, track_id, orden, activo, fecha_esperada').order('orden'),
  ]);
  for (const r of [tracks, estados, tipos, empresas, areas, puntos]) if (r.error) throw r.error;
  catalogos = {
    tracks: tracks.data,
    estados: estados.data,
    tipos: tipos.data,
    empresas: empresas.data,
    areas: areas.data,
    puntos: puntos.data,
  };
  return catalogos;
}

export function olvidarCatalogos() {
  catalogos = null;
}

export async function listarIniciativas() {
  const { data, error } = await supabase.from('iniciativa').select(SELECT_INICIATIVA).order('codigo');
  if (error) throw error;
  return data;
}

export async function obtenerIniciativa(codigo) {
  const { data, error } = await supabase.from('iniciativa').select(SELECT_INICIATIVA).eq('codigo', codigo).maybeSingle();
  if (error) throw error;
  return data;
}

async function iniciativasPorRespuesta(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('iniciativa').select(SELECT_INICIATIVA).in('registro_formulario_id', ids);
  if (error) throw error;
  return data;
}

export async function iniciativasEnRevision() {
  const { data, error } = await supabase.from('iniciativa').select(SELECT_INICIATIVA).eq('requiere_revision', true).order('codigo');
  if (error) throw error;
  return data;
}

// Iniciativas de los grupos de una persona (como integrante, aunque no haya llenado el Registro),
// las mismas que acepta la base al asociarle una consulta. salio: ya la quitaron de ese grupo.
// Primero la activa de la que sigue siendo parte.
export async function iniciativasDePersona(participanteId) {
  const { data, error } = await supabase
    .from('integrante')
    .select('activo, iniciativa:iniciativa!integrante_iniciativa_id_fkey(id, codigo, nombre, activa)')
    .eq('participante_id', participanteId);
  if (error) throw error;
  return data.filter((g) => g.iniciativa)
    .map((g) => ({ ...g.iniciativa, salio: !g.activo }))
    .sort((a, b) => (b.activa && !b.salio) - (a.activa && !a.salio) || a.codigo.localeCompare(b.codigo));
}

// Un UPDATE sin permiso no da error: afecta 0 filas. Por eso se pide la fila de vuelta.
async function actualizar(tabla, filtro, cambios) {
  let consulta = supabase.from(tabla).update(cambios);
  for (const [columna, valor] of Object.entries(filtro)) consulta = consulta.eq(columna, valor);
  const { data, error } = await consulta.select();
  if (error) throw error;
  if (!data.length) throw Object.assign(new Error('sin permiso'), { code: 'sin_filas' });
  return data[0];
}

export const actualizarIniciativa = (id, cambios) => actualizar('iniciativa', { id }, cambios);
export const actualizarParticipante = (id, cambios) => actualizar('participante', { id }, cambios);
export const asociarTicket = (id, iniciativaId) => actualizar('ticket', { id }, { iniciativa_id: iniciativaId });

// Marcar o quitar "Seleccionada para MVP Day": solo el admin o quien tiene el permiso, y solo
// con la iniciativa "Entregada" (lo comprueba la base).
export async function seleccionarMvp(iniciativaId, seleccionada) {
  const { data, error } = await supabase.rpc('seleccionar_mvp', { p_iniciativa_id: iniciativaId, p_seleccionada: seleccionada });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- consultas (tickets)

// Las consultas llegan del formulario de Consulta y de los Avances que piden ayuda (origen).
// Las reglas viven en la base: no se resuelve sin respuesta salvo "cerrar sin responder" con nota,
// la respuesta sale 15 minutos después y, ya enviada, no cambia.
const SELECT_TICKET = `
  id, origen, tema, descripcion, urgencia, estado, respuesta, respondido_por, abierto_en, cerrado_en,
  cerrado_sin_respuesta, nota_cierre, enviar_desde, enviado_en, es_general, a_cargo_de, a_cargo_desde,
  historial_cierre, reabierta_en, iniciativa_id, participante_id, registro_formulario_id,
  iniciativa:iniciativa!ticket_iniciativa_id_fkey(codigo, nombre),
  participante:participante!ticket_participante_id_fkey(nombre, correo,
    empresa:empresa!participante_empresa_id_fkey(nombre))`;

export async function listarTickets() {
  const { data, error } = await supabase.from('ticket').select(SELECT_TICKET).order('abierto_en');
  if (error) throw error;
  // Punto de guardado de los que vienen de un Avance (para decir "Avance · C1").
  const ids = data.filter((t) => t.origen === 'avance' && t.registro_formulario_id).map((t) => t.registro_formulario_id);
  if (!ids.length) return data;
  const { data: bitacoras, error: e2 } = await supabase
    .from('bitacora').select('registro_formulario_id, punto_guardado_id').in('registro_formulario_id', ids);
  if (e2) throw e2;
  const punto = new Map(bitacoras.map((b) => [b.registro_formulario_id, b.punto_guardado_id]));
  return data.map((t) => ({ ...t, punto_guardado_id: punto.get(t.registro_formulario_id) ?? null }));
}

// Cuántas consultas esperan respuesta (para Inicio y el menú).
export async function contarTicketsSinResponder() {
  const { count, error } = await supabase
    .from('ticket').select('id', { count: 'exact', head: true }).neq('estado', 'Resuelto');
  if (error) throw error;
  return count ?? 0;
}

// Consultas de una iniciativa que esperan respuesta (aviso en su detalle).
export async function consultasSinResponderDe(iniciativaId) {
  const { data, error } = await supabase
    .from('ticket').select('id').eq('iniciativa_id', iniciativaId).neq('estado', 'Resuelto').order('abierto_en');
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- seguimiento (bitácora)

// Punto de guardado más avanzado con Avance de cada iniciativa activa (para Progreso). Una fila
// por iniciativa: no choca con el límite de filas de la API, como sí lo haría la bitácora entera.
export async function ultimosAvances() {
  const { data, error } = await supabase.from('ultimo_avance').select('iniciativa_id, punto_guardado_id, orden, fecha');
  if (error) throw error;
  return new Map(data.map((u) => [u.iniciativa_id, u]));
}

// Bloqueos del Avance más reciente de cada iniciativa activa (Avance v3; tarjeta de Inicio).
export async function bloqueosUltimoAvance() {
  const { data, error } = await supabase.from('bloqueos_ultimo_avance').select('iniciativa_id, bloqueos_tipo');
  if (error) throw error;
  return new Map(data.map((b) => [b.iniciativa_id, b.bloqueos_tipo]));
}

// Avances de una iniciativa, del más nuevo al más viejo. Las entradas ignoradas en la revisión
// no cuentan para el seguimiento.
export async function bitacoraDe(iniciativaId) {
  const { data, error } = await supabase
    .from('bitacora')
    .select(`id, registro_formulario_id, fecha, punto_guardado_id, punto_original_id, punto_corregido_en, participante_id,
             que_avanzo, bloqueos, estado_propuesto_id, necesita_ayuda, ayuda_detalle,
             hubo_cambio, cambio_detalle, bloqueos_tipo, cambio_datos, cambio_equipo, cambio_equipo_detalle,
             tipos_datos, respuestas_punto`)
    .eq('iniciativa_id', iniciativaId).eq('ignorada', false).order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}

// Consultas creadas por la ayuda pedida en esos Avances (solo para quien gestiona tickets).
export async function ayudasDe(iniciativaId) {
  const { data, error } = await supabase
    .from('ticket').select('id, registro_formulario_id, estado, cerrado_sin_respuesta, enviado_en')
    .eq('iniciativa_id', iniciativaId).eq('origen', 'avance');
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------- integrantes (iniciativas en grupo)

// Integrantes de una iniciativa, activos y quitados, en el orden en que se agregaron. El nombre
// es el que se escribió en el Registro; la persona trae el correo (si el rol la puede ver).
export async function integrantesDe(iniciativaId) {
  const { data, error } = await supabase
    .from('integrante')
    .select(`participante_id, nombre, activo, agregado_en, quitado_en, nota, rol, rol_equipo, estado,
             participante:participante!integrante_participante_id_fkey(id, nombre, correo)`)
    .eq('iniciativa_id', iniciativaId).order('agregado_en');
  if (error) throw error;
  return data;
}

// Admin y facilitador. Si el correo no es de un participante, se crea con el nombre (obligatorio
// en ese caso), la empresa y el área de la iniciativa. Una persona solo está en un grupo activo.
export async function agregarIntegrante(iniciativaId, correo, nombre) {
  const { data, error } = await supabase.rpc('agregar_integrante', {
    p_iniciativa_id: iniciativaId, p_correo: correo, p_nombre: nombre || null,
  });
  if (error) throw error;
  return data;
}

// Grupos activos en los que ya están unos correos (para un Registro cuyos integrantes chocan con
// otra iniciativa): correo, nombre, la iniciativa y cuántos integrantes activos tiene.
export async function gruposActivosDe(correos) {
  if (!correos.length) return [];
  const { data, error } = await supabase
    .from('integrante')
    .select(`participante_id, nombre,
             participante:participante!integrante_participante_id_fkey!inner(correo),
             iniciativa:iniciativa!integrante_iniciativa_id_fkey!inner(id, codigo, nombre, activa)`)
    .eq('activo', true).eq('iniciativa.activa', true).in('participante.correo', correos);
  if (error) throw error;
  const ids = [...new Set(data.map((g) => g.iniciativa.id))];
  const { data: activos, error: e2 } = ids.length
    ? await supabase.from('integrante').select('iniciativa_id').eq('activo', true).in('iniciativa_id', ids)
    : { data: [], error: null };
  if (e2) throw e2;
  return data.map((g) => ({
    correo: g.participante.correo, nombre: g.nombre, participanteId: g.participante_id, iniciativa: g.iniciativa,
    integrantes: activos.filter((x) => x.iniciativa_id === g.iniciativa.id).length,
  }));
}

export async function quitarIntegrante(iniciativaId, participanteId, nota) {
  const { error } = await supabase.rpc('quitar_integrante', {
    p_iniciativa_id: iniciativaId, p_participante_id: participanteId, p_nota: nota,
  });
  if (error) throw error;
}

export const guardarBorradorTicket =(id, respuesta) => actualizar('ticket', { id }, { respuesta, estado: 'En proceso' });
export const responderTicket = (id, respuesta) =>
  actualizar('ticket', { id }, { respuesta, estado: 'Resuelto', cerrado_sin_respuesta: false });
// Mientras no salga: vuelve a "En proceso" y la respuesta queda como borrador.
export const deshacerEnvioTicket = (id) => actualizar('ticket', { id }, { estado: 'En proceso' });
// Quien la tiene a cargo (o el admin) la devuelve sin cargo; el borrador se conserva.
export async function soltarConsulta(id) {
  const { error } = await supabase.rpc('soltar_consulta', { p_id: id });
  if (error) throw error;
}
export const cerrarTicketSinResponder = (id, nota) =>
  actualizar('ticket', { id }, { estado: 'Resuelto', cerrado_sin_respuesta: true, nota_cierre: nota });
// Solo el admin, con nota; la base guarda el cierre y la reapertura en historial_cierre.
export async function reabrirConsulta(id, nota) {
  const { error } = await supabase.rpc('reabrir_consulta', { p_id: id, p_nota: nota });
  if (error) throw error;
}

export async function crearEquivalencia(empresaId, texto, areaId) {
  const { error } = await supabase.from('area_alias').insert({ empresa_id: empresaId, texto, area_id: areaId });
  if (error) throw error;
}

// Área nueva del organigrama (solo el admin; la base valida nivel, empresa y nombre único bajo
// su unidad de arriba). Devuelve su id.
export async function crearArea({ empresaId, nombre, nivel, padreId }) {
  const { data, error } = await supabase.from('area')
    .insert({ empresa_id: empresaId, nombre, nivel, padre_id: padreId }).select('id').single();
  if (error) throw error;
  return data.id;
}

// ---------------------------------------------------------------- respuestas en revisión

const SELECT_RESPUESTA = `
  id, formulario, id_respuesta, enviado_en, correo, codigo_iniciativa, respuestas,
  estado_procesamiento, motivo_revision, procesado_en, resuelto_por, resuelto_en, nota_resolucion,
  empresa_corregida_id, empresa_corregida_en, reemplaza_iniciativa_id, reemplazo_en`;

// Respuestas pendientes o en revisión, con lo que se creó a partir de cada una.
export async function listarRevisiones() {
  const { data: respuestas, error } = await supabase
    .from('registro_formulario').select(SELECT_RESPUESTA)
    .in('estado_procesamiento', ['revisar', 'pendiente'])
    .order('enviado_en');
  if (error) throw error;
  return conLoCreado(respuestas);
}

// Solo los ids de las respuestas pendientes o en revisión (para contar sin traerlas completas).
export async function idsEnRevision() {
  const { data, error } = await supabase
    .from('registro_formulario').select('id').in('estado_procesamiento', ['revisar', 'pendiente']);
  if (error) throw error;
  return data.map((r) => r.id);
}

// Lo mismo que muestra la pestaña Pendientes: las respuestas en revisión, más las iniciativas
// marcadas en revisión cuya respuesta de origen no está entre ellas.
export function totalPendientes(ids, iniciativas) {
  const enLista = new Set(ids);
  return ids.length + iniciativas.filter((i) => i.requiere_revision && !enLista.has(i.registro_formulario_id)).length;
}

// Nivel que eligió en el Registro quien lo llenó ("Dirección", "Gerencia" o "Jefatura"), o null.
export async function nivelDelRegistro(registroId) {
  if (!registroId) return null;
  const { data, error } = await supabase
    .from('registro_formulario').select('nivel:respuestas->>nivel').eq('id', registroId).maybeSingle();
  if (error) throw error;
  return data?.nivel ?? null;
}

// Respuestas pendientes que tocan a una iniciativa: la de su Registro, y los Avances o
// Consultas que llegaron con su código.
export async function respuestasPendientesDe(ini) {
  const { data, error } = await supabase
    .from('registro_formulario').select('id, formulario, codigo_iniciativa')
    .in('estado_procesamiento', ['revisar', 'pendiente']);
  if (error) throw error;
  return data.filter((r) => r.id === ini.registro_formulario_id
    || (r.codigo_iniciativa ?? '').trim().toUpperCase() === ini.codigo);
}

// Agrega a cada respuesta la iniciativa, la entrada de bitácora o la consulta que creó.
async function conLoCreado(respuestas) {
  const ids = respuestas.map((r) => r.id);
  const [iniciativas, bitacoras, tickets] = await Promise.all([
    iniciativasPorRespuesta(ids),
    ids.length
      ? supabase.from('bitacora')
          .select(`id, registro_formulario_id, iniciativa_id, punto_guardado_id, punto_original_id, ignorada, punto_corregido_en,
                   iniciativa:iniciativa!bitacora_iniciativa_id_fkey(codigo, nombre)`)
          .in('registro_formulario_id', ids)
      : { data: [] },
    ids.length
      ? supabase.from('ticket')
          .select(`id, registro_formulario_id, iniciativa_id, participante_id, es_general, tema, descripcion, estado,
                   origen, cerrado_sin_respuesta, enviado_en,
                   iniciativa:iniciativa!ticket_iniciativa_id_fkey(codigo, nombre),
                   participante:participante!ticket_participante_id_fkey(nombre, correo)`)
          .in('registro_formulario_id', ids)
      : { data: [] },
  ]);
  if (bitacoras.error) throw bitacoras.error;
  if (tickets.error) throw tickets.error;
  // La iniciativa completa de cada Avance: para corregirla desde la tarjeta (por ejemplo, si pidió un cambio).
  const idsAvance = [...new Set(bitacoras.data.map((b) => b.iniciativa_id))];
  const avance = idsAvance.length
    ? await supabase.from('iniciativa').select(SELECT_INICIATIVA).in('id', idsAvance)
    : { data: [] };
  if (avance.error) throw avance.error;
  const iniAvance = new Map(avance.data.map((i) => [i.id, i]));
  // Registro de alguien que ya tenía iniciativa (una por persona): la suya, para compararla,
  // reemplazar sus datos o corregirla desde la tarjeta.
  const codigos = [...new Set(respuestas.filter((r) => r.formulario === 'registro' && r.codigo_iniciativa)
    .map((r) => r.codigo_iniciativa.trim().toUpperCase()))];
  const existentes = codigos.length
    ? await supabase.from('iniciativa').select(SELECT_INICIATIVA).in('codigo', codigos)
    : { data: [] };
  if (existentes.error) throw existentes.error;
  const iniExistente = new Map(existentes.data.map((i) => [i.codigo, i]));
  const por = (lista) => new Map(lista.map((x) => [x.registro_formulario_id, x]));
  const ini = por(iniciativas);
  const bit = por(bitacoras.data);
  const tic = por(tickets.data);
  return respuestas.map((r) => {
    const b = bit.get(r.id);
    const propia = ini.get(r.id);
    return {
      ...r, iniciativa: propia, bitacora: b, iniciativaAvance: b ? iniAvance.get(b.iniciativa_id) : undefined, ticket: tic.get(r.id),
      iniciativaExistente: !propia && r.formulario === 'registro' && r.codigo_iniciativa
        ? iniExistente.get(r.codigo_iniciativa.trim().toUpperCase()) : undefined,
    };
  });
}

export async function listarResueltas(limite = 50) {
  const { data, error } = await supabase
    .from('registro_formulario').select(SELECT_RESPUESTA)
    .not('resuelto_en', 'is', null)
    .eq('estado_procesamiento', 'procesado') // una reabierta vuelve a Pendientes
    .order('resuelto_en', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return conLoCreado(data);
}

// Admin y facilitador: Dirección, Gerencia y Jefatura de una iniciativa del Registro v3. La base
// comprueba nivel y empresa, deja el área en el nivel más bajo y vuelve a calcular el cruce.
//   directo: niveles en "Directamente en…" (['gerencia'], ['jefatura'] o los dos).
export async function corregirOrganizacion(iniciativaId, { direccion, gerencia, jefatura, directo }) {
  const { data, error } = await supabase.rpc('corregir_organizacion', {
    p_iniciativa_id: iniciativaId, p_direccion_id: direccion, p_gerencia_id: gerencia,
    p_jefatura_id: jefatura, p_directo: directo,
  });
  if (error) throw error;
  return data;
}

// Cambios a mano del semáforo de uso de datos, del más nuevo al más viejo. Sin iniciativaId, todos
// los que la sesión puede ver (para la tabla de Registros).
export async function cambiosEstadoDatos(iniciativaId = null) {
  let consulta = supabase.from('estado_datos_cambio')
    .select('id, iniciativa_id, anterior, nuevo, motivo, cambiado_por, cambiado_en')
    .order('cambiado_en', { ascending: false });
  if (iniciativaId) consulta = consulta.eq('iniciativa_id', iniciativaId);
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}

// Admin y facilitador: cambia el color con un motivo obligatorio; la base guarda quién y cuándo.
export async function cambiarEstadoDatos(iniciativaId, estado, motivo) {
  const { error } = await supabase.rpc('cambiar_estado_datos', {
    p_iniciativa_id: iniciativaId, p_estado: estado, p_motivo: motivo,
  });
  if (error) throw error;
}

// Nombres del equipo (solo id y nombre): la base los entrega a admin y facilitador;
// a los demás, ninguno. Sirve para mostrar quién resolvió cada revisión.
export async function nombresEquipo() {
  const { data, error } = await supabase.rpc('nombres_equipo');
  if (error) throw error;
  return new Map(data.map((q) => [q.usuario_id, q.nombre]));
}

export async function reintentar(id) {
  const { data, error } = await supabase.rpc('procesar_formularios', { p_ids: [id] });
  if (error) throw error;
  return data;
}

// Registro que no creó nada porque no se reconoció la empresa: guarda la empresa correcta
// (aparte de la respuesta cruda) y lo vuelve a procesar. Devuelve { estado, codigo }.
// Una iniciativa por persona: el Registro nuevo reemplaza los datos de la que ya tiene (mismo
// código y seguimiento). Queda en revisión para resolverlo con una nota.
export async function reemplazarConRegistro(id) {
  const { data, error } = await supabase.rpc('reemplazar_con_registro', { p_id: id });
  if (error) throw error;
  return data;
}

export async function corregirEmpresaRegistro(id, empresaId) {
  const { data, error } = await supabase.rpc('corregir_empresa_registro', { p_id: id, p_empresa_id: empresaId });
  if (error) throw error;
  return data;
}

// Avance enviado por un punto equivocado: lo pasa al punto correcto (del track de la iniciativa)
// o, sin punto, ignora la entrada en el seguimiento. La respuesta cruda no cambia.
export async function corregirPuntoAvance(id, puntoId) {
  const { data, error } = await supabase.rpc('corregir_punto_avance', { p_registro_id: id, p_punto_id: puntoId });
  if (error) throw error;
  return data;
}

// Solo el admin (lo decide la base): vuelve a poner en revisión una respuesta resuelta por error.
export async function reabrirRevision(id, nota) {
  const { data, error } = await supabase.rpc('reabrir_revision', { p_id: id, p_nota: nota });
  if (error) throw error;
  return data;
}

export async function resolverRevision(id, nota) {
  const { data, error } = await supabase.rpc('resolver_revision', { p_id: id, p_nota: nota });
  if (error) throw error;
  return data;
}

export async function estadoRespuesta(id) {
  const { data, error } = await supabase
    .from('registro_formulario').select('estado_procesamiento, motivo_revision').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
