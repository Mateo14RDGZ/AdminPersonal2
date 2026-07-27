export const AUTOMATION_BASE_URL = "https://la-pesadilla-finanzas.vercel.app";
export const PARSE_TRANSACTION_ENDPOINT = `${AUTOMATION_BASE_URL}/api/parse-transaction`;
export const AUTOMATION_TEST_ENDPOINT = `${AUTOMATION_BASE_URL}/api/automations/test`;

export function shortcutRequestJson() {
  return JSON.stringify({ text: "Texto dictado", source: "siri", timezone: "America/Montevideo", dryRun: false, defaultCurrency: "UYU", idempotencyKey: "UUID nuevo en cada ejecucion" }, null, 2);
}

export function buildIosShortcutPrompt(token: string) {
  const authorization = `Bearer ${token}`;
  return `Crea un Atajo de iOS llamado "Registrar movimiento" para mi uso personal. Debe funcionar con Siri y registrar unicamente gastos o ingresos. Admite frases como "Gaste 850 pesos en combustible con Itau", "Compre un perfume por 2890" y "Cobre 38600 pesos de sueldo". No intentes crear cuentas, transferencias, prestamos, tarjetas, metas ni ahorros: esas acciones se hacen desde la app.

Configura exactamente esta logica, sin cambiar la URL, metodo, headers ni nombres de campos:

1. Agrega la accion "Dictar texto" en espanol (Uruguay) y guarda el resultado como Texto dictado.
2. Agrega la accion "Generar UUID" en cada ejecucion y guardalo como IdempotencyKey. No reutilices un UUID de una ejecucion anterior: debe ser un UUID nuevo por cada intento del atajo.
3. Agrega "Obtener contenido de URL" con estas opciones:
   - URL: ${PARSE_TRANSACTION_ENDPOINT}
   - Metodo: POST
   - Headers:
     - Authorization: ${authorization}
     - Content-Type: application/json
   - Cuerpo: JSON
     {
       "text": Texto dictado,
       "source": "siri",
       "timezone": "America/Montevideo",
       "dryRun": false,
       "defaultCurrency": "UYU",
       "idempotencyKey": IdempotencyKey
     }
   No envies un campo shortcutName: este endpoint no lo admite.
4. Convierte la respuesta en diccionario y obtiene el campo message.
5. Si success es verdadero, usa "Hablar texto" con message. Los gastos e ingresos claros se guardan automaticamente, sin una confirmacion extra.
6. Si requiresConfirmation es verdadero y existe confirmationUrl, pregunta si queres abrir la confirmacion. Si respondo que si, abre confirmationUrl. Igual lee message antes de preguntar.
7. Si success no es verdadero, obtiene error y usa "Hablar texto" con error. Si error no existe, di "No se pudo registrar el movimiento".
8. Si no existe una respuesta valida o falla la conexion, di "No se pudo conectar con LaPesadilla Finanzas".

La respuesta exitosa contiene success, requiresConfirmation, transaction y message. Cuando requiere confirmacion tambien contiene confirmationId y confirmationUrl. El campo de voz es message. El endpoint de prueba de conexion es ${AUTOMATION_TEST_ENDPOINT}, usa GET o POST con el mismo header Authorization y devuelve success y message.`;
}
