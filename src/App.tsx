
import './App.css'
import UploadContainer from '@/components/UploadContainer'
import UploadIndex from '@/views/UploadIndex'
function App() {
  const uploadParmas = {
    uploadOptions: {
      accept: ['video/*'],
      num: 1,
      multiple: true,
    },
    requestOptions: {
      timeout :0,
      baseURL: 'http://localhost:3000',
      url: '/upload',
      method: 'post', 
    }
  }
  return (
    <>
      <UploadContainer
        {...uploadParmas}
      >
        {(props) => (
          <UploadIndex {...props} />
        )}

      </UploadContainer>
    </>
  )
}

export default App
