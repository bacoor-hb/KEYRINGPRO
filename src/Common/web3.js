import BigNumber from 'bignumber.js'

/**
 * Ex: 123,456.789 => 123456.789
 * @param {*} number
 * @returns
 */
export const removeCommasFromNumer = (number) => {
  try {
    return (number || '').toString().replaceAll(',', '')
  } catch (error) {
    return number
  }
}

export const removeDecimalsFromNumber = (number) => {
  try {
    return new BigNumber(number).decimalPlaces(0, 1).toString()
  } catch (error) {
    return number
  }
}
