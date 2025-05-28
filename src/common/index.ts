import CryptoJS from 'crypto-js';
import http from '@/api/request.ts'
type ReturnValidateFiles = { isValid: boolean, invalidFiles: File[] }

type LargeFileUpload = {
   files: FileList | File[], 
   chunkSize?: number,
   maxUploads?: number, // 限制并发上传的最大数量
   baseURL: string, // 基础URL
}

type LargeFileItem = {
   file: File;
   progress: number;
   status: string;
   uploadedChunks: never[];
   fileHash: string;
}
interface Tools {
   chunkWorker: Worker,
   controllers: Record<string, AbortController>,
   uploadQueue: LargeFileItem[],
   validateFiles: (files: File[], acceptRules: string | string[]) => ReturnValidateFiles,
   getFileHash: (file: File) => Promise<string>,
   getFileProto: (file: File) => object,
   largeFileUpload: (params: LargeFileUpload) => any
}

interface RequestConcurrencyType {
   max: number;
   current: number;
   queue: any[];
   add: (fn: Promise<any>, fileInfo: Record<string, any>) => Promise<unknown>;
   _run: (fileInfo: Record<string, any>) => void;
}


interface LargeFileType {  
   uploadChunk: (chunk: { blob: Blob, index: number,start: number,end: number }, fileHash: string, file: File) => Promise<any>;
   craeteChunk: (file:File,uploadedChunks:never[],chunkSize:string | number) => Promise<any[]>;
   uploadFile: (fileInfo: LargeFileItem) => Promise<any>;
}

/**
 *  请求并发控制类 
 * @property {number} max - 最大并发数
 * @property {number} current - 当前并发数
 * @property {any[]} queue - 请求队列  
 */
class RequestConcurrency implements RequestConcurrencyType {
   readonly max: number;
   current: number;
   queue: any[];
   constructor(max: number) {
      this.max = max;
      this.current = 0;
      this.queue = [];
   }
   add(fn: Promise<any>) {
      
      return new Promise((resolve, reject) => { 
         this.queue.push({ fn, resolve, reject });
         this._run();
      });
   }
   _run() {
      
      while (this.current < this.max && this.queue.length) {
         const { fn, resolve, reject } = this.queue.shift();  
         this.current++;
         fn.then(resolve)
            .catch(reject)
            .finally(() => {
               this.current--;
               this._run();
            });
      }
   }
}




class LargeFile extends RequestConcurrency implements LargeFileType {
   private chunkWorker  : Worker = new Worker(new URL('@/workers/createFileChunks.ts', import.meta.url));
   private uploadQueue : LargeFileItem[] = [];  // 上传队列
   private controllers  : Record<string, AbortController> = {};
   readonly chunkSize: LargeFileUpload['chunkSize'] = 1024 * 1024 * 3; // 默认分片大小为3MB
   readonly maxUploads: LargeFileUpload['maxUploads'] = 3; // 默认最大并发上传数为3
   readonly files: LargeFileUpload['files'] = []; // 初始化为空数组
   readonly baseURL: LargeFileUpload['baseURL'] = ''; // 基础URL初始化为空字符串

   constructor( parmas:LargeFileUpload) { 
      const { files, chunkSize, maxUploads } = parmas;
      super(maxUploads as number);
      this.files = files
      this.chunkSize = chunkSize || this.chunkSize;
      this.maxUploads = maxUploads || this.maxUploads;
      this.baseURL = parmas.baseURL; // 设置基础URL
      
   }
   //分片上传
   async uploadChunk (chunk: { blob: Blob, index: number,start: number,end: number }, fileHash: string, file: File): Promise<any> {
      const formData = new FormData()
      formData.append('chunk', chunk.blob)
      formData.append('chunk-index', chunk.index.toString())
      formData.append('file-hash', fileHash)
      formData.append('file-name', file.name)
      formData.append('total-chunks', file.size.toString())
      formData.append('file-type', file.type)
      const httpRes = await http({
         timeout :0,
         baseURL: this.baseURL,
         url: '/upload',
         method: 'POST', 
         data: formData,
         signal: this.controllers[fileHash]?.signal,
      }); 

      return httpRes
   }
   //分片创建
   craeteChunk(file:File,uploadedChunks:never[],chunkSize:string | number):Promise<any[]>{
      return new Promise((resolve,reject) => {
         this.chunkWorker.postMessage({
            file,
            uploadedChunks,
            chunkSize
         });
         this.chunkWorker.onmessage = ({data}) => {
            console.log(data,'主线程接收消息') 
            resolve(data.data)
         }
         this.chunkWorker.onerror = () => reject([])
      })
   }
   // 文件上传
   async uploadFile(fileInfo:LargeFileItem) {
      // 获取文件信息
      const { file, fileHash } = fileInfo
      console.log('开始上传文件:', fileInfo);
      
      // 获取文件分块
      const chunks = await this.craeteChunk(file, fileInfo.uploadedChunks, this.chunkSize as number);
      // 获取文件分块总数量
      const totalChunksNum = Math.ceil(file.size / (this.chunkSize as number));

      // 检查已上传的分片
      const httpRes = await http({
         baseURL: this.baseURL,
         url: '/check',
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         data: JSON.stringify({ fileHash }),
      }); 
      if(httpRes.data === 200){
         fileInfo.uploadedChunks = httpRes.data.uploadedChunks || [];
      }

      // 分片API控制器
      const controller  = new AbortController();
      this.controllers[fileHash] = controller;

      //开始上传当前文件逐片上传
      for  (let i = 0; i < chunks.length; i++) {
         //如果当前文件处于暂停状态，则跳过当前文件
         if(fileInfo.status === 'paused'){
            controller.abort()
            break
         }
         // 逐片上传
         const success = await this.uploadChunk(chunks[i], fileHash, file);
         return success
         // if(success.data.code === 200){
         //    fileInfo.uploadedChunks.push(chunks[i].index)
         //    const progress = Math.round((fileInfo.uploadedChunks.length / chunks.length) * 100)
         // }else{
         //    return
         // }
      }

   }

