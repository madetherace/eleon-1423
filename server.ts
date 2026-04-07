import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import net from 'net';
import protobuf from 'protobufjs';

const CONTROLLER_IP = '192.168.1.100';
const CONTROLLER_PORT = 7000;

const protoDefinition = `
syntax = "proto3";

message ClientMessage {
  oneof message {
    bool get_info = 1;
    bool get_state = 2;
    States set_state = 3;
  }
}

enum States {
  LightOn = 0;
  LightOff = 1;
  DoorLockOpen = 2;
  DoorLockClose = 3;
  Channel1On = 4;
  Channel1Off = 5;
  Channel2On = 6;
  Channel2Off = 7;
}

message ControllerResponse {
  oneof response {
    InfoResponse info = 1;
    StateResponse state = 2;
    StatusResponse status = 3;
  }
}

message InfoResponse {
  string ip = 1;
  string mac = 2;
  string ble_name = 3;
  string token = 4;
}

message StateResponse {
  bool light_on = 1;
  bool door_locked = 2;
  bool channel1_on = 3;
  bool channel2_on = 4;
  float temperature = 5;
  float pressure = 6;
  float humidity = 7;
}

message StatusResponse {
  bool success = 1;
  string error_message = 2;
}
`;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Load Protobuf
  const root = protobuf.parse(protoDefinition).root;
  const ClientMessage = root.lookupType('ClientMessage');
  const ControllerResponse = root.lookupType('ControllerResponse');

  // Helper to communicate with TCP Controller
  const sendToController = (messageData: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      
      // Set timeout for local network requests
      client.setTimeout(2000);

      client.connect(CONTROLLER_PORT, CONTROLLER_IP, () => {
        const errMsg = ClientMessage.verify(messageData);
        if (errMsg) throw Error(errMsg);
        
        const buffer = ClientMessage.encode(ClientMessage.create(messageData)).finish();
        client.write(buffer);
      });

      client.on('data', (data) => {
        try {
          const response = ControllerResponse.decode(data);
          resolve(ControllerResponse.toObject(response, { enums: String, longs: String }));
        } catch (e) {
          reject(e);
        } finally {
          client.destroy();
        }
      });

      client.on('error', (err) => {
        client.destroy();
        reject(err);
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('Controller connection timeout'));
      });
    });
  };

  // API Routes
  app.get('/api/controller/info', async (req, res) => {
    try {
      const response = await sendToController({ get_info: true });
      res.json(response.info || { error: 'Invalid response' });
    } catch (e: any) {
      // For demo purposes, if connection fails, return mock data
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          ip: CONTROLLER_IP,
          mac: '00:1A:2B:3C:4D:5E',
          ble_name: 'SmartRoom_101',
          token: 'SECRET_TOKEN_123'
        });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/controller/state', async (req, res) => {
    try {
      const response = await sendToController({ get_state: true });
      res.json(response.state || { error: 'Invalid response' });
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          light_on: Math.random() > 0.5,
          door_locked: true,
          channel1_on: false,
          channel2_on: true,
          temperature: 22.5 + Math.random(),
          pressure: 1013 + Math.random() * 10,
          humidity: 45 + Math.random() * 5
        });
      }
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/controller/command', async (req, res) => {
    const { command } = req.body;
    try {
      const response = await sendToController({ set_state: command });
      res.json(response.status || { success: true });
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') {
        return res.json({ success: true });
      }
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
