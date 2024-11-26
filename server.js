const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexión a MongoDB
mongoose.connect(
  'mongodb+srv://llerenasbeto2:lZFBcqaMJ8tFSHBI@clusterbeto.2lj07.mongodb.net/Datos_proyecto?retryWrites=true&w=majority&appName=Clusterbeto',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Error:', err));

// Esquema de MongoDB para datos de sensores
const SensorDataSchema = new mongoose.Schema({
  type: { type: String, required: true },
  value: { type: String, required: true }, // Se define como String ya que almacenamos un JSON serializado
  timestamp: { type: Date, default: Date.now }
});

// Esquema de Usuario Registrado
const RegisterSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Esquema de Usuario Login
const LoginSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Register', required: true },
  username: { type: String, required: true },
  loginDate: { type: Date, default: Date.now },
  status: { type: String, default: 'active' }
});

const SensorData = mongoose.model('SensorData', SensorDataSchema);
const Register = mongoose.model('Register', RegisterSchema);
const Login = mongoose.model('Login', LoginSchema);

// Rutas de Registro
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const userExists = await Register.findOne({ username });
    if (userExists) {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new Register({ username, password: hashedPassword });
    await newUser.save();
    res.json({ message: 'Usuario registrado exitosamente' });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Rutas de Login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await Register.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const loginRecord = new Login({ userId: user._id, username: user.username });
    await loginRecord.save();

    res.json({ message: 'Login exitoso', userId: user._id, username: user.username });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Ruta para guardar datos de sensores
app.post('/api/sensores', async (req, res) => {
  try {
    const { type, value, timestamp } = req.body;

    if (type !== "/TX_BETO") {
      return res.status(200).json({ message: 'Skipping database storage for non-TX_BETO sensor' });
    }

    if (!value) {
      console.error(`Mensaje vacío en el tema ${type}, no se almacenará.`);
      return res.status(400).json({ error: `Mensaje vacío en el tema ${type}, no se almacenará.` });
    }

    const finalTimestamp = timestamp ? new Date(timestamp) : new Date();
    if (isNaN(finalTimestamp.getTime())) {
      console.error(`Fecha inválida para el tema ${type}, se usará la fecha actual.`);
      finalTimestamp = new Date();
    }

    const newSensorData = new SensorData({ type, value, timestamp: finalTimestamp });
    await newSensorData.save();
    console.log(`Mensaje de TX_BETO guardado: ${value}`);
    res.json({ message: 'Dato de TX_BETO guardado exitosamente' });
  } catch (error) {
    console.error('Error al guardar dato de sensor:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Ruta para obtener un dato específico
app.get('/api/sensores/ultimos/:dato', async (req, res) => {
    try {
      const { dato } = req.params;
  
      // Buscar el último dato de TX_BETO
      const latestTxBeto = await SensorData.findOne({ type: "/TX_BETO" }).sort({ timestamp: -1 });
      
      if (!latestTxBeto) {
        return res.status(404).json({ error: 'No se encontró ningún dato de TX_BETO' });
      }
  
      let parsedValue;
      try {
        // Parsear la cadena de texto como JSON
        parsedValue = JSON.parse(latestTxBeto.value);
      } catch (error) {
        console.error('Error al parsear value:', error);
        console.error('Valor recibido:', latestTxBeto.value);
        return res.status(500).json({ error: 'Error al parsear el valor almacenado' });
      }
  
      if (!(dato in parsedValue)) {
        return res.status(404).json({ error: `El dato '${dato}' no existe en TX_BETO` });
      }
  
      res.json({ 
        [dato]: parsedValue[dato], 
        timestamp: latestTxBeto.timestamp 
      });
    } catch (error) {
      console.error('Error en la ruta /api/sensores/ultimos/:dato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
  app.get('/api/sensores/ultimos10/:dato', async (req, res) => {
    try {
      const { dato } = req.params;
  
      // Mapeo de nombres alternativos a claves correctas
      const keyMap = {
        'luz': 'LDR',
        // Puedes agregar más nombres alternativos si es necesario
      };
  
      // Si el dato recibido tiene un mapeo, usa el mapeo, de lo contrario, usa el dato original
      const actualKey = keyMap[dato.toLowerCase()] || dato;
  
      // Buscar los últimos 10 datos de TX_BETO
      const txBetoData = await SensorData.find({ type: "/TX_BETO" })
        .sort({ timestamp: -1 })
        .limit(10);
  
      if (!txBetoData || txBetoData.length === 0) {
        return res.status(404).json({ error: 'No se encontraron datos de TX_BETO' });
      }
  
      // Procesar los datos
      const parsedData = txBetoData.map((entry) => {
        let parsedValue;
        try {
          parsedValue = JSON.parse(entry.value);
        } catch (error) {
          console.error('Error al parsear value:', error);
          console.error('Valor recibido:', entry.value);
          return null; // Ignorar este dato si no se puede parsear
        }
  
        // Buscar la clave insensible a mayúsculas/minúsculas
        const datoKey = Object.keys(parsedValue).find(key => key.toLowerCase() === actualKey.toLowerCase());
  
        if (!datoKey) {
          console.warn(`El dato '${actualKey}' no existe en TX_BETO:`, parsedValue);
          return null; // Ignorar este dato si no tiene el campo solicitado
        }
  
        return { 
          [actualKey]: parsedValue[datoKey], 
          timestamp: entry.timestamp 
        };
      }).filter((item) => item !== null); // Filtrar datos inválidos
  
      if (parsedData.length === 0) {
        return res.status(404).json({ error: `No se encontraron datos válidos con el campo '${actualKey}'` });
      }
  
      res.json(parsedData);
    } catch (error) {
      console.error('Error en la ruta /api/sensores/ultimos10/:dato:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
  
  
  
// Servir archivos estáticos
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuración del servidor
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