   // 开始上传
   async startUpload(){ 
      const files:LargeFileItem[] = Array.from(this.files).map((file: File) => ({
         file,
         progress: 0, // 上传进度初始化为0
         status: 'pending', // 初始状态为等待上传
         uploadedChunks: [], // 已上传的分片索引数组
         fileHash: '' // 文件哈希初始为null，稍后计算
      })) 

      // 准备上传队列，只包含待上传或暂停的文件
      const queue = await Promise.all(files.map(async (file) => {
         if(file.status === 'pending' || file.status === 'paused'){
            if(!file.fileHash) Reflect.set(file, 'fileHash',await tools.getFileHash(file.file)) 
         }
         return file
      }))

      console.log('开始上传文件队列:', queue);
      // if(true) return
      for(let i = 0; i < queue.length; i++){
         // 调用父类并发实例的add方法
         super.add(this.uploadFile(queue[i])).then((res) => {
            console.log(res,'上传成功')
         })
      }
   }
}









/**
 * 工具函数集合
 * @module tools
 * @description 提供文件类型校验、文件哈希计算的工具
/** @type {*} */
const tools: Tools = {
   chunkWorker : new Worker(new URL('@/workers/createFileChunks.ts', import.meta.url)),
   uploadQueue: [],
   controllers : {},
   /**
    * 校验文件类型
    * @param {File[]} files - 文件列表
    * @param {string | string[]} acceptRules - 接受的文件类型规则
    * @returns {Object} - 返回一个对象，包含 isValid 和 invalidFiles 属性
    * @property {boolean} Object.isValid - 是否所有文件都符合规则
    * @property {File[]} Object.invalidFiles - 不符合规则的文件列表
    */
   validateFiles: (files: File[], acceptRules: string | string[]): ReturnValidateFiles => {
      const invalidFiles: File[] = [];
      let isValid = true;
      if (!acceptRules || acceptRules.length === 0) {
         return { isValid, invalidFiles };
      }

      // 确保files总是数组形式
      const fileList = files


      for (const file of fileList) {
         const extension = (`.${file.name.split('.')[1]}`).toLowerCase()
         const mimeType = file.type.toLowerCase();
         let fileValid = false;

         for (const rule of acceptRules) {
            // 处理通配符情况
            if (rule.endsWith('/*')) {
               const category = rule.split('/*')[0];
               if (mimeType.startsWith(category)) {
                  fileValid = true;
                  break;
               }
            }
            // 处理具体 MIME 类型
            else if (rule.includes('/')) {
               if (mimeType === rule.toLowerCase()) {
                  fileValid = true;
                  break;
               }
            }
            // 处理文件扩展名
            else {
               if (extension === rule.toLowerCase()) {
                  fileValid = true;
                  break;
               }
            }
         }
         // 不符合的资源都返回客户端
         if (!fileValid) {
            isValid = false;
            (invalidFiles).push(file);
         }
      }

      return {
         isValid,
         invalidFiles
      };
   },
   /**
    * 计算文件的 SHA-256哈希值
    * @param {File} file - 要计算哈希值的文件
    * @returns {Promise<string>} - 返回一个 Promise，解析为文件的 SHA-256哈希值
    */
   getFileHash: (file: File): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
         const reader = new FileReader();

         reader.onload = function (e: ProgressEvent<FileReader>) {
            try {
               if (!e.target?.result) {
                  throw new Error('File reading failed - no result');
               }

               const fileData = e.target.result as ArrayBuffer;
               // 计算SHA-256哈希
               const wordArray = CryptoJS.lib.WordArray.create(
                  new Uint8Array(fileData)
               );
               const hash = CryptoJS.SHA256(wordArray);
               resolve(hash.toString(CryptoJS.enc.Hex));
            } catch (error) {
               reject(error);
            }
         };

         reader.onerror = function () {
            reject(new Error(`File reading failed: ${reader.error?.message || 'Unknown error'}`));
         };

         reader.readAsArrayBuffer(file);
      });
   },
   /**
    * 
    * @param file - 文件对象
    * @description 过滤文件对象，去除不必要的属性，只保留标准属性
    * @returns  {File} - 过滤后的文件对象
    */
   getFileProto: (file: any): File => {

      const standardProps = [
         'name', 'size', 'type', 'lastModified',
         'lastModifiedDate', 'webkitRelativePath'
      ]

      const filtered = standardProps.reduce<Record<string, any>>((pre, cur) => {
         if (file[cur] !== undefined) {
            pre[cur] = file[cur];
         }
         return pre;
      }, {});
      return filtered as File
   },

   /**
    * 创建文件切片
    * @param {CreateFileChunksPar} params - 文件数据
    * @param {CreateFileChunksPar.files} params.files - 要切片的文件列表
    * @param {CreateFileChunksPar.uploadedChunks} params.uploadedChunks - 已上传的切片索引数组
    * @param {CreateFileChunksPar.chunkSize} params.chunkSize - 切片大小，默认值为 3MB
    * @returns {Array<CreateFileChunksReturn>} - 返回一个包含文件切片的数组
    */
   largeFileUpload (params: LargeFileUpload):any {  
      const largeFile = new LargeFile(params);
      largeFile.startUpload()
     
   }
}

export default tools