// config/database.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// ─── Constants ───────────────────────────────────────────────────────────────

const DB_DEFAULTS = {
  POOL_SIZE_MAX:               10,
  POOL_SIZE_MIN:               2,
  MAX_IDLE_TIME_MS:            30_000,
  CONNECT_TIMEOUT_MS:          10_000,
  SOCKET_TIMEOUT_MS:           45_000,
  SERVER_SELECTION_TIMEOUT_MS: 30_000,
  HEARTBEAT_FREQUENCY_MS:      10_000,
  WRITE_CONCERN:               'majority',
  WRITE_TIMEOUT_MS:            10_000,
  READ_PREFERENCE:             'primaryPreferred',
  MAX_RECONNECT_ATTEMPTS:      5,
  RECONNECT_INTERVAL_MS:       5_000,
};

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  isConnected:        false,
  connectionAttempts: 0,
  eventsRegistered:   false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const envInt = (key, fallback) => {
  const val = parseInt(process.env[key], 10);
  return Number.isNaN(val) ? fallback : val;
};

// ─── Connection options ───────────────────────────────────────────────────────

const buildConnectionOptions = () => ({
  maxPoolSize:              envInt('MONGODB_POOL_SIZE',                    DB_DEFAULTS.POOL_SIZE_MAX),
  minPoolSize:              envInt('MONGODB_MIN_POOL_SIZE',                DB_DEFAULTS.POOL_SIZE_MIN),
  maxIdleTimeMS:            envInt('MONGODB_MAX_IDLE_TIME_MS',             DB_DEFAULTS.MAX_IDLE_TIME_MS),
  connectTimeoutMS:         envInt('MONGODB_CONNECTION_TIMEOUT_MS',        DB_DEFAULTS.CONNECT_TIMEOUT_MS),
  socketTimeoutMS:          envInt('MONGODB_SOCKET_TIMEOUT_MS',            DB_DEFAULTS.SOCKET_TIMEOUT_MS),
  serverSelectionTimeoutMS: envInt('MONGODB_SERVER_SELECTION_TIMEOUT_MS',  DB_DEFAULTS.SERVER_SELECTION_TIMEOUT_MS),
  heartbeatFrequencyMS:     envInt('MONGODB_HEARTBEAT_FREQUENCY_MS',       DB_DEFAULTS.HEARTBEAT_FREQUENCY_MS),
  w:                        process.env.MONGODB_WRITE_CONCERN              || DB_DEFAULTS.WRITE_CONCERN,
  wtimeoutMS:               envInt('MONGODB_W_TIMEOUT_MS',                 DB_DEFAULTS.WRITE_TIMEOUT_MS),
  readPreference:           process.env.MONGODB_READ_PREFERENCE            || DB_DEFAULTS.READ_PREFERENCE,
  retryWrites:              true,
  retryReads:               true,
  compressors:              ['zstd', 'snappy', 'zlib'],

  ...(process.env.NODE_ENV === 'production' && {
    ssl:                         true,
    tls:                         true,
    tlsAllowInvalidCertificates: false,
    tlsAllowInvalidHostnames:    false,
  }),
});

// ─── Mongoose event listeners ─────────────────────────────────────────────────

const setupMongooseEvents = () => {
  if (state.eventsRegistered) return;
  state.eventsRegistered = true;

  mongoose.connection.on('connected', () => {
    const { name, host, port } = mongoose.connection;
    console.log(`✅ MongoDB connected  db=${name}  host=${host}:${port}`);
    state.isConnected        = true;
    state.connectionAttempts = 0;
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
    state.isConnected = false;
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
    state.isConnected = false;
    if (process.env.NODE_ENV !== 'test') scheduleReconnect();
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
    state.isConnected        = true;
    state.connectionAttempts = 0;
  });

  mongoose.connection.on('connectionPoolReady', () => {
    console.log('🏊 Connection pool ready');
  });

  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MONGOOSE === 'true') {
    mongoose.set('debug', (collection, method, query, doc) => {
      console.log(`📝 ${collection}.${method}`, { query, doc });
    });
  }
};

// ─── Reconnection ─────────────────────────────────────────────────────────────

const scheduleReconnect = () => {
  if (state.connectionAttempts >= DB_DEFAULTS.MAX_RECONNECT_ATTEMPTS) {
    console.error('❌ Max reconnect attempts reached — giving up.');
    return;
  }

  state.connectionAttempts++;
  const attempt = state.connectionAttempts;
  console.log(`🔄 Reconnect attempt ${attempt}/${DB_DEFAULTS.MAX_RECONNECT_ATTEMPTS} in ${DB_DEFAULTS.RECONNECT_INTERVAL_MS}ms…`);

  setTimeout(async () => {
    try {
      await connectDatabase();
    } catch (err) {
      console.error(`Reconnect attempt ${attempt} failed:`, err.message);
    }
  }, DB_DEFAULTS.RECONNECT_INTERVAL_MS);
};

// ─── Core connection API ──────────────────────────────────────────────────────

