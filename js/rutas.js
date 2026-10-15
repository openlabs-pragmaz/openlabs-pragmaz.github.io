import { el, pintar, nuevoTurno } from './ui.js?v=202610151749';
import { vistaInicio } from './vistas/inicio.js?v=202610151749';
import { vistaClave } from './vistas/clave.js?v=202610151749';
import { vistaRegistros } from './vistas/registros.js?v=202610151749';
import { vistaRegistro } from './vistas/registro.js?v=202610151749';
import { vistaRevision } from './vistas/revision.js?v=202610151749';
import { vistaConsultas } from './vistas/consultas.js?v=202610151749';
import { vistaProgreso } from './vistas/progreso.js?v=202610151749';

const TODOS = ['admin', 'facilitador', 'soporte', 'observador'];
const OPERADORES = ['admin', 'facilitador'];
const GESTIONAN_TICKETS = ['admin', 'facilitador', 'soporte'];

// roles: quién ve la sección en el menú y puede abrirla. Es comodidad, no seguridad:
// si alguien abre la dirección a mano, la base igual le entrega solo lo que le corresponde.
// menu: texto en la barra (sin menu = no aparece en la barra); menuCorto: el mismo en el teléfono.
// seccion: qué enlace del menú marca.
const RUTAS = [
  // El observador no tiene Inicio de tareas: su primera pantalla es Progreso.
  { camino: '/', roles: ['admin', 'facilitador', 'soporte'], menu: 'Inicio', vista: vistaInicio },
  // Para el equipo, el tablero se abre con el interruptor de Inicio (marca Inicio en el menú).
  { camino: '/progreso', roles: TODOS, menu: 'Progreso', menuRoles: ['observador'], vista: vistaProgreso },
  // #/registros?atencion=area (y los demás filtros) abre la lista ya filtrada: así llegan los atajos de Inicio.
  // Sin filtros en la dirección, la lista vuelve completa, salvo al regresar de un detalle.
  { camino: '/registros', roles: TODOS, menu: 'Registros',
    vista: (c, perfil, _p, consulta, anterior) => vistaRegistros(c, perfil, consulta,
      { desdeDetalle: /^\/registros\/INI-\d+$/i.test(anterior ?? '') }) },
  // #/registros/INI-001?seccion=integrantes abre la ficha en Integrantes (atajo desde Revisión).
  { patron: /^\/registros\/(INI-\d+)$/i, seccion: '/registros', roles: TODOS,
    vista: (c, perfil, [codigo], consulta) => vistaRegistro(c, perfil, codigo.toUpperCase(), { seccion: consulta.get('seccion') }) },
  // #/revision?iniciativa=INI-001 abre la lista enfocada en las tarjetas de esa iniciativa.
  { camino: '/revision', roles: OPERADORES, menu: 'Respuestas en revisión', menuCorto: 'Revisión',
    vista: (c, perfil, _p, consulta) => vistaRevision(c, perfil, { enfocar: consulta.get('iniciativa') }) },
  // #/consultas?consulta=42 abre la lista enfocada en esa consulta.
  { camino: '/consultas', roles: GESTIONAN_TICKETS, menu: 'Consultas',
    vista: (c, perfil, _p, consulta) => vistaConsultas(c, perfil, { enfocar: consulta.get('consulta') }) },
  { camino: '/clave', roles: TODOS,
    vista: (c) => vistaClave(c, { alTerminar: () => { location.hash = '#/'; } }) },
];

let obtenerPerfil = () => null;
// Camino de la pantalla anterior (para saber si se vuelve a Registros desde un detalle).
let caminoAnterior = null;

export function iniciarRutas(perfilActual) {
  obtenerPerfil = perfilActual;
  window.removeEventListener('hashchange', mostrar);
  window.addEventListener('hashchange', mostrar);
  pintarMenu();
  mostrar();
}

export function detenerRutas() {
  window.removeEventListener('hashchange', mostrar);
  caminoAnterior = null;
  nuevoTurno();
}

// Sin decodeURIComponent: las rutas solo usan letras, dígitos y guiones, y un "%" mal
// formado en la dirección lanzaría un error que deja la página sin pintar.
function rutaActual() {
  const hash = location.hash;
  return hash.startsWith('#/') ? hash.slice(1).split('?')[0] : '/';
}

// Lo que va después de "?" en la dirección (#/revision?iniciativa=INI-001).
function consultaActual() {
  const i = location.hash.indexOf('?');
  return new URLSearchParams(i === -1 ? '' : location.hash.slice(i + 1));
}

function buscar(camino) {
  for (const ruta of RUTAS) {
    if (ruta.camino === camino) return { ruta, parametros: [] };
    const coincide = ruta.patron?.exec(camino);
    if (coincide) return { ruta, parametros: coincide.slice(1) };
  }
  return null;
}

function mostrar() {
  const perfil = obtenerPerfil();
  if (!perfil) return;
  nuevoTurno();
  if (perfil.rol === 'observador' && rutaActual() === '/') {
    location.replace('#/progreso');
    return;
  }
  const contenedor = document.getElementById('contenido');
  const anterior = caminoAnterior;
  caminoAnterior = rutaActual();
  const encontrada = buscar(caminoAnterior);
  if (!encontrada) {
    location.replace('#/');
    return;
  }
  const { ruta, parametros } = encontrada;
  marcarMenu(ruta.camino === '/progreso' && perfil.rol !== 'observador' ? '/' : ruta.seccion ?? ruta.camino);
  if (!ruta.roles.includes(perfil.rol)) {
    pintar(contenedor,
      el('h1', { text: 'Sección no disponible' }),
      el('p', { text: 'Esta sección no está disponible para tu rol.' }),
      el('a', { class: 'enlace', href: '#/' }, 'Volver al inicio'));
    return;
  }
  ruta.vista(contenedor, perfil, parametros, consultaActual(), anterior);
}

function pintarMenu() {
  const perfil = obtenerPerfil();
  const nav = document.getElementById('nav');
  nav.replaceChildren(...RUTAS
    .filter((r) => r.menu && (r.menuRoles ?? r.roles).includes(perfil.rol))
    .map((r) => el('a', { class: 'barra__enlace', href: `#${r.camino}`, 'data-ruta': r.camino },
      r.menuCorto
        ? [el('span', { class: 'barra__enlace-largo', text: r.menu }), el('span', { class: 'barra__enlace-corto', text: r.menuCorto })]
        : r.menu)));
}

function marcarMenu(actual) {
  for (const enlace of document.querySelectorAll('#barra [data-ruta]')) {
    if (enlace.dataset.ruta === actual) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  }
}
