# Bot de ventas para WhatsApp

Bot de atención comercial con WhatsApp Web (Baileys) y Gemini.

## Requisitos
- Node.js 20 o superior.
- Una clave de API de Gemini.
- Un número de WhatsApp para vincular el bot.

## Configuración local
1. Instala las dependencias:
   `npm install`
2. Configura la variable de entorno `GEMINI_API_KEY` con tu clave de Gemini. No la escribas en el código ni la subas a GitHub.
3. Inicia el bot:
   `npm start`
4. Escanea el QR desde WhatsApp > Dispositivos vinculados.

La sesión se guarda en `auth_info_baileys/`; esa carpeta está excluida de Git.

## Despliegue en Koyeb
- Usa un servicio de tipo Worker/servicio que mantenga el proceso activo.
- Configura `GEMINI_API_KEY` como variable de entorno secreta.
- Ejecuta `npm start`.
- Asegúrate de contar con almacenamiento persistente para `auth_info_baileys/`; si el sistema de archivos se reinicia sin persistencia, tendrás que vincular WhatsApp otra vez.

## Exclusiones
Edita `numerosExcluidos` en `index.js` y agrega números internacionales solo con dígitos, sin el signo +. El bot ignora grupos y los números incluidos en esa lista.

## Consideraciones
- No se responden mensajes sin texto reconocido.
- El bot no debe inventar precios ni disponibilidad; confirma esos datos con el equipo comercial.
- Usa la automatización de acuerdo con las condiciones de WhatsApp y las reglas aplicables a mensajes comerciales.
