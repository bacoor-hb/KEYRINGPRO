import { useQuery } from 'react-query'

const useFetch = (fetchFunction, keysArr, options = {}) => useQuery(['fetchData', ...keysArr], () => fetchFunction, options)
export default useFetch
