import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient, Db } from 'mongodb';

interface Room {
  roomId: string;
  editKeyHash: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// Global cached connection
let client: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToMongo(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    cachedDb = client.db();
  }
  return cachedDb!;
}

// In-memory fallback
const inMemoryRooms = new Map<string, Room>();

// File path fallback
const localDbPath = path.join(process.cwd(), 'rooms-db.json');

function loadLocalFileRooms(): Map<string, Room> {
  try {
    if (fs.existsSync(localDbPath)) {
      const data = fs.readFileSync(localDbPath, 'utf8');
      const parsed = JSON.parse(data);
      const map = new Map<string, Room>();
      for (const [key, value] of Object.entries(parsed)) {
        const room = value as any;
        map.set(key, {
          ...room,
          createdAt: new Date(room.createdAt),
          updatedAt: new Date(room.updatedAt),
        });
      }
      return map;
    }
  } catch (err) {
    // In some read-only systems this could fail, which is fine
  }
  return new Map<string, Room>();
}

function saveLocalFileRooms(map: Map<string, Room>) {
  try {
    const obj: Record<string, Room> = {};
    for (const [key, value] of map.entries()) {
      obj[key] = value;
    }
    fs.writeFileSync(localDbPath, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    // Fail silently or log
  }
}

async function getRoom(roomId: string): Promise<Room | null> {
  if (process.env.MONGODB_URI) {
    try {
      const database = await connectToMongo();
      const col = database.collection('rooms');
      const doc = await col.findOne({ roomId });
      if (doc) {
        return {
          roomId: doc.roomId,
          editKeyHash: doc.editKeyHash,
          content: doc.content,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      }
      return null;
    } catch (e) {
      console.error('MongoDB query failed, falling back to local file', e);
    }
  }

  const fileRooms = loadLocalFileRooms();
  if (fileRooms.has(roomId)) {
    return fileRooms.get(roomId)!;
  }
  return inMemoryRooms.get(roomId) || null;
}

async function saveRoom(room: Room): Promise<void> {
  if (process.env.MONGODB_URI) {
    try {
      const database = await connectToMongo();
      const col = database.collection('rooms');
      await col.updateOne(
        { roomId: room.roomId },
        { $set: room },
        { upsert: true }
      );
      return;
    } catch (e) {
      console.error('MongoDB save failed, falling back to local file', e);
    }
  }

  const fileRooms = loadLocalFileRooms();
  fileRooms.set(room.roomId, room);
  saveLocalFileRooms(fileRooms);
  inMemoryRooms.set(room.roomId, room);
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function roomsHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const method = request.method;
  const roomId = request.params.roomId;

  try {
    if (method === 'GET') {
      if (!roomId) {
        return { status: 400, jsonBody: { error: 'Room ID is required for GET requests.' } };
      }

      const room = await getRoom(roomId);
      if (!room) {
        return { status: 404, jsonBody: { error: 'Room not found.' } };
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: {
          roomId: room.roomId,
          content: room.content,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt
        }
      };
    }

    if (method === 'POST') {
      // Room creation
      let body: any;
      try {
        body = await request.json();
      } catch (e) {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const editKey = body.editKey;
      if (!editKey || typeof editKey !== 'string' || editKey.trim() === '') {
        return { status: 400, jsonBody: { error: 'Edit key is required to create a room.' } };
      }

      // Generate random roomId if not provided or valid
      const targetRoomId = (body.roomId && typeof body.roomId === 'string' && body.roomId.trim() !== '') 
        ? body.roomId.trim().toLowerCase() 
        : crypto.randomBytes(6).toString('hex');

      // Check if roomId already exists
      const existing = await getRoom(targetRoomId);
      if (existing) {
        if (body.roomId) {
          return { status: 409, jsonBody: { error: 'Room ID already exists.' } };
        }
        // If it was auto-generated and collided (rare), we could retry, but let's just error
        return { status: 500, jsonBody: { error: 'Failed to generate a unique room ID. Please try again.' } };
      }

      const newRoom: Room = {
        roomId: targetRoomId,
        editKeyHash: hashKey(editKey),
        content: body.content || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await saveRoom(newRoom);

      return {
        status: 201,
        jsonBody: {
          success: true,
          roomId: newRoom.roomId,
          message: 'Room created successfully.'
        }
      };
    }

    if (method === 'PUT') {
      if (!roomId) {
        return { status: 400, jsonBody: { error: 'Room ID is required for PUT requests.' } };
      }

      let body: any;
      try {
        body = await request.json();
      } catch (e) {
        return { status: 400, jsonBody: { error: 'Invalid JSON body.' } };
      }

      const editKey = body.editKey;
      const content = body.content;

      if (editKey === undefined) {
        return { status: 400, jsonBody: { error: 'Edit key is required to update room content.' } };
      }
      if (content === undefined || typeof content !== 'string') {
        return { status: 400, jsonBody: { error: 'Content string is required.' } };
      }

      const room = await getRoom(roomId);
      if (!room) {
        return { status: 404, jsonBody: { error: 'Room not found.' } };
      }

      if (room.editKeyHash !== hashKey(editKey)) {
        return { status: 401, jsonBody: { error: 'Invalid edit key. Access denied.' } };
      }

      room.content = content;
      room.updatedAt = new Date();

      await saveRoom(room);

      return {
        status: 200,
        jsonBody: {
          success: true,
          roomId: room.roomId,
          content: room.content,
          updatedAt: room.updatedAt
        }
      };
    }

    return { status: 405, jsonBody: { error: `Method ${method} not allowed.` } };
  } catch (err: any) {
    context.error('Error handling room request:', err);
    return {
      status: 500,
      jsonBody: { error: 'Internal server error.', details: err.message }
    };
  }
}

app.http('rooms', {
  methods: ['GET', 'POST', 'PUT'],
  authLevel: 'anonymous',
  route: 'rooms/{roomId?}',
  handler: roomsHandler
});
