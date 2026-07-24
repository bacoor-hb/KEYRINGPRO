import React from 'react'
import I18n from 'assets/Lang'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import createStyles from './styles'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import TitleScreen from 'frontend/Components/UI/TitleScreen'

const ViewPrivateKeyPage = (_this) => {
  const styles = createStyles()
  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <TitleScreen title={I18n.t('SecurityScreen.viewPrivateKey')} />
      <StatusMessage
        variant='warning'
        message={I18n.t('ViewIDKeyScreen.warning1')}
        iconConfig={{
          className: 'm-auto'
        }}
      />

    </MyViewPage>
  )
}

export default ViewPrivateKeyPage
