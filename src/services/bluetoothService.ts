/**
 * Bluetooth Integration Service
 * Uses Web Bluetooth API to connect to heart rate monitors or similar devices.
 */

export interface BluetoothDeviceInfo {
  id: string;
  name?: string;
  connected: boolean;
}

export async function requestBluetoothDevice(): Promise<BluetoothDeviceInfo | null> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth is not supported in this browser.');
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate'] }],
      optionalServices: ['battery_service', 'device_information']
    });

    console.log('Device selected:', device.name);
    
    const server = await device.gatt?.connect();
    console.log('GATT Server connected');

    return {
      id: device.id,
      name: device.name,
      connected: true
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      console.log('User cancelled the chooser');
      return null;
    }
    throw error;
  }
}

export async function startHeartRateNotifications(callback: (value: number) => void) {
  const nav = navigator as any;
  if (!nav.bluetooth) return;

  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate'] }]
    });

    const server = await device.gatt?.connect();
    const service = await server?.getPrimaryService('heart_rate');
    const characteristic = await service?.getCharacteristic('heart_rate_measurement');

    await characteristic?.startNotifications();
    characteristic?.addEventListener('characteristicvaluechanged', (event: any) => {
      const value = event.target.value;
      // Heart rate measurement decoding (simplified)
      const hr = value.getUint8(1);
      callback(hr);
    });
  } catch (error) {
    console.error('Bluetooth Error:', error);
  }
}
