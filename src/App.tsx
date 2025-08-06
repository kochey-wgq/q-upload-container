
import './App.css'
import UploadContainer from '@/components/UploadContainer'
import UploadIndex from '@/views/UploadIndex'
function App() {
  const uploadParmas = {  // 上传组件的参数
    toggleCompressionImg : true,  // 是否开启图片压缩
    // toggleLargefile : true, // 是否开启大文件上传
    uploadOptions: {    // 上传参数
      accept: ['image/*'],  // 接受的文件类型
      multipleNum: 2, // 多文件上传时，允许的最大文件数量
      multiple: true,   // 是否允许多文件上传
      chunkSize: 1024 * 100,      // 分片大小，单位为字节
      maxFileUploads: 3,  // 最大文件上传数量
      maxFileChunksUploads: 3,  // 最大分片上传数量
      compressionOptions: { // compression插件的压缩图片参数
        maxSizeMB: 1, // 压缩图片最大大小 
        useWebWorker: true, // 是否使用web worker进行压缩
      }
    },
    requestOptions: { // 请求配置
      baseURL: 'http://localhost:3000',
      method: 'post',
      url: '/upload/small', // 默认的url为小文件字段上传地址
      largeUrl: { // 大文件有关上传的属性
        upload: {
          timeout: 0,
          url: '/upload/largeChunk', // 大文件分片上传
        },
        check: {
          url: '/upload/largeCheck', // 大文件分片的查询
        },
        merge: {
          url: '/upload/largeMerge', // 大文件分片的合并
        },
        second: {
          url: '/upload/largeSecond', // 大文件的秒传
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
