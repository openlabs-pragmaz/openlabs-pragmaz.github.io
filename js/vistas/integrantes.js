import { el, campo, conBoton, errorEn, errorCampo, mensajeError, avisar, formatoFecha, insignia } from '../ui.js?v=202610121404';
import { agregarIntegrante, quitarIntegrante } from '../datos.js?v=202610121404';
import { ROL_EQUIPO } from '../etiquetas.js?v=202610121404';

// Integrantes de la iniciativa: una iniciativa puede ser de una persona o de un
// grupo, sin líder. Cualquier integrante envía el Avance y la Consulta; su correo identifica la
// iniciativa. Quien llenó el Registro queda como referencia. Admin y facilitador agregan (correo
// y nombre) y quitan (con nota); quitar no borra: la persona pasa a "Quitados" con la nota.
//   integrantes: de integrantesDe(), o null si no se pudieron cargar.
export function seccionIntegrantes(ini, integrantes, { operador, recargar }) {
  const titulo = (n) => el('h2', { id: 'integrantes-titulo', text: n > 1 ? `Integrantes (${n})` : 'Integrantes' });
  const seccion = (...hijos) => el('section', { class: 'tarjeta integrantes', 'aria-labelledby': 'integrantes-titulo' }, ...hijos);
  if (!integrantes) {
    return seccion(titulo(0), el('p', { class: 'mensaje mensaje--error', role: 'alert', text: 'No se pudieron cargar los integrantes. Vuelve a abrir la ficha en un momento.' }));
  }
  const activos = integrantes.filter((g) => g.activo);
  const quitados = integrantes.filter((g) => !g.activo);
  const autor = ini.participante.id;
  const nombre = (g) => g.nombre || g.participante?.nombre || 'Sin nombre';

  const fila = (g) => {
    const datos = el('div', { class: 'integrante__datos' },
      el('span', { class: 'integrante__nombre' }, nombre(g),
        // Registro v3: quien registra coordina. Antes, solo se sabía quién llenó el Registro.
        g.rol === 'coordinador' ? [' ', insignia('Coordina')]
          : g.participante_id === autor ? [' ', insignia('Llenó el Registro')] : null),
      g.participante?.correo ? el('span', { class: 'integrante__correo', text: g.participante.correo }) : null,
      g.rol_equipo ? el('span', { class: 'integrante__correo', text: `Rol en el equipo: ${ROL_EQUIPO[g.rol_equipo] ?? g.rol_equipo}` }) : null);
    // El único integrante no se quita (la base lo rechaza): se desactiva la iniciativa.
    const accion = operador && activos.length > 1 ? botonQuitar(ini, g, nombre(g), recargar) : null;
    return el('li', { class: 'integrante' }, datos, accion);
  };

  return seccion(
    titulo(activos.length),
    // Registro v3: el nombre del equipo y si junta áreas o empresas.
    ini.equipo_nombre
      ? el('p', { class: 'integrantes__equipo' }, el('strong', { text: `Equipo «${ini.equipo_nombre}»` }),
          ini.equipo_transversal ? ' · con personas de otras áreas o de la otra empresa' : null)
      : null,
    el('p', { class: 'texto-secundario', text: activos.length > 1
      ? 'Cualquiera de ellos puede enviar el Avance y la Consulta: su correo identifica la iniciativa.'
      : 'Iniciativa individual. Si es de un grupo, agrega a las demás personas con su correo.' }),
    el('ul', { class: 'integrantes__lista' }, activos.map(fila)),
    quitados.length
      ? el('details', { class: 'desplegable' },
          el('summary', { text: `Quitados del grupo (${quitados.length})` }),
          el('ul', { class: 'integrantes__lista' }, quitados.map((g) => el('li', { class: 'integrante integrante--quitado' },
            el('div', { class: 'integrante__datos' },
              el('span', { class: 'integrante__nombre', text: nombre(g) }),
              g.participante?.correo ? el('span', { class: 'integrante__correo', text: g.participante.correo }) : null,
              el('span', { class: 'integrante__nota texto-libre', text: `${formatoFecha(g.quitado_en, { conHora: true })}: ${g.nota || 'sin nota'}` }))))))
      : null,
    operador ? formularioAgregar(ini, recargar) : null);
}

// "Quitar" abre en su lugar la nota obligatoria (por qué se quita) y la confirmación.
function botonQuitar(ini, g, nombre, recargar) {
  const zona = el('div', { class: 'integrante__accion' });
  const abrir = el('button', { type: 'button', class: 'boton-en-texto', 'aria-label': `Quitar a ${nombre} del grupo` }, 'Quitar');
  const nota = el('input', { type: 'text', required: true });
  const confirmar = el('button', { type: 'submit', class: 'boton boton--secundario', id: `quitar-${g.participante_id}` }, 'Quitar del grupo');
  const cancelar = el('button', { type: 'button', class: 'boton boton--texto' }, 'Cancelar');
  const formulario = el('form', { class: 'integrante__quitar', novalidate: true, hidden: true },
    campo(`quitar-${g.participante_id}-nota`, `Por qué se quita a ${nombre}`, nota, 'Queda guardado con la fecha. Sus Avances anteriores se conservan.'),
    el('div', { class: 'acciones' }, confirmar, cancelar));
  abrir.addEventListener('click', () => { abrir.hidden = true; formulario.hidden = false; nota.focus(); });
  cancelar.addEventListener('click', () => { formulario.hidden = true; abrir.hidden = false; errorEn(formulario, null); abrir.focus(); });
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!nota.value.trim()) { errorCampo(nota, 'Escribe por qué se quita.'); return; }
    try {
      await conBoton(confirmar, 'Quitando…', () => quitarIntegrante(ini.id, g.participante_id, nota.value.trim()));
      avisar(`${nombre} ya no está en el grupo de ${ini.codigo}.`);
      recargar();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  zona.append(abrir, formulario);
  return zona;
}

// Agregar con correo y nombre: para un integrante que faltó en la lista o un correo mal escrito.
function formularioAgregar(ini, recargar) {
  const correo = el('input', { type: 'email', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'none' });
  const nombre = el('input', { type: 'text', autocomplete: 'off' });
  const boton = el('button', { type: 'submit', id: 'agregar-integrante', class: 'boton boton--principal' }, 'Agregar al grupo');
  const formulario = el('form', { novalidate: true },
    el('div', { class: 'rejilla' },
      campo('integrante-correo', 'Correo', correo, 'El correo con que responde los formularios.'),
      campo('integrante-nombre', 'Nombre', nombre, 'Obligatorio si la persona todavía no está registrada.')),
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo.value.trim())) { errorCampo(correo, 'Escribe un correo válido.'); return; }
    try {
      const res = await conBoton(boton, 'Agregando…', () => agregarIntegrante(ini.id, correo.value.trim(), nombre.value.trim()));
      avisar(`${res?.correo ?? correo.value.trim()} ahora es integrante de ${ini.codigo}. Sus Avances y Consultas llegarán a esta iniciativa.`);
      recargar();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('details', { class: 'desplegable', id: 'integrante-agregar' },
    el('summary', { text: 'Agregar un integrante' }),
    formulario);
}
