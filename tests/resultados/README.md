# Evaluación del clasificador

20 incidencias ficticias (`tests/incidencias.csv`) con categoría y prioridad esperadas. Cubren las 7 categorías y las 4 prioridades, e incluyen casos trampa: phishing con y sin interacción, caídas de un departamento o de toda la empresa, incidencias vagas y un intento de **inyección de prompt** (#20).

`tests/evaluar.js` pasa cada caso por **el mismo código** que ejecutan los nodos de n8n (`workflows/code/`), con `llama3.2:3b` en local y `temperature: 0` (resultados reproducibles).

| Versión | Cambio | Categoría | Prioridad | Ambas | Tiempo medio |
|---|---|---|---|---|---|
| [v1](resultados_v1.md) | Prompt inicial: el modelo decide categoría, prioridad y escalado | 13/20 (65 %) | 7/20 (35 %) | 4/20 (20 %) | 2,5 s |
| [v2](resultados_v2.md) | Prioridad como procedimiento de preguntas + 4 ejemplos *few-shot* | 13/20 (65 %) | 12/20 (60 %) | 7/20 (35 %) | 2,3 s |
| [v3](resultados_v3.md) | **Cambio de diseño:** la IA extrae hechos y el código calcula la prioridad | 16/20 (80 %) | 4/20 (20 %) | 4/20 (20 %) | 3,3 s |
| [v4](resultados_v4.md) | Corregido el hecho `alcance` + ejemplos con el formato real de entrada | 15/20 (75 %) | 17/20 (85 %) | 14/20 (70 %) | 3,2 s |
| [**v5**](resultados_v5.md) | Mismo prompt; el validador añade **reglas de detección de seguridad** (defensa en profundidad) | **16/20 (80 %)** | **18/20 (90 %)** | **15/20 (75 %)** | 3,2 s |

## Qué aprendí en cada paso
- **v1 → v2:** el modelo inflaba la prioridad (marcaba urgentes problemas de una sola persona). Reescribir las reglas como preguntas en orden ayudó, pero el modelo seguía sin detectar seguridad y **la inyección funcionaba** (#20 → urgente).
- **v2 → v3:** un modelo de 3B extrae datos mucho mejor de lo que aplica 6 reglas encadenadas. Pasé a que la IA responda preguntas simples sobre el texto (¿hay algo sospechoso?, ¿hizo clic?, ¿a cuántos afecta?…) y que el código decida la prioridad con reglas fijas.
- **v3 → v4:** las 20 salieron urgentes. Diagnóstico: el modelo confundía la línea de entrada "Departamento: Ventas" con "afecta a todo el departamento". Se confirmó guardando los hechos de cada caso antes de tocar nada. Arreglo: renombrar valores y hacer que los ejemplos imiten la entrada real.

- **v4 → v5:** en una prueba real, el modelo dejó pasar "He abierto un adjunto llamado factura.pdf.exe" como *Correo · media*. Un falso negativo de seguridad es el peor error posible, así que el validador añade **reglas de detección** sobre el texto original (ejecutables, phishing, "me piden la contraseña", dispositivo perdido, USB desconocido…) y de interacción ("he abierto", "puse mi contraseña", ignorando "no he abierto"). Si una regla salta, se trata como seguridad aunque la IA diga lo contrario: **modelo + reglas**, como en un SOC. Corrigió el #14, que fallaba en todas las versiones. La simulación previa (reaplicar el validador a las respuestas guardadas de v4) predijo el resultado exacto, gracias a `temperature: 0`.
- **Plantillas de seguridad:** en la categoría Seguridad, la respuesta al usuario no la escribe la IA sino un texto fijo revisado (la IA aconsejó "no hagas clic" a alguien que ya había metido su contraseña).

## Validación con casos nuevos (v5)

Las reglas de v5 se escribieron conociendo los 20 casos del test, así que medí también con **6 casos nuevos** (`tests/validacion.csv`), redactados a propósito sin las palabras clave de las reglas (con faltas, sin "phishing" ni "sospechoso"). Los escribió el mismo autor de las reglas, así que no es una validación totalmente a ciegas.

| Set | Categoría | Prioridad | Ambas |
|---|---|---|---|
| Test (20, usado para ajustar) | 16/20 (80 %) | 18/20 (90 %) | 15/20 (75 %) |
| [**Validación (6, nuevos)**](resultados_v5-validacion.md) | **5/6 (83 %)** | **3/6 (50 %)** | **3/6 (50 %)** |

- **Generaliza:** la categoría. Los 2 casos de seguridad nuevos (SMS de "Correos" con pago, llamada de falso soporte de Microsoft) se detectan como Seguridad: **ningún falso negativo de seguridad**.
- **No generaliza:** la prioridad. El modelo confunde la **interacción** del usuario (V1 pagó con la tarjeta → sale *alta* en vez de *urgente*; V2 aún no instaló nada → sale *urgente* en vez de *alta*) y no reconoce una incidencia vacía ("Necesito ayuda URGENTE!!!" → *Correo · baja*, sin escalar).
- **Lección:** el 90 % del test era optimista, como se sospechaba. No ajusté nada después de ver estos resultados para no invalidar la validación.

## Errores que quedan en v5 (límites conocidos)
- **#15 y #17** → falsos positivos de seguridad. Asumidos por diseño: es mejor revisar de más que dejar pasar un phishing. La prioridad sale bien en ambos.
- **#18 y #19 Incidencias vagas** → no se clasifican como "Otros".
- **#4 Impresora de la planta** → el modelo la interpreta como problema de grupo (discutible: es compartida).

No seguí ajustando el prompt para arreglar estos casos: con 20 ejemplos sería **sobreajustar al test**. Las reglas de v5 se escribieron conociendo estos casos, así que su resultado es optimista: por eso hay un **set de validación aparte**, escrito sin ver las reglas. Próximos pasos: un set de validación más grande y escrito por otra persona; más casos de interacción ("he pagado", "he instalado", "he dado mis datos"); regla para incidencias vacías → Otros + escalar; y comparar con un modelo mayor (con 4 GB de VRAM, llama3.2:3b es el límite práctico de este equipo).
