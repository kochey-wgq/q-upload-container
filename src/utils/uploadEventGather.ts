import http from '@/api/request.ts'
import tools from '@/common'
import type { LargeFileUpload } from '@/common'
type handlerFileType = {
   files: FileList | File[] | [],
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
   options: UploadEventGatherOptions; 

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
    * @param {UploadEventGatherOptions.uploadOptions.multipleNum} parmas.multipleNum - 文件数量(多文件)
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
    * @description 文件上传
    * @param {Object} params - 参数
    * @param {FileStartUploadPro.data} params.data - 事件对象
    * @param {FileStartUploadPro.onProgress} params.onProgress onProgress - 进度回调函数
    * @param {FileStartUploadPro.result} params.result - API结果回调函数
   */
   fileStartUpload = async ({ data: event, onProgress, result }: FileStartUploadPro) => {
      let files: handlerFileType['files'] = []
      const {
         validateFiles,    //校验文件类型
         getFileHash,      //获取文件哈希值
         getFileProto,     //获取文件原型key 
         compressionImg    //图片压缩 
      } = tools


      // 判断event的类型 
      if (Object.prototype.toString.call(event) === '[object Object]' && 'target' in event) {
         files = (event.target as HTMLInputElement)?.files as FileList
      } else {
         files = event as FileList
      }

      console.log('触发文件选择框', event, Array.from(files), 'files')

      

      if (!files?.length) return



      const { 
         accept,                 // 接受的文件类型
         multipleNum,            // 多文件上传时，允许的最大文件数量
         multiple,               // 是否允许多文件上传
         chunkSize,              // 分片大小，单位为字节
         maxFileUploads,         // 最大文件上传数量
         maxFileChunksUploads,   // 最大分片上传数量
         compressionOptions      // compression插件的压缩图片参数
      } = this.options.uploadOptions


      // isValid  是否通过文件类型校验, invalidFiles 验证的文件列表
      const { isValid, invalidFiles } = validateFiles(Array.from(files), accept ?? '') 


      //多文件校验数量
      if (multiple && multipleNum && files.length > multipleNum) {
         console.error(`上传的文件数量超过限制，最大允许上传${multipleNum}个文件`)
         throw Error('上传的文件数量不符合要求')
      }

      //文件校验
      if (!isValid) {
         console.error(`只允许上传${accept},错误的文件数据：`, invalidFiles)
         throw Error('上传的文件类型不符合要求')
      }



      //开启图片压缩
      if (Reflect.has(this.options,'toggleCompressionImg') && this.options.toggleCompressionImg){
         const compressionFiles = Array.from(files).map(async t => await compressionImg(compressionOptions as CompressionImgOptions, t))
         files = (await Promise.allSettled(compressionFiles)).filter(t => t.status === 'fulfilled').map(t => t.value)
         console.warn('压缩图片成功 ↓')
         console.table(files)
      }
      // if(true) return
      //其他上传类型参数配置 
      Reflect.set(this.options.requestOptions, 'data', {
         ...this.options.requestOptions.data,
         accept: typeof accept === 'string' ? accept.split(',') : accept
      })

      let httpRes = null
      //开启大文件上传
      if (Reflect.has(this.options,'toggleLargefile') && this.options.toggleLargefile) {
         tools.initLargeUplod({
            files,
            chunkSize,
            maxFileUploads,
            maxFileChunksUploads,
            largeUrl: this.options.requestOptions.largeUrl,
            baseURL: this.options.requestOptions.baseURL as string,
            onProgress(resChunks) {
               if (onProgress) onProgress(resChunks) 
            }
         }) 
         const largefileRes = tools.largeFileUpload()
         httpRes = await largefileRes 
      } else {  //小文件上传 
         const smallFileRes = async () => {
            const arr = (Array.from(files)).map(async file => {
               // 计算文件哈希值256方式作为file的唯一标识
               const key = await getFileHash(file)

               //利用axios 的progress
               this.options.requestOptions.onProgress = (async data => {

                  if (onProgress) {
                     onProgress({
                        ...data,
                        file : getFileProto(file as File) as Record<string,unknown>  ,
                        fileHash: key,   //返回文件唯一标识（如用户是以列表形式渲染后主动上传）
                     })
                  }
               }) 
               return this.httpRequest({

                  ...this.options.requestOptions,
                  data: this.handlerFileParmas({
                     ...this.options.uploadOptions,
                     files: file instanceof File ? (() => {
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                        return dataTransfer.files;  
                     })() : (() => {
                        const filterFile = Object.values(file).filter((item) => item instanceof File) 
                        if (filterFile.length) {
                           return filterFile;
                        } else {
                           console.error('file传入的不是File类型,或者没有检测到有File属性');
                           return [];
                        }
                     })(),
                  })
               })
            })
            return await Promise.all(arr)
         }
         httpRes = await smallFileRes()
      }

      if (result) { 
         result(httpRes || [])
      } else {
         return httpRes
      }

      // 如果是input事件，清空input的值
      if (Object.prototype.toString.call(event) === '[object Object]') (event as React.ChangeEvent<HTMLInputElement>).target.value = '';

   }
   /**
    * 
    * @param data 待暂停上传的文件
    * @returns 已暂停上传的文件
    */
   filePausedUpload = async (data: LargeFileUpload['files'] | File) :Promise< LargeFileUpload['files'] | File> => await tools.pausedUpload(data)
   /**
    * 获取blob资源
    * @param {AxiosConfig} config 配置项 
    * @returns {Promise<Blob>} blob 资源
    */
   getResources = async (config: AxiosConfig): Promise<Record<string, any> | string> => {
      const httpRes = await this.httpRequest({
         ...config,
         responseType: 'blob'
      });
      const blob = new Blob(
         [httpRes.data],
         { type: httpRes.data.type }
      );

      const imageUrl = URL.createObjectURL(blob);
      return {
         url: imageUrl,
         type: httpRes.data.type
      };
   }
}
export default UploadEventGather