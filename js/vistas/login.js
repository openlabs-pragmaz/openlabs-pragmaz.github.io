import { el, pintar, mensajeError } from '../ui.js?v=202610132104';
import { iniciarSesion } from '../sesion.js?v=202610132104';

export function vistaLogin(contenedor, { alEntrar, aviso = null }) {
  const error = el('p', { class: 'mensaje mensaje--error', id: 'login-error', role: 'alert', hidden: true });
  const correo = el('input', {
    id: 'login-correo', name: 'correo', type: 'email', autocomplete: 'username',
    required: true, spellcheck: 'false', autocapitalize: 'none',
  });
  const clave = el('input', {
    id: 'login-clave', name: 'clave', type: 'password', autocomplete: 'current-password', required: true,
  });
  const mostrar = el('button', {
    type: 'button', class: 'boton boton--secundario', 'aria-pressed': 'false', 'aria-controls': 'login-clave',
    onclick: () => {
      const visible = clave.type === 'password';
      clave.type = visible ? 'text' : 'password';
      mostrar.setAttribute('aria-pressed', String(visible));
      mostrar.textContent = visible ? 'Ocultar' : 'Mostrar';
    },
  }, 'Mostrar');
  const entrar = el('button', { type: 'submit', class: 'boton boton--principal boton--ancho' }, 'Entrar');

  const formulario = el('form', { class: 'formulario', novalidate: true, 'aria-describedby': 'login-error' },
    el('div', { class: 'campo' },
      el('label', { for: 'login-correo', text: 'Correo' }),
      correo),
    el('div', { class: 'campo' },
      el('label', { for: 'login-clave', text: 'Contraseña' }),
      el('div', { class: 'campo__con-boton' }, clave, mostrar)),
    error,
    entrar,
  );

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    error.hidden = true;
    if (!correo.value.trim() || !clave.value) {
      mostrarError('Escribe tu correo y tu contraseña.');
      (correo.value.trim() ? clave : correo).focus();
      return;
    }
    entrar.disabled = true;
    entrar.textContent = 'Entrando…';
    try {
      const perfil = await iniciarSesion(correo.value, clave.value);
      alEntrar(perfil);
    } catch (e) {
      mostrarError(mensajeError(e));
      clave.value = '';
      clave.focus();
      entrar.disabled = false;
      entrar.textContent = 'Entrar';
    }
  });

  function mostrarError(texto) {
    error.textContent = texto;
    error.hidden = false;
  }

  pintar(contenedor,
    el('section', { class: 'tarjeta tarjeta--angosta', 'aria-labelledby': 'login-titulo' },
      el('div', { class: 'logos tarjeta__logos' },
        el('img', { src: 'img/logo-cln.webp', alt: 'CLN · Compañía Licorera de Nicaragua', width: 160, height: 50 }),
        el('img', { src: 'img/logo-isa.webp', alt: 'ISA · Ingenio San Antonio', width: 155, height: 50 })),
      el('h1', { id: 'login-titulo', text: 'Iniciar sesión' }),
      el('p', { class: 'texto-secundario', text: 'Plataforma de Seguimiento de iniciativas.' }),
      aviso ? el('p', { class: 'mensaje mensaje--atencion', role: 'status', text: aviso }) : null,
      formulario,
      el('p', { class: 'nota', text: 'Si olvidaste tu contraseña, pídele al administrador que la restablezca.' }),
    ),
  );
}
