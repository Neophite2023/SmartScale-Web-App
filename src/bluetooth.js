/**
 * Web Bluetooth Logic for Xiaomi Mi Smart Scale 2
 */

const WEIGHT_SCALE_SERVICE_UUID = 0x181d;
const BODY_COMPOSITION_SERVICE_UUID = 0x181b;

const WEIGHT_MEASUREMENT_CHAR_UUID = 0x2a9d; // Pre 0x181d
const BODY_COMP_MEASUREMENT_CHAR_UUID = 0x2a9c; // Pre 0x181b

export const requestScale = async () => {
    try {
        if (!navigator.bluetooth) {
            throw new Error("Web Bluetooth nie je podporovaný v tomto prehliadači.");
        }

        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: [WEIGHT_SCALE_SERVICE_UUID] },
                { services: [BODY_COMPOSITION_SERVICE_UUID] }
            ],
            optionalServices: ['generic_access']
        });
        return device;
    } catch (error) {
        console.error("Bluetooth Request Error:", error);
        throw error;
    }
};

export const subscribeToWeight = async (device, onData) => {
    const server = await device.gatt.connect();

    // Zistíme, ktorá služba je dostupná
    let service;
    let charUUID;

    try {
        service = await server.getPrimaryService(WEIGHT_SCALE_SERVICE_UUID);
        charUUID = WEIGHT_MEASUREMENT_CHAR_UUID;
    } catch (e) {
        service = await server.getPrimaryService(BODY_COMPOSITION_SERVICE_UUID);
        charUUID = BODY_COMP_MEASUREMENT_CHAR_UUID;
    }

    const characteristic = await service.getCharacteristic(charUUID);


    await characteristic.startNotifications();

    characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value; // DataView
        const result = parseScaleData(value);
        if (result) onData(result);
    });

    return () => {
        characteristic.stopNotifications();
        server.disconnect();
    };
};

/**
 * Parsovanie dát z DataView (GATT Characteristic)
 * @param {DataView} data 
 */
const parseScaleData = (data) => {
    if (data.byteLength < 3) return null;

    // Byte 0: Flags
    // Bit 0: Units (0 = kg, 1 = lbs)
    // Bit 1: Timestamp present
    // Bit 2: ID present
    const flags = data.getUint8(0);
    const isLbs = (flags & 0x01) !== 0;

    // Byte 1-2: Weight (UINT16, Little Endian)
    // Xiaomi Mi Scale 2 (GATT standard) uses multiplier 0.005 for kg
    // But some versions use 0.01. The user's snippet used / 200.0 (which is * 0.005)
    const rawWeight = data.getUint16(1, true);
    let weight = rawWeight * 0.005;

    if (isLbs) {
        weight = rawWeight * 0.01; // lbs often use different multiplier
    }

    // Stabilita v GATT dátach býva indikovaná v Byte 0 (Flags) 
    // alebo proste tým, že prídu finálne dáta.

    return {
        weight: Math.round(weight * 100) / 100,
        isStable: true, // GATT notifications usually mean stable/measurement ready
        unit: isLbs ? 'lbs' : 'kg'
    };
};

// Pomocné výpočty
export const calculateBMI = (weight, height) => {
    if (!weight || !height) return 0;
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    return Math.round(bmi * 10) / 10;
};

export const getBMICategory = (bmi) => {
    if (bmi < 18.5) return { label: 'Podváha', color: '#60a5fa', status: 'blue' };
    if (bmi < 25) return { label: 'Normálna', color: '#4ade80', status: 'green' };
    if (bmi < 30) return { label: 'Nadváha', color: '#fb923c', status: 'orange' };
    return { label: 'Obezita', color: '#f87171', status: 'red' };
};
