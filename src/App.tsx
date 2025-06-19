
import './App.css'
import UploadContainer from '@/components/UploadContainer'
import UploadIndex from '@/views/UploadIndex'
function App() {
  const uploadParmas = {
    toggleLargefile : true, // 是否开启大文件上传
    uploadOptions: {
      accept: ['video/*'],
      multipleNum: 2,
      multiple: true, 
      chunkSize: 1024 * 100,     
      maxFileUploads: 3, 
      maxFileChunksUploads: 3, 
    },
    requestOptions: {
      baseURL: 'http://localhost:3000', 
      method: 'post', 
      url: '/upload/small', // 默认的url为小文件字段上传地址
      largeUrl: { // 大文件有关上传的属性
        timeout:0,
        upload : {
          url : '/upload/large', // 大文件分片上传
        },
        check:{
          url: '/upload/largeCheck', // 大文件分片的查询
        },
        merge:{
          url: '/upload/largeMerge', // 大文件分片的合并
        },
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
