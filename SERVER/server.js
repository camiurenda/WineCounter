const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      // Permitir localhost, dominios de vercel.app y el dominio específico
      const allowedOrigins = [
        'http://localhost:5500',
        'http://localhost:3000',
        'https://wine-counter.vercel.app'
      ];

      if (!origin ||
          allowedOrigins.includes(origin) ||
          origin.includes('localhost') ||
          origin.includes('.vercel.app')) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS bloqueado para origen: ${origin}`);
        callback(null, false);
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket.io/',
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true, // Compatibilidad con versiones antiguas
  cookie: false, // Importante para múltiples instancias en Render
  serveClient: false // No servir el cliente Socket.IO desde el servidor
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Permitir localhost, dominios de vercel.app y el dominio específico
    const allowedOrigins = [
      'http://localhost:5500',
      'http://localhost:3000',
      'https://wine-counter.vercel.app'
    ];

    if (!origin ||
        allowedOrigins.includes(origin) ||
        origin.includes('localhost') ||
        origin.includes('.vercel.app')) {
      callback(null, true);
    } else {
      console.warn(`⚠️ HTTP CORS bloqueado para origen: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true
}));
app.use(express.json());

// Solo servir archivos estáticos en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static('../CLIENT'));
}

// Configuración MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'winecounter';
const COLLECTION_NAME = 'wines';

let db;
let winesCollection;

// Datos iniciales de vinos
const INITIAL_WINES = [
  "Malbec",
  "Cabernet Sauvignon",
  "Merlot",
  "Syrah",
  "Bonarda",
  "Chardonnay",
  "Sauvignon Blanc",
  "Torrontés",
  "Pinot Noir",
  "Rosado"
];

// Conectar a MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    db = client.db(DB_NAME);
    winesCollection = db.collection(COLLECTION_NAME);

    // Inicializar datos si la colección está vacía
    await initializeWines();

    return client;
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
}

// Inicializar vinos si no existen
async function initializeWines() {
  try {
    const count = await winesCollection.countDocuments();

    if (count === 0) {
      console.log('📦 Inicializando base de datos con vinos...');
      const wines = INITIAL_WINES.map((name, index) => ({
        _id: `wine_${index + 1}`,
        name: name,
        glass: 0,
        bottle: 0,
        active: true,
        lastUpdated: new Date()
      }));

      await winesCollection.insertMany(wines);
      console.log('✅ Vinos inicializados');
    } else {
      console.log(`📊 Base de datos ya contiene ${count} vinos`);
      // Actualizar vinos existentes que no tengan el campo active
      await winesCollection.updateMany(
        { active: { $exists: false } },
        { $set: { active: true } }
      );
    }
  } catch (error) {
    console.error('❌ Error inicializando vinos:', error);
  }
}

// === RUTAS API ===

// Obtener todos los vinos activos
app.get('/api/wines', async (req, res) => {
  try {
    const wines = await winesCollection.find({ active: true }).sort({ name: 1 }).toArray();
    res.json(wines);
  } catch (error) {
    console.error('Error obteniendo vinos:', error);
    res.status(500).json({ error: 'Error obteniendo vinos' });
  }
});

// Crear nuevo vino
app.post('/api/wines', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre del vino es requerido' });
    }

    // Verificar si ya existe un vino con ese nombre
    const existingWine = await winesCollection.findOne({ name: name.trim() });
    if (existingWine) {
      return res.status(400).json({ error: 'Ya existe un vino con ese nombre' });
    }

    // Generar ID único
    const count = await winesCollection.countDocuments();
    const newWine = {
      _id: `wine_${Date.now()}`,
      name: name.trim(),
      glass: 0,
      bottle: 0,
      active: true,
      lastUpdated: new Date()
    };

    await winesCollection.insertOne(newWine);

    // Notificar a todos los clientes
    const activeWines = await winesCollection.find({ active: true }).sort({ name: 1 }).toArray();
    io.emit('wines-updated', activeWines);

    res.json(newWine);
  } catch (error) {
    console.error('Error creando vino:', error);
    res.status(500).json({ error: 'Error creando vino' });
  }
});

// Resetear todos los contadores a cero (solo vinos activos)
app.post('/api/wines/reset', async (req, res) => {
  try {
    await winesCollection.updateMany(
      { active: true },
      {
        $set: {
          glass: 0,
          bottle: 0,
          lastUpdated: new Date()
        }
      }
    );

    const wines = await winesCollection.find({ active: true }).sort({ name: 1 }).toArray();

    // Notificar a todos los clientes del reset
    io.emit('wines-updated', wines);

    res.json({ message: 'Contadores reseteados', wines });
  } catch (error) {
    console.error('Error reseteando contadores:', error);
    res.status(500).json({ error: 'Error reseteando contadores' });
  }
});

// === RUTAS ABM DE VINOS ===

