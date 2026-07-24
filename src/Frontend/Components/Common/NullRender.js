const NullRender = ({ condition, children }) => {
  return (
    condition ? children : null
  )
}
export default NullRender
