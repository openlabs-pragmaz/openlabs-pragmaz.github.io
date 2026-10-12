// Textos para mostrar datos de forma legible. Solo vocabulario genérico de la plataforma:
// nada de empresas, áreas ni personas (eso llega siempre de la base).

export const FORMULARIOS = { registro: 'Registro', avance: 'Avance', consulta: 'Consulta' };

// Clave guardada por Apps Script → pregunta del formulario .
const PREGUNTAS = {
  // En el orden del formulario del 12 oct (v3); las preguntas que ya no tiene van al final.
  registro: {
    nombre: 'Nombre completo (quien registra y coordina)',
    empresa: 'Empresa',
    direccion: 'Dirección',
    gerencia: 'Gerencia',
    gerencia_otra: 'Escribe el nombre de tu gerencia (eligió "Mi área no aparece")',
    jefatura: 'Jefatura',
    jefatura_otra: 'Escribe el nombre de tu jefatura (eligió "Mi área no aparece")',
    jefatura_correo: 'Correo de tu jefatura directa',
    modalidad: '¿Cómo vas a trabajar esta iniciativa?',
    equipo_nombre: 'Nombre del equipo',
    rol_coordinador: 'Además de coordinar, ¿qué rol cumples en el equipo?',
    equipo_transversal: '¿El equipo incluye personas de otras áreas o de la otra empresa?',
    integrante_1_nombre: 'Integrante 1 · Nombre completo',
    integrante_1_correo: 'Integrante 1 · Correo de la empresa',
    integrante_1_rol: 'Integrante 1 · Rol en el equipo',
    integrante_2_nombre: 'Integrante 2 · Nombre completo',
    integrante_2_correo: 'Integrante 2 · Correo de la empresa',
    integrante_2_rol: 'Integrante 2 · Rol en el equipo',
    integrante_3_nombre: 'Integrante 3 · Nombre completo',
    integrante_3_correo: 'Integrante 3 · Correo de la empresa',
    integrante_3_rol: 'Integrante 3 · Rol en el equipo',
    integrante_4_nombre: 'Integrante 4 · Nombre completo',
    integrante_4_correo: 'Integrante 4 · Correo de la empresa',
    integrante_4_rol: 'Integrante 4 · Rol en el equipo',
    integrante_5_nombre: 'Integrante 5 · Nombre completo',
    integrante_5_correo: 'Integrante 5 · Correo de la empresa',
    integrante_5_rol: 'Integrante 5 · Rol en el equipo',
    track: '¿Con qué herramienta vas a desarrollar tu idea?',
    iniciativa_nombre: 'Nombre de tu iniciativa',
    situacion_antes: 'Describe tu iniciativa y qué problema resuelve',
    tipo: 'Tipo de iniciativa',
    resultado_esperado: '¿Cómo imaginas el resultado final?',
    usuario_identificado: '¿Quién más usaría el resultado?',
    medida_tipo: '¿Cómo se mide hoy el problema?',
    valor_antes: '¿Cuánto es hoy?',
    frecuencia: '¿Con qué frecuencia se hace hoy esta tarea?',
    datos_disponibles: '¿Qué fuentes de datos o archivos usarías?',
    tipos_datos: '¿Qué tipos de información usarás?',
    autorizacion_jefatura: 'Autorización de tu jefatura',
    origen_datos: '¿De dónde tomará los datos tu prototipo?',
    envio_externo: '¿Tu solución enviará información automáticamente fuera de tu área?',
    declaracion_uso: 'Declaración de uso',
    // Formularios anteriores (v1 y v2)
    nivel: '¿Tu área es una Dirección, una Gerencia o una Jefatura? (versión anterior del formulario)',
    area: '¿Cuál es tu área? (versión anterior del formulario)',
    area_otra: 'Escribe el nombre de tu área (versión anterior del formulario)',
    integrantes: 'Integrantes de la iniciativa (versión anterior del formulario)',
    dato_confidencial: '¿Qué tipo de información vas a usar? (versión anterior del formulario)',
    jefatura_nombre: 'Nombre de tu jefatura (versión anterior del formulario)',
    problema: '¿Qué problema resuelve? (versión anterior del formulario)',
    empresa_otra: '¿Cuál es tu empresa? (versión anterior del formulario)',
  },
  avance: {
    codigo: 'Código de iniciativa',
    nombre_iniciativa: 'Nombre de la iniciativa',
    punto_guardado: 'Punto de guardado',
    que_avanzo: '¿Qué avanzaste desde la última sesión?',
    bloqueos_tipo: '¿Qué te está frenando?',
    bloqueos: 'Cuéntanos más sobre lo que te frena',
    estado: '¿En qué estado está tu iniciativa?',
    necesita_ayuda: '¿Necesitas ayuda del equipo de Open Labs?',
    ayuda_detalle: '¿En qué necesitas ayuda?',
    hubo_cambio: '¿Cambió algo de tu iniciativa?',
    cambio_detalle: '¿Qué cambió?',
    cambio_equipo: '¿Cambió el equipo que trabaja la iniciativa?',
    cambio_equipo_detalle: '¿Quiénes se sumaron o salieron?',
    cambio_datos: '¿Cambió el tipo de información que usas?',
    // Preguntas propias de cada punto de guardado
    g1_prototipo: '¿Tienes un primer prototipo o automatización?',
    g1_prototipo_detalle: 'Enlace o descripción del prototipo',
    cg_entregado: '¿Entregaste tu plan de acción y tu prototipo?',
    cg_datos_reales: '¿Tu iniciativa necesita datos reales para seguir?',
    c2_primera_version: '¿Ya tienes una primera versión que hace lo principal?',
    c2_tipos_datos: '¿Con qué datos estás trabajando?',
    c2_datos: '¿Con qué datos estás trabajando? (versión anterior del formulario)',
    c3_falta_para_otro: '¿Qué te falta para que otra persona pueda usarlo?',
    c3_skill: '¿Convertiste los pasos repetibles en una Skill de Claude?',
    c4_probado_por_otro: '¿Otra persona ya lo usó o lo probó?',
    c4_distintos_datos: '¿Has comprobado que funciona con distintos datos o casos?',
    jefatura_reviso: '¿Tu jefatura revisó la propuesta?',
    valor_despues: '¿Cuánto es ahora?',
    situacion_despues: 'Describe la situación ahora',
    decision_cierre: 'Decisión: escalar, congelar o descartar',
    responsable_cierre: 'Responsable de mantenerlo',
    como_lo_corre: '¿Cómo lo corre otra persona?',
  },
  consulta: {
    sobre_iniciativa: '¿Tu consulta es sobre tu iniciativa?',
    codigo: 'Código de iniciativa',
    tema: 'Tema',
    descripcion: 'Tu consulta',
    urgencia: '¿Para cuándo la necesitas?',
  },
};

