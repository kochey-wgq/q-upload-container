import http from '@/api/request.ts'
type handlerFileType = {
   files: FileList | null,
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
    * @param {UploadEventGatherOptions.uploadOptions.multiple} parmas.multiple   - 文件数量类型(单文件、多文件)
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
      formData.append('multiple', String(this.options.uploadOptions.multiple))
      return formData
   }
   /**
    * @description 触发文件选择框
    * @param {object} event - 事件对象
   */
   triggerFileSelect = async ({ event, onProgress, result }: TriggerFileSelectPro) => {
      let files: handlerFileType['files'] = null
      if ('target' in event) {
         files = (event.target as HTMLInputElement)?.files
      }
      console.log('触发文件选择框', event, files)
      if (!files?.length) return

      this.options.requestOptions.onProgress = ((data) => {
         if (onProgress) onProgress(data)
      })

      const httpRes = await this.httpRequest({

         ...this.options.requestOptions,
         data: this.handlerFileParmas({
            ...this.options.uploadOptions,
            files,
         })
      })
      event.target.value = '';
      if (result) {
         result({ httpRes })
      } else {
         return httpRes
      }

   }
   /**
    * 获取blob资源
    * @param {AxiosConfig} config 配置项
    * @param {BlobOptions} blobOptions blob 参数
    * @returns {Promise<Blob>} blob 资源
    */
   getBlob = async (config: AxiosConfig, blobOptions?: Array<BlobOptions>): Promise<string> => {
      const [ array, options ] = blobOptions || [];
      const httpRes = await this.httpRequest({
         ...config,
         responseType: 'blob',
      });
      const blob = new Blob(
         (array as BlobPart[]) || [httpRes.data],
         (options as BlobPropertyBag) || { type: 'image/jpeg' }
      );
      const imageUrl = URL.createObjectURL(blob);
      return imageUrl;
   }
}
export default UploadEventGather