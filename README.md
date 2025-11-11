# Wine Counter - Contador de Vinos para Ferias

Aplicación web en tiempo real para contar ventas de vinos en ferias y eventos.

## Tecnologías

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express, Socket.io
- **Base de datos**: MongoDB
- **Deploy**: Vercel (Frontend) + Render (Backend)

## Estructura del Proyecto

```
WineCounter/
├── CLIENT/          # Frontend (Vercel)
│   ├── index.html   # Página principal - Contador
│   ├── admin.html   # Panel de administración
│   ├── config.js    # Configuración de API
│   └── vercel.json  # Configuración de Vercel
└── SERVER/          # Backend (Render)
    ├── server.js    # Servidor Express + Socket.io
    ├── package.json
    └── render.yaml  # Configuración de Render
```

## Deploy Instructions

### 1. Backend en Render

1. Ve a [render.com](https://render.com) e inicia sesión
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name**: `winecounter` (o el que prefieras)
   - **Root Directory**: `SERVER`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Agrega las variables de entorno:
   - `MONGODB_URI`: Tu URI de MongoDB Atlas
   - `DB_NAME`: `winecounter`
   - `NODE_ENV`: `production`
6. Click en "Create Web Service"
7. **IMPORTANTE**: Copia la URL de tu servicio (ejemplo: `https://winecounter.onrender.com`)

### 2. Actualizar Frontend con la URL del Backend

1. Edita `CLIENT/config.js`
2. Reemplaza `https://winecounter.onrender.com` con tu URL de Render:

```javascript
const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://TU-URL-DE-RENDER.onrender.com'; // Cambia esto
```

3. Guarda y haz commit del cambio

### 3. Frontend en Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Click en "Add New..." → "Project"
3. Importa tu repositorio de GitHub
4. Configura:
   - **Project Name**: `winecounter` (o el que prefieras)
   - **Root Directory**: `CLIENT`
   - **Framework Preset**: Other
   - **Build Command**: (déjalo vacío)
   - **Output Directory**: (déjalo vacío)
5. Click en "Deploy"
6. Tu frontend estará disponible en `https://tu-proyecto.vercel.app`

### 4. Actualizar CORS en el Backend

1. Después de tener tu URL de Vercel, edita `SERVER/server.js`
2. Busca las líneas con `https://winecounter.vercel.app` y reemplázalas con tu URL de Vercel
3. Haz commit y push para que Render se actualice automáticamente

## Desarrollo Local

### Backend

```bash
cd SERVER
npm install
# Crea un archivo .env con tus variables
npm run dev
```

### Frontend

Simplemente abre `CLIENT/index.html` en tu navegador, o usa un servidor local:

```bash
cd CLIENT
npx serve
```

## Variables de Entorno

### Backend (SERVER/.env)

```env
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/
DB_NAME=winecounter
PORT=3000
NODE_ENV=development
```

## Funcionalidades

- Contador en tiempo real de copas y botellas por tipo de vino
- Sincronización instantánea entre todos los dispositivos conectados
- Panel de administración para gestionar tipos de vino
- Exportación de datos a CSV
- Reset de contadores
- Responsive design para móviles y tablets

## Uso

1. **Contador Principal** (`index.html`):
   - Incrementar/decrementar contadores de copas y botellas
   - Ver totales generales en tiempo real
   - Exportar datos a CSV
   - Resetear todos los contadores

2. **Panel Admin** (`admin.html`):
   - Agregar nuevos tipos de vino
   - Editar nombres de vinos existentes
   - Dar de baja vinos (no se eliminan, solo se ocultan)
   - Reactivar vinos dados de baja

## Autor

Camila Urenda

## Repositorio

https://github.com/camiurenda/WineCounter.git