// Obtener todos los vinos (incluyendo inactivos) para administración
app.get('/api/wines/admin', async (req, res) => {
  try {
    const wines = await winesCollection.find({}).sort({ name: 1 }).toArray();
    res.json(wines);
  } catch (error) {
    console.error('Error obteniendo vinos:', error);
    res.status(500).json({ error: 'Error obteniendo vinos' });
  }
});

// Editar nombre de un vino
app.put('/api/wines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre del vino es requerido' });
    }

    // Verificar que no exista otro vino con ese nombre
    const existingWine = await winesCollection.findOne({
      name: name.trim(),
      _id: { $ne: id }
    });

    if (existingWine) {
      return res.status(400).json({ error: 'Ya existe un vino con ese nombre' });
    }

    const result = await winesCollection.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          name: name.trim(),
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Vino no encontrado' });
    }

    // Notificar a todos los clientes si el vino está activo
    if (result.value.active) {
      const activeWines = await winesCollection.find({ active: true }).sort({ name: 1 }).toArray();
      io.emit('wines-updated', activeWines);
    }

    res.json(result.value);
  } catch (error) {
    console.error('Error editando vino:', error);
    res.status(500).json({ error: 'Error editando vino' });
  }
});

// Dar de baja un vino (baja lógica)
app.delete('/api/wines/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await winesCollection.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          active: false,
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Vino no encontrado' });
    }

    // Notificar a todos los clientes
    const activeWines = await winesCollection.find({ active: true }).sort({ name: 1 }).toArray();
    io.emit('wines-updated', activeWines);

    res.json({ message: 'Vino dado de baja exitosamente', wine: result.value });
  } catch (error) {
    console.error('Error dando de baja vino:', error);
    res.status(500).json({ error: 'Error dando de baja vino' });
  }
});

// Reactivar un vino
app.put('/api/wines/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await winesCollection.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          active: true,
          lastUpdated: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({ error: 'Vino no encontrado' });
    }

    // Notificar a todos los clientes
    const activeWines = await winesCollection.find({ active: true }).sort({ name: 1 }).toArray();
    io.emit('wines-updated', activeWines);

    res.json({ message: 'Vino reactivado exitosamente', wine: result.value });
  } catch (error) {
    console.error('Error reactivando vino:', error);
    res.status(500).json({ error: 'Error reactivando vino' });
  }
});

// === WEBSOCKETS ===

io.on('connection', (socket) => {
  console.log(`🔌 Cliente conectado: ${socket.id} | Transport: ${socket.conn.transport.name}`);

  // Enviar datos actuales al conectarse (solo vinos activos)
  winesCollection.find({ active: true }).sort({ name: 1 }).toArray()
    .then(initialWines => {
      console.log(`📤 [${socket.id}] Enviando ${initialWines.length} vinos iniciales`);
      socket.emit('wines-updated', initialWines);
    })
    .catch(err => console.error('Error enviando datos iniciales:', err));

  // Listener para actualizar un vino
  socket.on('update-wine', async ({ wineId, type, amount }) => {
    console.log(`📥 [${socket.id}] Recibido update-wine: ${wineId} | ${type} ${amount > 0 ? '+' : ''}${amount}`);

    try {
      // Prevenir valores negativos
      const currentWine = await winesCollection.findOne({ _id: wineId });
      if (!currentWine) {
        console.warn(`⚠️ [${socket.id}] Intento de actualizar vino no existente: ${wineId}`);
        return;
      }
      if (amount < 0 && currentWine[type] <= 0) {
        console.log(`⏭️ [${socket.id}] Ignorando decremento, ya es 0: ${currentWine.name}`);
        return; // No hacer nada si ya es 0
      }

      const result = await winesCollection.findOneAndUpdate(
        { _id: wineId },
        {
          $inc: { [type]: amount },
          $set: { lastUpdated: new Date() }
        },
        { returnDocument: 'after' }
      );

      if (result.value) {
        console.log(`✅ [${socket.id}] Vino actualizado en DB: ${result.value.name} | ${type}: ${result.value[type]}`);

        // Emitir la lista completa actualizada a todos los clientes
        const allWines = await winesCollection.find({ active: true }).sort({ name: 1 }).toArray();
        console.log(`📤 [BROADCAST] Emitiendo wines-updated a ${io.engine.clientsCount} clientes conectados`);
        io.emit('wines-updated', allWines);
        console.log(`✅ [BROADCAST] wines-updated emitido correctamente`);
      }
    } catch (error) {
      console.error(`❌ [${socket.id}] Error en socket update-wine:`, error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });

  // Manejar solicitudes de sincronización manual (si fuera necesario)
  socket.on('request-sync', async () => {
    try {
      console.log(`🔄 Cliente ${socket.id} solicitó sincronización manual.`);
      const wines = await winesCollection.find({ active: true }).sort({ name: 1 }).toArray();
      socket.emit('wines-updated', wines);
    } catch (error) {
      console.error('Error en sincronización:', error);
    }
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

connectToMongoDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📡 WebSockets activos para tiempo real`);
  });
});

// Manejo de cierre gracioso
process.on('SIGINT', async () => {
  console.log('\n👋 Cerrando servidor...');
  process.exit(0);
});