// Una clave sin pregunta conocida se muestra tal cual, más legible ("tiene_prototipo" → "Tiene prototipo").
export function pregunta(formulario, clave) {
  const conocida = PREGUNTAS[formulario]?.[clave];
  if (conocida) return conocida;
  if (clave.startsWith('sin_clave')) return clave;
  const texto = clave.replace(/_/g, ' ').trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Orden de las preguntas: primero las del formulario (en su orden) y luego las demás.
export function paresRespuesta(formulario, respuestas) {
  if (!respuestas || typeof respuestas !== 'object' || Array.isArray(respuestas)) return null;
  const orden = Object.keys(PREGUNTAS[formulario] || {});
  const claves = Object.keys(respuestas).sort((a, b) => {
    const ia = orden.indexOf(a); const ib = orden.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return claves.map((clave) => [pregunta(formulario, clave), valorTexto(respuestas[clave])]);
}

function valorTexto(valor) {
  if (valor === null || valor === undefined || valor === '') return '(vacío)';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

// ---------------------------------------------------------------- iniciativa

export const textoHerramienta = (ini) => ini.track?.nombre ?? 'Sin herramienta asignada';

export function textoTipo(ini) {
  if (ini.tipo?.nombre) return ini.tipo.nombre;
  return ini.tipo_detalle ? `Otro: ${ini.tipo_detalle}` : 'Por definir';
}



// ---------------------------------------------------------------- Registro v3

// La iniciativa trae Dirección, Gerencia y Jefatura (o lo que eligió en su lugar).
export const esRegistroV3 = (ini) => Boolean(ini.direccion_id || ini.gerencia_id || ini.jefatura_id
  || ini.org_otro_niveles?.length || ini.org_directo_niveles?.length
  || ini.modalidad || ini.estado_datos || ini.declaracion_uso != null);

// Unidad por clasificar: sin unidad del catálogo o, en el Registro v3, con algún nivel escrito en
// "Mi área no aparece" (aunque tenga una unidad de arriba). Lo mismo que muestra la columna Unidad.
export const unidadPorClasificar = (ini, porId) => !porId.has(ini.area_id) || Boolean(ini.org_otro_niveles?.length);

// Lo que escribió en cada nivel que no aparecía: "Gerencia: X · Jefatura: Y" → { gerencia: 'X', jefatura: 'Y' }.
export function escritoPorNivel(ini) {
  const salida = {};
  for (const parte of (ini.area_declarada ?? '').split(' · ')) {
    const [nivel, ...texto] = parte.split(': ');
    if (texto.length) salida[nivel.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()] = texto.join(': ');
  }
  return salida;
}

// Los tres niveles: clave en la base, nombre en el catálogo y la opción "Directamente en…".
export const NIVELES_V3 = [
  { clave: 'direccion', nivel: 'Dirección', id: 'direccion_id', directo: null },
  { clave: 'gerencia', nivel: 'Gerencia', id: 'gerencia_id', directo: 'Directamente en la dirección (sin gerencia)' },
  { clave: 'jefatura', nivel: 'Jefatura', id: 'jefatura_id', directo: 'Directamente en la gerencia (sin jefatura)' },
];

// ---------------------------------------------------------------- uso responsable (Registro v3)

// Semáforo de uso de datos, del más restrictivo al más libre.
export const SEMAFOROS = [
  { valor: 'rojo', texto: 'Rojo' },
  { valor: 'amarillo', texto: 'Amarillo' },
  { valor: 'verde_registro', texto: 'Verde con registro' },
  { valor: 'verde', texto: 'Verde' },
];
export const textoSemaforo = (valor) => SEMAFOROS.find((s) => s.valor === valor)?.texto ?? 'Sin color';

// Los motivos llegan como "Amarillo: usará información privada…": en pantalla, sin el color delante.
export function motivosSemaforo(ini) {
  return (ini.estado_datos_motivos ?? []).map((m) => {
    const texto = m.replace(/^(Rojo|Amarillo|Verde con registro|Verde):\s*/, '');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  });
}

const TIPOS_DATOS = {
  publica: 'Pública', interna: 'Interna', simulada: 'Simulada', privada: 'Privada',
  confidencial: 'Confidencial', restringida: 'Restringida', no_seguro: 'No está seguro(a)',
  ninguno: 'Todavía no usa datos',
};
export const textoTiposDatos = (tipos) => (tipos?.length ? tipos.map((t) => TIPOS_DATOS[t] ?? t).join(' · ') : null);

export const ORIGEN_DATOS = {
  sistema: 'Se conectará directamente a un sistema de la empresa',
  archivos_propios: 'Datos que ya tiene (Excel, CSV, PDF, reportes, correos)',
  ejemplo: 'Datos de ejemplo o inventados',
  no_sabe: 'Aún no lo sabe',
};
export const ENVIO_EXTERNO = { si: 'Sí', no: 'No', no_sabe: 'No lo sabe' };
export const MODALIDAD = { individual: 'Individual', equipo: 'En equipo' };
export const ROL_EQUIPO = {
  constructor: 'Constructor(a)', experto_proceso: 'Experto(a) del proceso', datos: 'Datos',
  pruebas: 'Pruebas', otro: 'Otro', solo_coordina: 'Solo coordina',
};
// Avance v3: qué lo frena (casillas) y cambio de equipo.
export const BLOQUEOS = {
  acceso_datos: 'Acceso a datos', licencia: 'Licencia o permisos', tiempo: 'Tiempo',
  conocimiento: 'Conocimiento', aprobacion_jefatura: 'Aprobación de su jefatura', nada: 'Nada lo frena',
};
export const textoBloqueos = (b) => (b?.length ? b.map((x) => BLOQUEOS[x] ?? x).join(' · ') : null);
export const CAMBIO_EQUIPO = {
  sin_cambio: 'No', altas: 'Se sumaron personas', bajas: 'Salieron personas', altas_y_bajas: 'Se sumaron y salieron personas',
};
export const FRECUENCIA = {
  diaria: 'Diaria', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', ocasional: 'Ocasional',
};

// ---------------------------------------------------------------- áreas (organigrama)
// Dirección → Gerencia → Jefatura (7 oct), o área → subárea en el catálogo anterior: las mismas
// funciones sirven para cualquier profundidad.

// El área y las de arriba, de ella hacia la raíz. porId: Map id → área.
export function cadenaArea(id, porId) {
  const cadena = [];
  for (let a = porId.get(id); a && !cadena.includes(a); a = porId.get(a.padre_id)) cadena.push(a);
  return cadena;
}

// Todas las unidades por las que se puede encontrar una iniciativa: la cadena de su área y, en el
// Registro v3 (niveles elegidos sin cadena), también la de cada nivel. Es lo mismo que mira la base
// para dar acceso (puede_ver_iniciativa).
export function unidadesIniciativa(ini, porId) {
  const ids = new Set();
  for (const id of [ini.area_id, ini.direccion_id, ini.gerencia_id, ini.jefatura_id]) {
    for (const a of cadenaArea(id, porId)) ids.add(String(a.id));
  }
  return [...ids];
}

// "Dirección de Finanzas › Gerencia de Contabilidad › Jefatura Administrativa".
export const caminoArea = (id, porId) => cadenaArea(id, porId).reverse().map((a) => a.nombre).join(' › ');

// El área es de la iniciativa, no de cada persona.
export function textoArea(ini, areas) {
  const area = areas.find((a) => a.id === ini.area_id);
  if (!area) return `Por clasificar: ${ini.area_declarada || '(no escribió su unidad)'}`;
  return caminoArea(area.id, new Map(areas.map((a) => [a.id, a])));
}

// Opciones de un selector de área en árbol: cada unidad de más arriba del organigrama es un grupo
// y dentro va el camino desde ella ("Gerencia de Contabilidad › Jefatura Administrativa"). Las
// áreas sin nivel (catálogo anterior) van con su camino completo, agrupadas solo por la empresa.
// empresaDe(área): nombre de la empresa para el grupo, o null si hay una sola.
export function opcionesArea(areas, empresaDe = () => null) {
  const opciones = [];
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre);
  const hijos = (id) => areas.filter((x) => x.padre_id === id).sort(porNombre);
  const recorrer = (a, camino, grupo) => {
    opciones.push({ valor: a.id, texto: camino.join(' › ') || a.nombre, grupo: grupo ?? undefined });
    for (const h of hijos(a.id)) recorrer(h, [...camino, h.nombre], grupo);
  };
  const raices = areas.filter((a) => !a.padre_id || !areas.some((x) => x.id === a.padre_id))
    .sort((a, b) => (empresaDe(a) ?? '').localeCompare(empresaDe(b) ?? '') || porNombre(a, b));
  for (const raiz of raices) {
    const empresa = empresaDe(raiz);
    if (raiz.nivel) recorrer(raiz, [], empresa ? `${empresa} · ${raiz.nombre}` : raiz.nombre);
    else recorrer(raiz, [raiz.nombre], empresa);
  }
  return opciones;
}

export function textoMedida(ini) {
  if (!ini.medida_tipo) return 'Sin tipo de medida';
  return ini.medida_tipo === 'Otra' && ini.medida_detalle ? `Otra: ${ini.medida_detalle}` : ini.medida_tipo;
}

// ---------------------------------------------------------------- consultas

// En qué va una consulta, en minúsculas para usarla dentro de una frase.
export function estadoConsulta(t) {
  if (t.cerrado_sin_respuesta) return 'cerrada sin responder';
  if (t.enviado_en) return 'respondida';
  if (t.estado === 'Resuelto') return 'respuesta por enviar';
  return 'sin responder';
}

// Los motivos se guardan separados por "; ", tal como los escribe la base. Para mostrarlos:
// con mayúscula inicial y sin "en el panel" (quien los lee ya está en él).
// Algunos motivos llevan "; " por dentro ("Su área no está en la lista; escribió: X", "…; parecidas:
// INI-001 «…»", o lo que escribió la persona entre paréntesis): esos trozos se vuelven a unir con
// el motivo anterior, para que cuente como uno solo.
const continua = (anterior, trozo) => /^(escribió|parecidas):/i.test(trozo)
  || (anterior.split('(').length > anterior.split(')').length)
  || (anterior.split('«').length > anterior.split('»').length);

export const motivos = (texto) => (texto ? texto.split('; ').filter(Boolean) : [])
  .reduce((lista, trozo) => {
    if (lista.length && continua(lista[lista.length - 1], trozo)) lista[lista.length - 1] += `; ${trozo}`;
    else lista.push(trozo);
    return lista;
  }, [])
  .map((m) => m.trim().replace(/ en el panel$/i, ' aquí'))
  // "El punto G1 es de otro track" → "El punto de guardado G1 es de otro track".
  .map((m) => m.replace(/^el punto (\S+) es de otro track/i, 'El punto de guardado $1 es de otro track'))
  .map((m) => m.charAt(0).toUpperCase() + m.slice(1));
