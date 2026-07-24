const { useNavigation } = require('@react-navigation/native')

const useAppNavigation = () => {
  const navigation = useNavigation()

  return {
    goBack: navigation.goBack
  }
}

export default useAppNavigation
