// Datos públicos del proyecto de Supabase: la dirección y la llave publishable.
// La llave publishable está hecha para ir en el navegador; los datos los protege RLS en la base.
// Aquí nunca va la llave secreta (service_role) ni la contraseña de la base.
export const SUPABASE_URL = 'https://vweyqwbhoynophpzkdss.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_exgZNR3Iv8bqJvZ_ItRlaA_BZ3PTmUU';

export const ZONA_HORARIA = 'America/Managua';

// Reglas de contraseña del proyecto (Authentication → Email). La base las exige igual.
export const CLAVE_LARGO_MINIMO = 10;
