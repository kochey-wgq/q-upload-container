
import { AxiosRequestConfig } from 'axios';
declare global {
   // 选择文件后触发的参数类型
   type TriggerFileSelectPro = {
      data: EventType,
      onProgress: (parmas: ProgressData) => void,
      result: (parmas: AxiosResponse<any, any>[]) => void
   }
 

   //文件触发器的类型定义
   type EventType = React.ChangeEvent<HTMLInputElement> | Event | FileList

   //文件上传的类型，httpOptions的类型
   interface UploadEventGatherOptions {
      requestOptions: {
         onProgress?: (data: ProgressData) => void,
      } & AxiosRequestConfig,
      uploadOptions: {
         accept?: string[] | string,
         num: number,
         multiple?: boolean,
      }
   }

   //事件类型
   interface UploadEventGatherType<T> {
      options: T,
      triggerFileSelect: (parmas: TriggerFileSelectPro) => (Promise | void),
      getBlob: (config: AxiosConfig) => Promise<string>
   }
   //进度条配置
   interface ProgressData {
      file?:File        // 文件
      error?: string,   // 是否可读取资源
      status: string,      // 上传/下载状态
      percentage: 0,    // 进度
      progressType: string  // 进度条类型
      axiosOrgProgress?: Record<string, any> // 原始axios进度条事件
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