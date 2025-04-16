import axios from 'axios'



//上传进度条
const httpProgressEvent = async (progressEvent: Record<string, any>, onProgress?: (data:ProgressData) => void) => {
   const { progress, lengthComputable ,download} = progressEvent
   //上传进度条数据
   const progressData: ProgressData = {
      done: false,     // 是否完成
      percentage: 0,   // 进度
      progressType : 'upload' //进度条类型
   }
   if (lengthComputable) {
      Reflect.set(progressData, 'percentage', Math.round(progress * 100))
      Reflect.set(progressData, 'done', progress >= 1)
      //表明是否为下载事件
      Reflect.set(progressData, 'progressType',download ? 'download' :'upload')
   } else {
      Object.assign(progressData, {
         error: '资源不可计算',     //不可计算资源
         done: false,
         percentage: 0 
      })
   }
   Object.assign(progressData, {
      axiosOrgProgress: progressEvent // 原始axios进度条事件
   })
   if (onProgress) onProgress(progressData)
}

// 创建 axios 实例
const request = axios.create({
   timeout: 15000, // 请求超时时间 

})

// 请求拦截器
request.interceptors.request.use(
   config => {
      const { 
         headers,
         baseURL
      }: AxiosConfig = config
      console.log(config, 'http-config')
      // 动态设置 baseURL
      config.baseURL = baseURL; // 可以根据需要动态设置
      config.headers = headers; 

      return config
   },
   error => {
      return Promise.reject(error)
   }
)

// 响应拦截器
request.interceptors.response.use(
   response => {
      // 业务code动态配置
      const {
         businesSuccCode = 200,
         businesFailCode = 500
      } = ((response.config as unknown) as AxiosConfig).businesCode || {}
      const res = response.data
      // 这里根据自己的业务code修改
      if (res.code === businesSuccCode) {
         return res
      } else if (res.code === businesFailCode) {

         return Promise.reject(res)
      }
   },
   error => {
      console.log(error, 'error')
      // 处理请求取消
      if (axios.isCancel(error)) {
         return Promise.reject(new Error('请求被取消'))
      }

      // 处理 HTTP 错误
      handleHttpError(error)
   }
)

// 处理 HTTP 错误
const handleHttpError = (error: any) => {
   const status = error.response?.status
   switch (status) {
      case 400:
         Promise.reject('请求错误 (400)');
         break;
      case 401:
         Promise.reject('未授权，请重新登录 (401)');
         break;
      case 403:
         Promise.reject('拒绝访问 (403)');
         break;
      case 404:
         Promise.reject('请求地址出错 (404)');
         break;
      case 408:
         Promise.reject('请求超时 (408)');
         break;
      case 429:
         Promise.reject('请求过多，请稍后再试 (429)');
         break;
      case 500:
         Promise.reject('服务器内部错误 (500)');
         break;
      case 501:
         Promise.reject('服务未实现 (501)');
         break;
      case 502:
         Promise.reject('网关错误 (502)');
         break;
      case 503:
         Promise.reject('服务不可用 (503)');
         break;
      case 504:
         Promise.reject('网关超时 (504)');
         break;
      case 505:
         Promise.reject('HTTP版本不受支持 (505)');
         break;
      default:
         Promise.reject(`网络错误 (${status || '未知错误'})`);
   }
}



// 处理业务错误
// const handleBusinessError = (res) => {
//    // 处理特定的业务错误码
//    switch (res.code) {
//       case 401:
//          // token 过期
//          removeToken()
//          router.push('/login')
//          break
//       case 403:
//          message.error('没有权限访问')
//          break
//       default:
//          message.error(res.message || '操作失败')
//    }
// }

/**
 * @param config - Axios 请求配置对象，包含请求的相关参数。
 * @param onProgress - 进度回调函数，用于处理上传或下载的进度信息。
 */
const http = async (config: AxiosConfig) => {
   return await request.request({
      ...config,
      onUploadProgress: (progressEvent) => {
         httpProgressEvent(progressEvent, (config as UploadEventGatherOptions['requestOptions']).onProgress)
      },   //上传
      onDownloadProgress: (progressEvent) => {
         httpProgressEvent(progressEvent, (config as UploadEventGatherOptions['requestOptions']).onProgress)
      }  //读取下载
   })


}
export default http