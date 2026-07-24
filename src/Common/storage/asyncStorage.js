import AsyncStorage from '@react-native-async-storage/async-storage'
export const storeDataToAsyncStorage = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    // saving error
  }
}

export const getDataFromAsyncStorage = async (key, defaultData = null) => {
  try {
    const jsonValue = await AsyncStorage.getItem(key)
    return jsonValue != null ? JSON.parse(jsonValue) : defaultData
  } catch (e) {
    // error reading value
    return defaultData
  }
}
