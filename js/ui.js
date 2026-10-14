import { ZONA_HORARIA } from './config.js?v=202610132104';

// Crea un elemento. El texto siempre entra como textContent (nunca innerHTML):
// lo que escriben los participantes se muestra tal cual, sin interpretarse como HTML.
//   el('p', { class: 'nota', text: 'Hola' })
//   el('button', { type: 'button', onclick: fn }, 'Guardar')
export function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class') nodo.className = valor;
    else if (clave === 'text') nodo.textContent = valor;
    else if (clave.startsWith('on') && typeof valor === 'function') nodo.addEventListener(clave.slice(2), valor);
    else if (valor === true) nodo.setAttribute(clave, '');
    else nodo.setAttribute(clave, String(valor));
  }
  agregar(nodo, hijos);
  return nodo;
}

function agregar(nodo, hijos) {
  for (const hijo of hijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    if (Array.isArray(hijo)) agregar(nodo, hijo);
    else nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
}

// Turno de la vista en pantalla: las rutas lo avanzan en cada navegación y al cerrar sesión.
// Una vista que termina de cargar cuando la persona ya se fue a otra sección no pinta.
let turno = 0;
export const nuevoTurno = () => ++turno;
export const turnoActual = () => turno;
export const vigente = (t) => t === turno;

// Reemplaza el contenido principal y lleva el foco a su título (lectores de pantalla y teclado).
export function pintar(contenedor, ...hijos) {
  contenedor.replaceChildren();
  agregar(contenedor, hijos);
  const titulo = contenedor.querySelector('h1');
  if (titulo) {
    titulo.setAttribute('tabindex', '-1');
    titulo.focus();
    document.title = `${titulo.textContent} · Plataforma de Seguimiento · Open Labs`;
  }
}

// Id del botón que lanzó la última acción (conBoton): al repintar, el foco vuelve a él.
let focoTrasAccion = null;

// Igual que pintar, pero para volver a cargar la misma vista después de guardar: conserva la
// posición de la página y devuelve el foco al mismo control (el botón que se usó, o el que tenía
// el foco), que se recrea con el mismo id. Devuelve false si ese control ya no existe, para que
// la vista elija a dónde llevarlo (por ejemplo, a la siguiente tarjeta). Los desplegables
// (<details> con id) que estaban abiertos siguen abiertos.
export function repintar(contenedor, ...hijos) {
  const y = window.scrollY;
  const activo = document.activeElement;
  const id = focoTrasAccion ?? (contenedor.contains(activo) ? activo.id : null);
  focoTrasAccion = null;
  const abiertos = [...contenedor.querySelectorAll('details[open][id]')].map((d) => d.id);
  contenedor.replaceChildren();
  agregar(contenedor, hijos);
  for (const idAbierto of abiertos) {
    const desplegable = document.getElementById(idAbierto);
    if (desplegable && contenedor.contains(desplegable)) desplegable.open = true;
  }
  window.scrollTo(0, y);
  const destino = id ? document.getElementById(id) : null;
  if (!destino || !contenedor.contains(destino)) return false;
  destino.focus({ preventScroll: true });
  return document.activeElement === destino;
}

// Lleva el foco a un bloque que no es un control (tarjeta, mensaje) y lo muestra si está fuera de la pantalla.
export function enfocar(nodo) {
  if (!nodo) return;
  if (!nodo.hasAttribute('tabindex') && nodo.tabIndex < 0) nodo.setAttribute('tabindex', '-1');
  nodo.focus();
}

// Botón que lanza una acción: se desactiva y dice lo que está haciendo mientras dura.
// Si la acción falla, vuelve a su texto y se puede usar otra vez; si sale bien, la vista se
// vuelve a pintar y el foco regresa al botón nuevo con el mismo id.
export async function conBoton(boton, enCurso, accion) {
  boton.dataset.textoOriginal = boton.textContent;
  focoTrasAccion = boton.id || null;
  boton.disabled = true;
  boton.textContent = enCurso;
  try {
    return await accion();
  } catch (e) {
    soltarBoton(boton);
    throw e;
  }
}

// Devuelve el botón a su estado normal cuando la acción terminó sin repintar (no había cambios).
export function soltarBoton(boton) {
  focoTrasAccion = null;
  boton.disabled = false;
  if (boton.dataset.textoOriginal) boton.textContent = boton.dataset.textoOriginal;
}

// Error junto al campo: queda a la vista (y asociado al campo para lectores de pantalla)
// hasta que la persona vuelve a escribir.
export function errorCampo(control, texto) {
  const id = `${control.id}-error`;
  let nota = document.getElementById(id);
  if (!nota) {
    nota = el('p', { class: 'campo__error', id });
    control.insertAdjacentElement('afterend', nota);
  }
  nota.textContent = texto;
  control.setAttribute('aria-invalid', 'true');
  const descritos = (control.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
  if (!descritos.includes(id)) control.setAttribute('aria-describedby', [id, ...descritos].join(' '));
  control.addEventListener('input', () => {
    nota.remove();
    control.removeAttribute('aria-invalid');
    const resto = (control.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== id);
    if (resto.length) control.setAttribute('aria-describedby', resto.join(' '));
    else control.removeAttribute('aria-describedby');
  }, { once: true });
  control.focus();
}

// Error de una acción (no se guardó, no hay conexión): queda dentro del formulario o la tarjeta,
// encima de sus botones, hasta el siguiente intento. Sin texto, lo quita.
export function errorEn(contenedor, texto) {
  let caja = contenedor.querySelector(':scope > .mensaje--accion');
  if (!texto) { caja?.remove(); return; }
  if (!caja) {
    caja = el('p', { class: 'mensaje mensaje--error mensaje--accion', role: 'alert' });
    const acciones = contenedor.querySelector(':scope > .acciones');
    if (acciones) acciones.before(caja); else contenedor.append(caja);
  }
  caja.textContent = texto;
}

// Cuántas respuestas esperan revisión, junto a su enlace en el menú. Lo actualizan Inicio y
// Revisión cada vez que cargan (no se consulta aparte).
export const conteoRevision = (total) => conteoMenu('/revision', total, 'pendientes');
// Lo mismo para las consultas sin responder (Inicio y Consultas).
export const conteoConsultas = (total) => conteoMenu('/consultas', total, 'sin responder');

function conteoMenu(ruta, total, texto) {
  const enlace = document.querySelector(`#nav [data-ruta="${ruta}"]`);
  if (!enlace) return;
  enlace.querySelector('.barra__conteo')?.remove();
  if (!total) return;
  enlace.append(el('span', { class: 'barra__conteo' },
    el('span', { 'aria-hidden': 'true', text: String(total) }),
    el('span', { class: 'solo-lectores', text: ` (${total} ${texto})` })));
}

let temporizadorAviso;
// Mensaje breve en la región con aria-live (se anuncia sin mover el foco).
export function avisar(texto, tipo = 'exito') {
  const caja = document.getElementById('aviso');
  caja.className = `aviso aviso--${tipo} aviso--visible`;
  caja.textContent = texto;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caja.className = 'aviso'; caja.textContent = ''; }, 6000);
}

