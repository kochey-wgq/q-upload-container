
import { AxiosRequestConfig } from 'axios';
import type { LargeFileItem } from '@/common'
declare global {
   // 选择文件后触发的参数类型
   type FileStartUploadPro = {
      data: EventType,
      onProgress: (parmas: ProgressData) => void,
      result: (parmas: AxiosResponse<any, any>[]) => void
   }
   //CompressionImgOptions 插件
   type CompressionImgOptions = Partial<{
      maxSizeMB: number,            // (default: Number.POSITIVE_INFINITY)
      maxWidthOrHeight: number,     // compressedFile will scale down by ratio to a point that width or height is smaller than maxWidthOrHeight (default: undefined)
      // but, automatically reduce the size to smaller than the maximum Canvas size supported by each browser.
      // Please check the Caveat part for details.
      onProgress: (percentage : number | string) => void,         // optional, a function takes one progress argument (percentage from 0 to 100) 
      useWebWorker: boolean,        // optional, use multi-thread web worker, fallback to run in main-thread (default: true)
      libURL: string,               // optional, the libURL of this library for importing script in Web Worker (default: https://cdn.jsdelivr.net/npm/browser-image-compression/dist/browser-image-compression.js)
      preserveExif: boolean,        // optional, use preserve Exif metadata for JPEG image e.g., Camera model, Focal length, etc (default: false)
   
      signal: AbortSignal,          // optional, to abort / cancel the compression
   
      // following options are for advanced users
      maxIteration: number,         // optional, max number of iteration to compress the image (default: 10)
      exifOrientation: number,      // optional, see https://stackoverflow.com/a/32490603/10395024
      fileType: string,             // optional, fileType override e.g., 'image/jpeg', 'image/png' (default: file.type)
      initialQuality: number,       // optional, initial quality value between 0 and 1 (default: 1)
      alwaysKeepResolution: boolean // optional, only reduce quality, always keep width and height (default: false)
   }>
   //http响应返回
   type responseType<T> = {
      code : number;
      msg: string;
      data: T;
   }

   //文件触发器的类型定义
   type EventType = React.ChangeEvent<HTMLInputElement> | Event | FileList

   //文件上传的类型，httpOptions的类型
   interface UploadEventGatherOptions {
      requestOptions: { 
         largeUrl?:{    // 大文件上传地址
            timeout?: number, // 超时时间
            upload: AxiosRequestConfig,   // 大文件上传地址
            check?: AxiosRequestConfig, // 大文件分片的查询地址
            merge?: AxiosRequestConfig, // 大文件分片的合并地址
            second?: AxiosRequestConfig, // 大文件分片的秒传地址
         }, 
         onProgress?: (data: ProgressData) => void,
      } & AxiosRequestConfig,
      uploadOptions: {
         accept?: string[] | string,   // 文件类型限制
         multipleNum?: number,   //文件数量(多文件)
         multiple?: boolean,  // 是否支持多文件上传
         webkitdirectory?: string,  // 是否支持webkit目录上传
         directory?: string,  // 是否支持目录上传
         chunkSize?: number, // 分片大小
         maxFileUploads?: number, // 最大文件上传数量
         maxFileChunksUploads?: number, // 最大分片上传数量
         compressionOptions? : CompressionImgOptions  // 压缩图片参数
      }
      toggleLargefile?: boolean, // 是否开启大文件上传
      toggleCompressionImg?: boolean, // 是否开启图片压缩
   }

   //事件类型
   interface UploadEventGatherType<T> {
      options: T,    // 上传数据 
      fileStartUpload: (parmas: FileStartUploadPro) => (Promise | void), // 文件上传
      filePausedUpload: (data: LargeFileItem | LargeFileItem[]) => Promise< LargeFileItem | LargeFileItem[]>,  // 文件暂停上传
      getResources: (config: AxiosConfig) => Promise<Record<string,any> | string>   // 获取上传资源
   }
   //进度条配置
   interface ProgressData {
      file?:File | Record<string,unknown>        // 文件
      fileHash?:string,  // 文件hash
      error?: string,   // 是否可读取资源
      status?: string,      // 上传/下载状态
      percentage?: 0,    // 进度
      progressType?: string,  // 进度条类型
      axiosOrgProgress?: Record<string, unknown>,  
      apiRes?: AxiosRequestConfig,
      fileInfo?: Record<string, unknown>
   }
   //aside配置
   interface AxiosConfig extends AxiosRequestConfig {
      businesCode?: {
         businesSuccCode?: number | string;
         businesFailCode?: number | string;
      },
   }
   //blob参数
   interface BlobOptions {
      blobParts?: BlobPart[],
      options?: BlobPropertyBag
   }
}
export { } // 确保这个文件被视为模块