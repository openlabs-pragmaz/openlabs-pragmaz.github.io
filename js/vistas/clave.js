import { el, pintar, avisar, mensajeError } from '../ui.js?v=202610132104';
import { cambiarClave, cerrarSesion } from '../sesion.js?v=202610132104';
import { CLAVE_LARGO_MINIMO } from '../config.js?v=202610132104';

// obligatoria = primer ingreso con la contraseña temporal: no hay otra pantalla disponible.
export function vistaClave(contenedor, { obligatoria = false, alTerminar }) {
  const error = el('p', { class: 'mensaje mensaje--error', id: 'clave-error', role: 'alert', hidden: true });
  const actual = campoClave('clave-actual', 'current-password');
  const nueva = campoClave('clave-nueva', 'new-password', 'clave-reglas');
  const repetir = campoClave('clave-repetir', 'new-password');

  const reglas = [
    { texto: `${CLAVE_LARGO_MINIMO} caracteres o más`, cumple: (v) => v.length >= CLAVE_LARGO_MINIMO },
    // Supabase ("letters and digits") cuenta solo letras de la A a la Z, sin tildes ni ñ.
    { texto: 'Al menos una letra (de la A a la Z)', cumple: (v) => /[A-Za-z]/.test(v) },
    { texto: 'Al menos un dígito', cumple: (v) => /\d/.test(v) },
  ].map((regla) => ({ ...regla, nodo: el('li', { text: regla.texto }) }));
  const listaReglas = el('ul', { class: 'reglas', id: 'clave-reglas' }, reglas.map((r) => r.nodo));

  nueva.addEventListener('input', () => {
    for (const regla of reglas) {
      const ok = regla.cumple(nueva.value);
      regla.nodo.classList.toggle('reglas__ok', ok);
      regla.nodo.textContent = `${ok ? 'Cumple: ' : ''}${regla.texto}`;
    }
  });

  const guardar = el('button', { type: 'submit', class: 'boton boton--principal' }, 'Guardar contraseña');
  const acciones = el('div', { class: 'acciones' }, guardar,
    obligatoria
      ? el('button', { type: 'button', class: 'boton boton--secundario', onclick: () => cerrarSesion() }, 'Salir')
      : el('a', { class: 'boton boton--secundario', href: '#/' }, 'Cancelar'));

  const formulario = el('form', { class: 'formulario', novalidate: true, 'aria-describedby': 'clave-error' },
    el('div', { class: 'campo' }, el('label', { for: 'clave-actual', text: 'Contraseña actual' }), actual),
    el('div', { class: 'campo' },
      el('label', { for: 'clave-nueva', text: 'Contraseña nueva' }), nueva, listaReglas),
    el('div', { class: 'campo' }, el('label', { for: 'clave-repetir', text: 'Repite la contraseña nueva' }), repetir),
    error,
    acciones,
  );

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    error.hidden = true;
    const problema = revisar();
    if (problema) {
      mostrarError(problema.texto);
      problema.campo.focus();
      return;
    }
    guardar.disabled = true;
    guardar.textContent = 'Guardando…';
    try {
      await cambiarClave(actual.value, nueva.value);
      avisar('Listo: tu contraseña quedó cambiada.');
      alTerminar();
    } catch (e) {
      mostrarError(mensajeError(e));
      guardar.disabled = false;
      guardar.textContent = 'Guardar contraseña';
    }
  });

  function revisar() {
    if (!actual.value) return { texto: 'Escribe tu contraseña actual.', campo: actual };
    if (reglas.some((r) => !r.cumple(nueva.value))) {
      return { texto: `La contraseña nueva necesita ${CLAVE_LARGO_MINIMO} caracteres o más, con letras y dígitos.`, campo: nueva };
    }
    if (nueva.value === actual.value) return { texto: 'La contraseña nueva tiene que ser distinta de la actual.', campo: nueva };
    if (nueva.value !== repetir.value) return { texto: 'Las dos contraseñas nuevas no coinciden.', campo: repetir };
    return null;
  }

  function mostrarError(texto) {
    error.textContent = texto;
    error.hidden = false;
  }

  pintar(contenedor,
    el('section', { class: 'tarjeta tarjeta--angosta', 'aria-labelledby': 'clave-titulo' },
      el('h1', { id: 'clave-titulo', text: obligatoria ? 'Cambia tu contraseña temporal' : 'Cambiar contraseña' }),
      obligatoria
        ? el('p', { class: 'texto-secundario', text: 'Es tu primer ingreso. Antes de seguir, elige una contraseña que solo tú conozcas.' })
        : null,
      formulario,
    ),
  );
}

function campoClave(id, autocompletar, describe) {
  return el('input', {
    id, name: id, type: 'password', autocomplete: autocompletar, required: true,
    'aria-describedby': describe,
  });
}