const FECHA = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: ZONA_HORARIA });
const HORA = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: ZONA_HORARIA });

// "mar 13 oct" (y la hora, si se pide: "mar 13 oct, 3:05 p. m.").
export function formatoFecha(valor, { conHora = false } = {}) {
  if (!valor) return '';
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';
  const partes = Object.fromEntries(FECHA.formatToParts(fecha).map((p) => [p.type, p.value.replace(/[.,]/g, '')]));
  const texto = `${partes.weekday} ${partes.day} ${partes.month}`;
  return conHora ? `${texto}, ${HORA.format(fecha)}` : texto;
}

export const ROLES = {
  admin: 'Administrador',
  facilitador: 'Facilitador',
  soporte: 'Soporte',
  observador: 'Observador',
};

// Etiqueta de estado: siempre con texto; el color solo acompaña.
export function insignia(texto, tipo = 'neutra', titulo) {
  return el('span', { class: `insignia insignia--${tipo}`, title: titulo }, texto);
}

// Convierte los errores de Supabase en mensajes en español, sin detalles técnicos.
export function mensajeError(error) {
  const codigo = error?.code || error?.error_code || '';
  const mensaje = String(error?.message || '');
  if (error?.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed/i.test(mensaje) || !navigator.onLine) {
    return 'No se pudo conectar con la plataforma. Revisa tu conexión y vuelve a intentar.';
  }
  // Mensajes que escribe la propia base (triggers y funciones), ya en español.
  if (['P0001', 'P0002', '23514', '42501'].includes(codigo)
      && mensaje && !/violates|permission denied|row-level security|policy/i.test(mensaje)) {
    return mensaje;
  }
  const datos = {
    sin_filas: 'No se guardó: no tienes permiso para este cambio.',
    42501: 'No se guardó: no tienes permiso para este cambio.',
    23505: 'Ese dato ya existe.',
    23503: 'El dato elegido no corresponde a esta empresa.',
    23514: 'El cambio no cumple las reglas de la base.',
  };
  if (datos[codigo]) return datos[codigo];
  const conocidos = {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    user_banned: 'Tu cuenta está suspendida. Escríbele al administrador.',
    over_request_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.',
    over_email_send_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.',
    weak_password: 'La contraseña nueva no cumple las reglas: 10 caracteres o más, con letras y dígitos.',
    same_password: 'La contraseña nueva tiene que ser distinta de la actual.',
    current_password_mismatch: 'La contraseña actual no es correcta.',
    current_password_required: 'Escribe tu contraseña actual.',
    reauthentication_needed: 'La contraseña actual no es correcta.',
    session_expired: 'Tu sesión venció. Vuelve a iniciar sesión.',
    session_not_found: 'Tu sesión venció. Vuelve a iniciar sesión.',
  };
  if (conocidos[codigo]) return conocidos[codigo];
  if (error?.status === 429) return conocidos.over_request_rate_limit;
  return 'Algo salió mal. Vuelve a intentar; si sigue pasando, avisa al administrador.';
}

