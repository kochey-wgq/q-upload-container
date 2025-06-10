
import { AxiosRequestConfig } from 'axios';
declare global {
   // 选择文件后触发的参数类型
   type TriggerFileSelectPro = {
      data: EventType,
      onProgress: (parmas: ProgressData) => void,
      result: (parmas: AxiosResponse<any, any>[]) => void
   }
   
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
      }
      toggleLargefile?: boolean, // 是否开启大文件上传
   }

   //事件类型
   interface UploadEventGatherType<T> {
      options: T,
      triggerFileSelect: (parmas: TriggerFileSelectPro) => (Promise | void),
      getResources: (config: AxiosConfig) => Promise<Record<string,any> | string>
   }
   //进度条配置
   interface ProgressData {
      file?:File        // 文件
      error?: string,   // 是否可读取资源
      status?: string,      // 上传/下载状态
      percentage?: 0,    // 进度
      progressType?: string,  // 进度条类型
      axiosOrgProgress?: Record<string, any>, // 
      apiRes?: AxiosRequestConfig,
      fileInfo?: Record<string, any>
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