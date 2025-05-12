import http from '@/api/request.ts'
import tools from '@/common'
type handlerFileType = {
   files: FileList | [],
} & UploadEventGatherOptions['uploadOptions']


/**
 * 上传参数配置对象。
 * @param {UploadEventGatherOptions} uploadParams - 上传参数配置。
 * @param {UploadEventGatherOptions.uploadOptions} uploadParams.uploadOptions - 上传选项配置。
 * @param {UploadEventGatherOptions.uploadOptions.accept} uploadParams.uploadOptions.accept - 允许上传的文件类型数组。例如：['image/*', 'video/*']。
 * @param {UploadEventGatherOptions.requestOptions} uploadParams.requestOptions - 请求选项配置。
 * @param {UploadEventGatherOptions.requestOptions.baseUrl} uploadParams.requestOptions.baseUrl - 请求的基础 URL。
 * @param {UploadEventGatherOptions.requestOptions.url} uploadParams.requestOptions.url - 请求的路径。
 * @param {UploadEventGatherOptions.requestOptions.method} uploadParams.requestOptions.method - 请求方法（如 'post' 或 'get'）。
 */
class UploadEventGather implements UploadEventGatherType<UploadEventGatherOptions> {
   //包含请求的配置项和其他upload相关的配置项
   options: UploadEventGatherOptions

   constructor(options: UploadEventGatherOptions) {
      if (!Object.prototype.hasOwnProperty.call(options.requestOptions, 'data')) {
         Reflect.set(options.requestOptions, 'data', {})

      }

      this.options = options;
   }
   httpRequest = async (config: AxiosConfig) => {
      console.log('httpRequest', config)

      return await http(config)

   }
   /**
    * 处理files文件(文件数量类型、文件类型限制、文件大小等)参数
    * @param {UploadEventGatherOptions.uploadOptions} parmas - 参数对象
    * @param {UploadEventGatherOptions.uploadOptions.files} parmas.files - 文件资源
    * @param {UploadEventGatherOptions.uploadOptions.num} parmas.num - 文件数量(多文件)
    * @param {UploadEventGatherOptions.uploadOptions.accept} parmas.accept - 文件类型限制
    * @returns {FormData} - 返回处理后的文件对象
    */
   handlerFileParmas = (parmas: handlerFileType): FormData => {
      const {
         files,
      } = parmas
      const formData = new FormData()
      for (const fls of (files as FileList)) {
         formData.append('files', fls)
      }
      for (const item of Object.entries(this.options.requestOptions.data)) {
         const [key, value] = item
         if (typeof value === 'object') {
            formData.append(key, JSON.stringify(value))
         } else {
            formData.append(key, String(value))
         }

      }
      //这里需要同步配置文件类型
      //formData.append('multiple', String(this.options.uploadOptions.multiple))
      return formData
   }
   /**
    * @description 触发文件选择框
    * @param {Object} params - 参数
    * @param {TriggerFileSelectPro.event} params.data - 事件对象
    * @param {TriggerFileSelectPro.onProgress} params.onProgress onProgress - 进度回调函数
    * @param {TriggerFileSelectPro.result} params.result - API结果回调函数
   */
   triggerFileSelect = async ({ data: event, onProgress, result }: TriggerFileSelectPro) => {
      let files: handlerFileType['files'] = []
      const { validateFiles, getFileHash, getFileProto } = tools


      // 判断event的类型 
      if (Object.prototype.toString.call(event) === '[object Object]' && 'target' in event) {
         files = (event.target as HTMLInputElement)?.files as FileList
      } else {
         files = event as FileList
      }

      console.log('触发文件选择框', event, files, Array.from(files))
      if (!files?.length) return




      const { isValid, invalidFiles } = validateFiles(Array.from(files), this.options.uploadOptions.accept ?? '')


      //文件校验
      if (!isValid) {
         console.error(`只允许上传${this.options.uploadOptions.accept},错误的文件数据：`, invalidFiles)
         throw Error('上传的文件类型不符合要求')
      }

      //其他上传类型参数配置 
      Reflect.set(this.options.requestOptions, 'data', {
         ...this.options.requestOptions.data,
         accept: typeof this.options.uploadOptions.accept === 'string' ? this.options.uploadOptions.accept.split(',') : ''
      })





      const httpRes = async () => {
         const arr = (Array.from(files)).map(async file => { 
            // 计算文件哈希值256方式作为file的唯一标识
            const key = await getFileHash(file)


            this.options.requestOptions.onProgress = (async data => {

               if (onProgress) {
                  onProgress({
                     ...data,
                     [key]: getFileProto(file),   //返回文件唯一标识（如用户是以列表形式渲染后主动上传）
                     file
                  })
               }
            })
            return this.httpRequest({

               ...this.options.requestOptions,
               data: this.handlerFileParmas({
                  ...this.options.uploadOptions,
                  files: (() => {
                     const dataTransfer = new DataTransfer();
                     dataTransfer.items.add(file);
                     return dataTransfer.files;
                  })(),
               })
            })
         })
         return await Promise.all(arr)
      }
      const res = await httpRes()
      // 如果是input事件，清空input的值
      if (Object.prototype.toString.call(event) === '[object Object]') (event as React.ChangeEvent<HTMLInputElement>).target.value = '';


      if (result) {
         result(res || [])
      } else {
         return res
      }

   }
   /**
    * 获取blob资源
    * @param {AxiosConfig} config 配置项 
    * @returns {Promise<Blob>} blob 资源
    */
   getBlob = async (config: AxiosConfig): Promise<string> => {
      const httpRes = await this.httpRequest({
         ...config,
         responseType: 'blob'
      });
      const blob = new Blob(
         [httpRes.data],
         { type: httpRes.data.type }
      );

      const imageUrl = URL.createObjectURL(blob);

      return imageUrl;
   }
}
export default UploadEventGather