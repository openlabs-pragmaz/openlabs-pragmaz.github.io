import { el, campo, selector, conBoton, errorEn, errorCampo, mensajeError, avisar, formatoFecha } from '../ui.js?v=202610131530';
import { cambiarEstadoDatos } from '../datos.js?v=202610131530';
import {
  SEMAFOROS, textoSemaforo, motivosSemaforo, textoTiposDatos, ORIGEN_DATOS, ENVIO_EXTERNO,
} from '../etiquetas.js?v=202610131530';

// Semáforo de uso de datos (Registro v3). Lo ven y lo cambian admin y
// facilitador; la base guarda cada cambio a mano con quién, cuándo y por qué.

// Pastilla con punto y texto: el color nunca va solo.
export function pastillaSemaforo(valor, texto = textoSemaforo(valor)) {
  return el('span', { class: `semaforo semaforo--${valor ?? 'ninguno'}`, text: valor ? texto : 'Sin color' });
}

// Bajo la pastilla en la tabla: el motivo del último cambio (a mano, o automático por un Avance), si
// lo hubo; si no, el primer motivo que calculó la base con las respuestas del Registro.
export function notaSemaforo(ini, cambio) {
  if (cambio) {
    return el('span', { class: 'celda__nota', text: cambio.cambiado_por ? `Cambiado a mano: ${cambio.motivo}` : sinColor(cambio.motivo) });
  }
  const lista = motivosSemaforo(ini);
  if (!lista.length) return null;
  return el('span', { class: 'celda__nota', text: lista.length > 1 ? `${lista[0]} (y ${lista.length - 1} más)` : lista[0] });
}

// Los motivos automáticos llegan como "Amarillo: Avance del …": en pantalla, sin el color delante.
const sinColor = (motivo) => motivo.replace(/^(Rojo|Amarillo|Verde con registro|Verde):\s*/, '');

