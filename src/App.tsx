
import './App.css'
import UploadContainer from '@/components/UploadContainer'
import UploadIndex from '@/views/UploadIndex'
function App() {
  const uploadParmas = {
    uploadOptions: {
      accept: ['image/*'],
      num: 1,
      multiple: true,
    },
    requestOptions: {
      baseURL: 'http://localhost:3000',
      url: '/upload',
      method: 'post',  
      data: {
        accept: ['image/*']
      } 
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
