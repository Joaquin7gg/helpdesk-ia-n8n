# Evaluación · prompt v5-validacion

- Fecha: 2026-11-11
- Casos: `tests/validacion.csv`
- Modelo: llama3.2:3b · temperature 0
- **Categoría: 5/6 (83 %)** · **Prioridad: 3/6 (50 %)** · **Ambas: 3/6 (50 %)**
- Respuestas que no pasaron la validación (revisar a mano): 0/6
- Tiempo medio por incidencia: 3286 ms

| # | Incidencia | Categoría esperada | Categoría IA | Prioridad esperada | Prioridad IA |
|---|---|---|---|---|---|
| V1 | Me a llegado un sms de correos que tenia un paquete retenido… | Seguridad | Seguridad ✅ | urgente | alta ❌ |
| V2 | Me ha llamado un tal Javier diciendo que es del soporte de M… | Seguridad | Seguridad ✅ | alta | urgente ❌ |
| V3 | No me acuerdo de la contraseña del ordenador y no puedo entr… | Cuentas y accesos | Cuentas y accesos ✅ | alta | alta ✅ |
| V4 | La pantalla del portátil parpadea de vez en cuando. De momen… | Hardware | Hardware ✅ | media | media ✅ |
| V5 | Se ha caído el wifi en toda la planta de Administración, nin… | Red y conexión | Red y conexión ✅ | urgente | urgente ✅ |
| V6 | Necesito ayuda URGENTE!!! | Otros | Correo ❌ | media | baja ❌ |
