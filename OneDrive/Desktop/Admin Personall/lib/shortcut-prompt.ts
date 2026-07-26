export const AUTOMATION_BASE_URL = "https://la-pesadilla-finanzas.vercel.app";
export const PARSE_TRANSACTION_ENDPOINT = `${AUTOMATION_BASE_URL}/api/parse-transaction`;
export const AUTOMATION_TEST_ENDPOINT = `${AUTOMATION_BASE_URL}/api/automations/test`;

export function shortcutRequestJson() {
  return JSON.stringify(
    {
      text: "Texto dictado",
      source: "siri",
      timezone: "America/Montevideo",
      dryRun: false,
      defaultCurrency: "UYU",
      idempotencyKey: "UUID nuevo en cada ejecución",
    },
    null,
    2
  );
}

export function buildIosShortcutPrompt(token: string) {
  const authorization = `Bearer ${token}`;
  return `Creá un Atajo de iOS llamado “Registrar movimiento” para mi uso personal. Debe funcionar con Siri y registrar frases como “Gasté 850 pesos en combustible con Itaú”, “Compré un perfume por 2890”, “Cobré 38600 pesos de sueldo”, “Transferí 200 dólares de Itaú a Scotia”, “Presté 500 pesos a Juan”, “Juan me devolvió 300” y “Ahorré 200 dólares”.

Configurá exactamente esta lógica, sin cambiar la URL, método, headers ni nombres de campos:

1. Agregá la acción “Dictar texto” y guardá el resultado como Texto dictado.
2. Agregá la acción “Generar UUID” en cada ejecución y guardalo como IdempotencyKey. No reutilices un UUID de una ejecución anterior: debe ser un UUID nuevo por cada intento del atajo.
3. Agregá “Obtener contenido de URL” con estas opciones:
   - URL: ${PARSE_TRANSACTION_ENDPOINT}
   - Método: POST
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
   No envíes un campo shortcutName: este endpoint no lo admite.
4. Convertí la respuesta en diccionario y obtené el campo message.
5. Si success es verdadero, usá “Hablar texto” con message.
6. Si requiresConfirmation es verdadero y existe confirmationUrl, preguntá “¿Querés abrir la confirmación?”. Si respondo que sí, abrí confirmationUrl. Igual leé message antes de preguntar.
7. Si success no es verdadero, obtené error y usá “Hablar texto” con error. Si error no existe, decí “No se pudo registrar el movimiento”.
8. Si no existe una respuesta válida o falla la conexión, decí “No se pudo conectar con LaPesadilla Finanzas”.

La respuesta exitosa contiene success, requiresConfirmation, transaction y message. Cuando requiere confirmación también contiene confirmationId y confirmationUrl. El campo de voz es message. El endpoint de prueba de conexión es ${AUTOMATION_TEST_ENDPOINT}, usa GET o POST con el mismo header Authorization y devuelve success y message.`;
}