export const connectDatabase = async () => {
  if (state.isConnected && mongoose.connection.readyState === 1) {
    console.log('📦 Reusing existing database connection');
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  setupMongooseEvents();

  try {
    await mongoose.connect(process.env.MONGODB_URI, buildConnectionOptions());

    if (process.env.NODE_ENV === 'production') {
      await mongoose.syncIndexes({ background: true });
    }

    return mongoose.connection;
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    throw err;
  }
};

export const disconnectDatabase = async () => {
  if (!state.isConnected) {
    console.log('📦 No active connection to close');
    return;
  }
  try {
    await mongoose.disconnect();
    state.isConnected = false;
    console.log('👋 Database connection closed');
  } catch (err) {
    console.error('❌ Error disconnecting:', err.message);
    throw err;
  }
};

// ─── Health check ─────────────────────────────────────────────────────────────

export const checkDatabaseHealth = async () => {
  if (mongoose.connection.readyState !== 1) {
    return {
      status:     'unhealthy',
      message:    'Database not connected',
      readyState: mongoose.connection.readyState,
    };
  }

  try {
    const ping = await mongoose.connection.db.admin().ping();
    return {
      status:     'healthy',
      message:    'Connection is healthy',
      ping:       ping?.ok === 1 ? 'ok' : 'failed',
      readyState: mongoose.connection.readyState,
      host:       mongoose.connection.host,
      name:       mongoose.connection.name,
      poolSize:   envInt('MONGODB_POOL_SIZE', DB_DEFAULTS.POOL_SIZE_MAX),
    };
  } catch (err) {
    return {
      status:     'unhealthy',
      message:    err.message,
      readyState: mongoose.connection.readyState,
    };
  }
};

// ─── Transaction helper ───────────────────────────────────────────────────────

/**
 * Runs `callback(session)` inside a MongoDB transaction.
 * The callback MUST pass `{ session }` to all Mongoose operations, e.g.:
 *   await User.create([data], { session })
 *   await Order.findOneAndUpdate(filter, update, { session })
 */
export const withTransaction = async (callback) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    session.endSession();
  }
};

// ─── Pagination helper ────────────────────────────────────────────────────────

export const paginate = async (model, query = {}, options = {}) => {
  const page  = Math.max(1, parseInt(options.page,  10) || 1);
  const limit = Math.max(1, parseInt(options.limit, 10) || 10);
  const {
    sort     = { createdAt: -1 },
    populate = [],
    select   = '',
    lean     = true,
  } = options;

  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    model.find(query).sort(sort).skip(skip).limit(limit)
         .select(select).populate(populate).lean(lean).exec(),
    model.countDocuments(query).exec(),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext:     page < totalPages,
      hasPrevious: page > 1,
    },
  };
};

// ─── Plugins ──────────────────────────────────────────────────────────────────

/**
 * Soft delete plugin.
 * @param {object} options
 * @param {string} options.deletedByRef - Model name for the deletedBy ref (default: 'Account')
 */
export const softDeletePlugin = (schema, { deletedByRef = 'Account' } = {}) => {
  const { Schema } = mongoose;

  schema.add({
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: deletedByRef, default: null },
  });

  const excludeDeleted = function () {
    if (this.getFilter().isDeleted === undefined) {
      this.where({ isDeleted: false });
    }
  };

  ['find', 'findOne', 'findOneAndUpdate', 'countDocuments'].forEach(hook =>
    schema.pre(hook, excludeDeleted)
  );

  schema.methods.softDelete = function (deletedBy = null) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (deletedBy) this.deletedBy = deletedBy;
    return this.save();
  };

  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };
};

/**
 * Audit trail plugin — tracks createdBy / updatedBy on every document.
 * Usage: doc.setCreatedBy(userId).save()
 */
export const auditPlugin = (schema) => {
  const { Schema } = mongoose;

  schema.add({
    createdBy: { type: Schema.Types.ObjectId, ref: 'Account' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Account' },
  });

  schema.pre('save', function (next) {
    if (this.isNew  && this._createdBy) this.createdBy = this._createdBy;
    if (this._updatedBy)                this.updatedBy  = this._updatedBy;
    next();
  });

  schema.methods.setCreatedBy = function (userId) { this._createdBy = userId; return this; };
  schema.methods.setUpdatedBy = function (userId) { this._updatedBy = userId; return this; };
};

// ─── Bulk upsert ──────────────────────────────────────────────────────────────

export const bulkUpsert = (model, data, matchFields = ['_id']) => {
  if (!data?.length) return Promise.resolve({ ok: 1, nUpserted: 0, nModified: 0 });

  const operations = data.map(item => ({
    updateOne: {
      filter: Object.fromEntries(
        matchFields.filter(f => item[f] != null).map(f => [f, item[f]])
      ),
      update: { $set: item },
      upsert: true,
    },
  }));

  return model.bulkWrite(operations, { ordered: false });
};

// ─── Graceful shutdown ────────────────────────────────────────────────────────

export const setupGracefulShutdown = (server) => {
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — starting graceful shutdown…`);
    if (server) {
      await new Promise(resolve => server.close(resolve));
      console.log('✅ HTTP server closed');
    }
    await disconnectDatabase();
    console.log('👋 Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
};