// Para buscar sin importar tildes ni mayúsculas.
export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Campo con su etiqueta: el('label') + control, unidos por id.
export function campo(id, texto, control, ayuda) {
  control.id = id;
  const partes = [el('label', { for: id, text: texto })];
  if (ayuda) {
    const idAyuda = `${id}-ayuda`;
    control.setAttribute('aria-describedby', idAyuda);
    partes.push(control, el('p', { class: 'campo__ayuda', id: idAyuda, text: ayuda }));
  } else {
    partes.push(control);
  }
  return el('div', { class: 'campo' }, partes);
}

// En tableta y teléfono las tablas se muestran como tarjetas (display: block) y algunos
// navegadores dejan de anunciarlas como tabla. Los roles explícitos les devuelven su significado.
export function rolesDeTabla(tabla) {
  tabla.setAttribute('role', 'table');
  for (const grupo of tabla.querySelectorAll('thead, tbody')) grupo.setAttribute('role', 'rowgroup');
  for (const fila of tabla.querySelectorAll('tr')) fila.setAttribute('role', 'row');
  for (const celda of tabla.querySelectorAll('thead th')) celda.setAttribute('role', 'columnheader');
  for (const celda of tabla.querySelectorAll('tbody th')) celda.setAttribute('role', 'rowheader');
  for (const celda of tabla.querySelectorAll('td')) celda.setAttribute('role', 'cell');
  return tabla;
}

// <select> con opciones [{ valor, texto, grupo? }]. Las opciones con grupo van en <optgroup>.
export function selector(opciones, seleccionado) {
  const select = el('select');
  // Lista con estilo propio (Chrome y Edge recientes): el texto elegido va en su propio elemento,
  // así se corta con "…" antes de la flecha. Los demás navegadores ignoran el botón.
  if (CSS.supports('appearance', 'base-select')) select.append(el('button', { type: 'button' }, document.createElement('selectedcontent')));
  const grupos = new Map();
  for (const o of opciones) {
    const opcion = el('option', { value: o.valor, selected: String(o.valor) === String(seleccionado ?? '') }, o.texto);
    if (!o.grupo) { select.append(opcion); continue; }
    if (!grupos.has(o.grupo)) {
      const g = el('optgroup', { label: o.grupo });
      grupos.set(o.grupo, g);
      select.append(g);
    }
    grupos.get(o.grupo).append(opcion);
  }
  // Si el nombre elegido se corta con "…", el texto completo queda al pasar el puntero.
  const titulo = () => { select.title = select.selectedOptions[0]?.textContent ?? ''; };
  select.addEventListener('change', titulo);
  titulo();
  return select;
}
