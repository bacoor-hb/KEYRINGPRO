
import React, { createContext } from 'react'
import { MODE_THEME } from 'common/constants/app'
import { DarkColors, width } from 'common/styles'
import SafeViewAreaWrapper from 'frontend/Components/SafeViewAreaWrapper'

const styleThemeConfig = {
  Darkmode: {
    backgroundColor: DarkColors.BLACK,
    color: DarkColors.WHITE,
    subColor: DarkColors.GRAY1,
    colorLink: DarkColors.BLUE1,
    colorWarning: DarkColors.YELLOW,
    colorDisable: DarkColors.GRAY4,
    txtStyle: {
      color: DarkColors.WHITE
    },
    txStatus: {
      success: DarkColors.GREEN,
      pending: DarkColors.YELLOW,
      fail: DarkColors.RED_TEXT
    },
    modal: {
      textTitle: {
        textAlign: 'center',

        fontSize: width(5),
        color: DarkColors.WHITE
      },
      textDescription: {
        textAlign: 'center',
        color: DarkColors.TEXT2,
        fontSize: width(4)
      }
    }
  }
}
export const ThemeContext = createContext(styleThemeConfig.Darkmode)

// App is dark-mode only. Theme is fixed to dark; `toggleTheme` is kept as a
// no-op so legacy `ThemeContext.Consumer` code that destructures it keeps working.
const themeValue = {
  modeTheme: MODE_THEME.DARK_MODE,
  styleTheme: styleThemeConfig.Darkmode,
  isDarkMode: true,
  toggleTheme: () => {}
}

const ThemeContextProvider = (props) => {
  const { children } = props
  return (
    <ThemeContext.Provider value={themeValue}>
      <SafeViewAreaWrapper>
        {children}
      </SafeViewAreaWrapper>
    </ThemeContext.Provider>
  )
}

export const defaultContext = {
  modeTheme: MODE_THEME.DARK_MODE,
  styleTheme: styleThemeConfig.Darkmode
}

export default ThemeContextProvider
