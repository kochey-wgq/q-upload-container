
import './App.css'
import UploadContainer from '@/components/UploadContainer'
import UploadIndex from '@/views/UploadIndex'
function App() {
  const uploadParmas = {
    toggleLargefile : false, // 是否开启大文件上传
    uploadOptions: {
      accept: ['video/*'],
      multipleNum: 1,
      multiple: true, 
      chunkSize: 1024 * 1024,
      maxFileUploads: 3, 
      maxFileChunksUploads: 3, 
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