// Sección "Uso responsable" de la ficha: color, motivos, respuestas del Registro y cambios de color.
//   cambios: de cambiosEstadoDatos(ini.id), o null si no se pudieron cargar. Sin persona = automático
//            (un Avance que dijo "Cambió el tipo de información").
//   nombres: Map usuario → nombre (nombresEquipo).
//   entradas: bitácora (para comparar los tipos de C2 con los del Registro).
export function seccionUsoDatos(ini, cambios, nombres, { recargar, entradas = [] }) {
  const color = ini.estado_datos;
  const lista = motivosSemaforo(ini);
  const quien = (c) => (c.cambiado_por ? nombres.get(c.cambiado_por) ?? 'Alguien del equipo' : 'Automático');
  // El último cambio, si fue a mano (uno automático ya está en la lista de motivos).
  const ultimo = cambios?.[0]?.cambiado_por ? cambios[0] : null;
  // C2 del Avance: los tipos con que trabaja, frente a los del Registro. No cambia el color: avisa.
  const c2 = entradas.find((e) => e.tipos_datos?.length);
  const nuevos = c2 ? c2.tipos_datos.filter((t) => t !== 'ninguno' && !(ini.tipos_datos ?? []).includes(t)) : [];
  const pares = [
    ['Tipos de información', textoTiposDatos(ini.tipos_datos)],
    c2 ? [`Con qué datos trabaja (Avance del ${formatoFecha(c2.fecha)})`, textoTiposDatos(c2.tipos_datos)] : null,
    ['Autorización de la jefatura', ini.autorizacion_jefatura
      ? `Declaró que la tiene (${formatoFecha(ini.fecha_autorizacion, { conHora: true })})` : 'No la marcó'],
    ['Correo de la jefatura directa', ini.participante?.jefatura_correo],
    ['De dónde tomará los datos', ORIGEN_DATOS[ini.origen_datos] ?? ini.origen_datos],
    ['¿Enviará información fuera de su área?', ENVIO_EXTERNO[ini.envio_externo] ?? ini.envio_externo],
    ['Declaración de uso', ini.declaracion_uso ? `Aceptada (${formatoFecha(ini.fecha_declaracion, { conHora: true })})` : 'No la aceptó'],
  ];
  // Si se cambió a mano, los motivos son los del color que calculó la base, y van con ese color.
  const calculado = ini.estado_datos_calculado ?? color;
  const aMano = calculado !== color;

  const bloque = el('section', { class: 'tarjeta uso-datos', 'aria-labelledby': 'uso-datos-titulo' },
    el('div', { class: 'uso-datos__cabecera' },
      el('h2', { id: 'uso-datos-titulo' }, 'Uso responsable', pastillaSemaforo(color))),
    aMano && lista.length
      ? el('p', { class: 'texto-secundario', text: `Con las respuestas del Registro le correspondía ${textoSemaforo(calculado)}, por:` })
      : null,
    lista.length
      ? el('ul', { class: `uso-datos__motivos uso-datos__motivos--${calculado}`, 'aria-label': aMano ? 'Motivos del color calculado' : 'Por qué tiene este color' },
          lista.map((m) => el('li', { text: m })))
      : null,
    ultimo
      ? el('p', { class: 'mensaje uso-datos__cambio' },
          // Solo lo relevante; quién y cuándo quedan en el historial.
          'Motivo del cambio a mano: ',
          el('span', { class: 'texto-libre', text: ultimo.motivo }))
      : null,
    nuevos.length
      ? el('p', { class: 'mensaje mensaje--atencion' },
          `En su Avance del ${formatoFecha(c2.fecha)} marcó tipos que no declaró en el Registro: ${textoTiposDatos(nuevos)}. `
          + 'El color no cambia solo: revisa si corresponde cambiarlo.')
      : null,
    el('dl', { class: 'datos' },
      pares.filter((par) => par && par[1]).flatMap(([etiqueta, valor]) => [
        el('dt', { text: etiqueta }), el('dd', { class: 'texto-libre', text: valor }),
      ])),
    cambios === null
      ? el('p', { class: 'mensaje mensaje--error', role: 'alert', text: 'No se pudo cargar el historial de cambios del color.' })
      : null,
    cambios?.length
      ? el('details', { class: 'desplegable' },
          el('summary', { text: `Historial de cambios del color (${cambios.length})` }),
          el('ul', { class: 'uso-datos__historial' }, cambios.map((c) => el('li', {},
            `${formatoFecha(c.cambiado_en, { conHora: true })} · ${quien(c)}: ${textoSemaforo(c.anterior)} → ${textoSemaforo(c.nuevo)}. `,
            el('span', { class: 'texto-libre', text: sinColor(c.motivo) })))))
      : null,
    formularioCambio(ini, recargar));
  return bloque;
}

// "Cambiar color": el color nuevo y el motivo, obligatorio. Queda guardado quién y cuándo.
function formularioCambio(ini, recargar) {
  const color = selector(SEMAFOROS.filter((s) => s.valor !== ini.estado_datos), '');
  const motivo = el('textarea', { rows: 2, required: true });
  const boton = el('button', { type: 'submit', class: 'boton boton--principal', id: `cambiar-color-${ini.id}` }, 'Guardar el color');
  const formulario = el('form', { novalidate: true },
    el('div', { class: 'rejilla' },
      campo(`color-${ini.id}`, 'Color nuevo', color),
      campo(`color-${ini.id}-motivo`, 'Motivo', motivo, 'Por ejemplo: «La jefatura confirmó que usará datos anonimizados». Queda guardado con tu nombre y la fecha.')),
    el('div', { class: 'acciones' }, boton));
  formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn(formulario, null);
    if (!motivo.value.trim()) { errorCampo(motivo, 'Escribe el motivo del cambio.'); return; }
    try {
      await conBoton(boton, 'Guardando…', () => cambiarEstadoDatos(ini.id, color.value, motivo.value.trim()));
      avisar(`${ini.codigo} quedó en ${textoSemaforo(color.value)}.`);
      recargar();
    } catch (err) {
      errorEn(formulario, mensajeError(err));
    }
  });
  return el('details', { class: 'desplegable', id: 'cambiar-color' },
    el('summary', { text: 'Cambiar color' }),
    formulario);
}
