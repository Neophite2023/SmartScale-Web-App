import Dexie from 'dexie';

export const db = new Dexie('SmartScaleDB');

db.version(1).stores({
    users: '++id, name, height, targetWeight',
    measurements: '++id, userId, weight, bmi, createdAt'
});

// Pomocné funkcie pre DB
export const getUser = async () => {
    return await db.users.orderBy('id').first();
};

export const saveUser = async (user) => {
    return await db.users.put(user);
};

export const addMeasurement = async (measurement) => {
    return await db.measurements.add({
        ...measurement,
        createdAt: new Date()
    });
};

export const getMeasurements = async (limit = 100) => {
    return await db.measurements
        .orderBy('createdAt')
        .reverse()
        .limit(limit)
        .toArray();
};

export const deleteMeasurement = async (id) => {
    return await db.measurements.delete(id);
};
