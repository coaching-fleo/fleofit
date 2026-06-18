import { BleClient } from '@capacitor-community/bluetooth-le'

let hrDeviceId = null
let currentHeartRate = null
const listeners = new Set()

const notifyListeners = () => {
  for (const listener of listeners) {
    listener(hrDeviceId !== null, currentHeartRate)
  }
}

export const BluetoothService = {
  subscribe(callback) {
    listeners.add(callback)
    callback(hrDeviceId !== null, currentHeartRate)
    return () => listeners.delete(callback)
  },
  async connect() {
    try {
      if (hrDeviceId) {
        await this.disconnect()
      }
      await BleClient.initialize()
      const device = await BleClient.requestDevice({
        services: ['0000180d-0000-1000-8000-00805f9b34fb'], // Heart Rate Service
      })
      
      await BleClient.connect(device.deviceId, () => {
        hrDeviceId = null
        currentHeartRate = null
        notifyListeners()
      })
      
      hrDeviceId = device.deviceId
      notifyListeners()

      await BleClient.startNotifications(device.deviceId, '0000180d-0000-1000-8000-00805f9b34fb', '00002a37-0000-1000-8000-00805f9b34fb', (value) => {
        const flags = value.getUint8(0)
        const format = flags & 0x01
        currentHeartRate = format === 0 ? value.getUint8(1) : value.getUint16(1, true)
        notifyListeners()
      })
    } catch (err) {
      console.error("Bluetooth Connect Error:", err)
      throw err
    }
  },
  async disconnect() {
    if (hrDeviceId) {
      try { await BleClient.disconnect(hrDeviceId) } catch(e) {}
    }
    hrDeviceId = null
    currentHeartRate = null
    notifyListeners()
  },
  getState() {
    return { connected: hrDeviceId !== null, heartRate: currentHeartRate }
  }
}