const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const { GoogleGenAI } = require('@google/genai');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

if (!process.env.GEMINI_API_KEY) {
  console.error('Falta la variable de entorno GEMINI_API_KEY.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Escribe aquí los números que el bot debe ignorar.
// Usa código de país y solo dígitos, sin +, espacios ni guiones.
// Ejemplo para México: 5215512345678
const numerosExcluidos = [
  // '5215512345678'
].map(numero => numero.replace(/\D/g, ''));

const promptSistema = `
Eres el asistente virtual comercial de un negocio de distribución y preventa de bebidas.
Atiendes con calidez, respeto, empatía y profesionalismo.
- Saluda de forma natural y usa emojis con moderación (✨, 🤝, 🥤, 😊).
- Si es oportuno, explica brevemente que eres el asistente virtual del equipo.
- Pregunta qué necesita el cliente y qué producto o presentación busca.
- No inventes precios, existencias, promociones, rutas, horarios ni condiciones comerciales.
- Si te piden datos que no se proporcionaron, indica amablemente que el equipo comercial debe confirmarlos.
- Mantén las respuestas claras, útiles y breves.
- No solicites contraseñas, códigos de verificación ni datos bancarios.
`;

function obtenerTexto(mensaje) {
  const contenido = mensaje.message;
  if (!contenido) return '';

  return (
    contenido.conversation ||
    contenido.extendedTextMessage?.text ||
    contenido.imageMessage?.caption ||
    contenido.videoMessage?.caption ||
    contenido.documentMessage?.caption ||
    contenido.buttonsResponseMessage?.selectedDisplayText ||
    contenido.listResponseMessage?.title ||
    ''
  ).trim();
}

function esNumeroExcluido(remoteJid) {
  const numero = (remoteJid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  return numerosExcluidos.includes(numero);
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async () => undefined
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nEscanea este QR desde WhatsApp > Dispositivos vinculados:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Bot de ventas conectado a WhatsApp.');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log('Conexión cerrada.', shouldReconnect
        ? 'Intentando reconectar...'
        : 'Sesión cerrada. Elimina la sesión local solo si deseas vincular de nuevo.');

      if (shouldReconnect) {
        setTimeout(() => connectToWhatsApp().catch(error => {
          console.error('No se pudo reconectar:', error.message);
        }), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg?.message || msg.key?.fromMe) continue;

      const remoteJid = msg.key.remoteJid || '';

      // Ignorar grupos, estados y mensajes de difusión.
      if (
        remoteJid.endsWith('@g.us') ||
        remoteJid === 'status@broadcast' ||
        remoteJid.endsWith('@broadcast') ||
        esNumeroExcluido(remoteJid)
      ) continue;

      const mensajeCliente = obtenerTexto(msg);
      if (!mensajeCliente) continue;

      console.log(`📩 Mensaje recibido de ${remoteJid}`);

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: mensajeCliente,
          config: {
            systemInstruction: promptSistema,
            temperature: 0.6,
            maxOutputTokens: 400
          }
        });

        const respuestaIA = response.text?.trim() ||
          '¡Hola! 😊 Gracias por escribirnos. ¿En qué podemos apoyarte con tu negocio?';

        await sock.sendMessage(remoteJid, { text: respuestaIA });
        console.log(`✅ Respuesta enviada a ${remoteJid}`);
      } catch (error) {
        console.error('Error al generar o enviar la respuesta:', error.message);
      }
    }
  });
}

connectToWhatsApp().catch(error => {
  console.error('No se pudo iniciar el bot:', error);
  process.exit(1);
});
