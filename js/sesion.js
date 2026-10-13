import { supabase } from './cliente.js?v=202610131530';

// Perfil de quien usa la plataforma. El rol solo decide qué botones y menús se muestran:
// lo que cada quien puede ver o cambiar lo decide la base (RLS).
let perfil = null;

export function perfilActual() {
  return perfil;
}

export async function iniciarSesion(correo, clave) {
  const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
  if (error) throw error;
  return cargarPerfil();
}

// null = sin sesión. { sinAcceso: true } = tiene cuenta pero no una fila activa en equipo.
export async function cargarPerfil() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    perfil = null;
    return null;
  }
  // getUser consulta al servidor: confirma que la sesión sigue siendo válida.
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    if (error.status === 401 || error.status === 403 || error.name === 'AuthSessionMissingError') {
      await supabase.auth.signOut({ scope: 'local' });
      perfil = null;
      return null;
    }
    throw error;
  }

  const { data: fila, error: errorEquipo } = await supabase
    .from('equipo')
    .select('nombre, correo, rol, visibilidad_total, elige_mvp')
    .eq('usuario_id', user.id)
    .maybeSingle();
  if (errorEquipo) throw errorEquipo;
  // Áreas asignadas (observador o soporte): con áreas en una empresa, ve solo esas y sus subáreas.
  const { data: areas, error: errorAreas } = fila
    ? await supabase.from('usuario_area').select('area_id').eq('usuario_id', user.id)
    : { data: [] };
  if (errorAreas) throw errorAreas;

  perfil = fila
    ? {
        usuarioId: user.id,
        nombre: fila.nombre,
        correo: fila.correo,
        rol: fila.rol,
        visibilidadTotal: fila.visibilidad_total,
        areas: (areas ?? []).map((a) => a.area_id),
        // Puede marcar "Seleccionada para MVP Day" (además del admin). La base lo vuelve a comprobar.
        eligeMvp: fila.rol === 'admin' || fila.elige_mvp === true,
        // Marca de comodidad, no de seguridad: la pone el front al cambiar la contraseña temporal.
        claveCambiada: user.user_metadata?.clave_cambiada === true,
      }
    : { usuarioId: user.id, correo: user.email, sinAcceso: true };
  return perfil;
}

// Con "Require current password" encendido en Supabase, la contraseña actual es obligatoria.
// Cambiar la contraseña con la sesión abierta no envía correos.
export async function cambiarClave(actual, nueva) {
  const { error } = await supabase.auth.updateUser({
    password: nueva,
    current_password: actual,
    data: { clave_cambiada: true },
  });
  if (error) throw error;
  if (perfil) perfil.claveCambiada = true;
}

export async function cerrarSesion() {
  perfil = null;
  await supabase.auth.signOut();
}

// Las pestañas comparten la sesión. Si en otra pestaña se sale, o se entra con otro usuario,
// esta vuelve al inicio de sesión: no sigue mostrando los menús y los datos del
// usuario anterior. No cierra la sesión nueva: solo deja de usarla aquí hasta volver a entrar.
export function alCerrarSesion(funcion) {
  supabase.auth.onAuthStateChange((evento, sesion) => {
    if (evento === 'SIGNED_OUT') {
      perfil = null;
      funcion(null);
    } else if (perfil && sesion && sesion.user.id !== perfil.usuarioId) {
      perfil = null;
      funcion('Se entró con otro usuario en otra pestaña. Inicia sesión de nuevo para seguir.');
    }
  });
}
