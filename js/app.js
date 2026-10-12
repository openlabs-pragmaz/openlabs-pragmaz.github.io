import { supabase } from './cliente.js?v=202610121404';
import { el, pintar, ROLES, mensajeError } from './ui.js?v=202610121404';
import { cargarPerfil, perfilActual, cerrarSesion, alCerrarSesion } from './sesion.js?v=202610121404';
import { iniciarRutas, detenerRutas } from './rutas.js?v=202610121404';
import { olvidarCatalogos } from './datos.js?v=202610121404';
import { olvidarFiltros } from './vistas/registros.js?v=202610121404';
import { olvidarFiltrosConsultas } from './vistas/consultas.js?v=202610121404';
import { olvidarFiltrosProgreso } from './vistas/progreso.js?v=202610121404';
import { vistaLogin } from './vistas/login.js?v=202610121404';
import { vistaClave } from './vistas/clave.js?v=202610121404';

const contenido = document.getElementById('contenido');
const barra = document.getElementById('barra');

document.getElementById('saltar').addEventListener('click', (evento) => {
  evento.preventDefault();
  contenido.focus();
});

async function arrancar() {
  if (!supabase) {
    mostrarFalla('No se pudo cargar la plataforma. Recarga la página; si sigue pasando, avisa al administrador.');
    return;
  }
  document.getElementById('salir').addEventListener('click', () => cerrarSesion());
  prepararMenuUsuario();
  alCerrarSesion((aviso) => decidir(null, aviso));
  try {
    decidir(await cargarPerfil());
  } catch (e) {
    mostrarFalla(mensajeError(e));
  }
}

// Qué ve la persona según su sesión: login, sin acceso, cambio obligatorio de contraseña o la plataforma.
function decidir(perfil, aviso = null) {
  if (!perfil) {
    detenerRutas();
    olvidarCatalogos();
    olvidarFiltros();
    olvidarFiltrosConsultas();
    olvidarFiltrosProgreso();
    document.getElementById('usuario-nombre').textContent = '';
    document.getElementById('usuario-rol').textContent = '';
    document.getElementById('usuario-iniciales').textContent = '';
    barra.hidden = true;
    if (location.hash) history.replaceState(null, '', location.pathname);
    vistaLogin(contenido, { alEntrar: decidir, aviso });
    return;
  }
  if (perfil.sinAcceso) {
    detenerRutas();
    barra.hidden = true;
    pintar(contenido,
      el('section', { class: 'tarjeta tarjeta--angosta' },
        el('h1', { text: 'Sin acceso' }),
        el('p', { text: 'Tu cuenta no tiene acceso a la plataforma. Escríbele al administrador.' }),
        el('button', { type: 'button', class: 'boton boton--principal', onclick: () => cerrarSesion() }, 'Salir')));
    return;
  }
  if (!perfil.claveCambiada) {
    detenerRutas();
    barra.hidden = true;
    vistaClave(contenido, { obligatoria: true, alTerminar: () => decidir(perfilActual()) });
    return;
  }
  document.getElementById('usuario-nombre').textContent = perfil.nombre;
  document.getElementById('usuario-rol').textContent = ROLES[perfil.rol] || perfil.rol;
  document.getElementById('usuario-iniciales').textContent = iniciales(perfil.nombre);
  barra.hidden = false;
  iniciarRutas(perfilActual);
}

// "Admin Prueba" → "AP" (para la píldora de usuario).
function iniciales(nombre) {
  return (nombre || '').trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
}

// El menú de la píldora se cierra al elegir una opción, al pulsar fuera o con Escape.
function prepararMenuUsuario() {
  const menu = document.getElementById('usuario');
  menu.addEventListener('click', (e) => {
    if (e.target.closest('.usuario__opcion')) menu.open = false;
  });
  document.addEventListener('click', (e) => {
    if (menu.open && !menu.contains(e.target)) menu.open = false;
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    menu.querySelector('summary').focus();
  });
}

function mostrarFalla(texto) {
  barra.hidden = true;
  pintar(contenido,
    el('section', { class: 'tarjeta tarjeta--angosta' },
      el('h1', { text: 'No se pudo abrir la plataforma' }),
      el('p', { class: 'mensaje mensaje--error', role: 'alert', text: texto }),
      el('button', { type: 'button', class: 'boton boton--principal', onclick: () => location.reload() }, 'Volver a intentar')));
}

arrancar();
