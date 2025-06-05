import CryptoJS from 'crypto-js';
import http from '@/api/request.ts'
type ReturnValidateFiles = { isValid: boolean, invalidFiles: File[] }

type ResponseChunks = {
   apiRes : responseType<{
      chunkSize :number;
      index: number;
      totalChunksSize: number;
   }>,
   fileInfo : LargeFileItem,
   // files: FileList | File[], 
}

type LargeFileUpload = {
   files: FileList | File[], 
   chunkSize?: number,
   maxFileUploads?: number, // 限制文件并发上传的最大数量
   maxFileChunksUploads?: number, // 限制每个文件分片上传的最大数量
   baseURL: string, // 基础URL
   timeout?: number,
   onProgress?: (params: ResponseChunks) => void, // 上传chunk的进度回调函数
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
   add: (fn: Promise<any>) => Promise<unknown>;
   _run: (fileInfo: Record<string, any>) => void;
}


interface LargeFileType {  
   uploadChunk: (chunk: { blob: Blob, index: number,start: number,end: number }, fileHash: string, file: File,totalChunksNum:number) => Promise<any>;
   craeteChunk: (file:File,uploadedChunks:never[],chunkSize:string | number) => Promise<any[]>;
   uploadFile: (fileInfo: LargeFileItem) => Promise<any>;
   getUploadedChunks: (fileHash: string) => Promise<any>;
   startUpload: () => Promise<any>;
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




/**
 * 大文件上传类
 * @implements LargeFileType
 * @description 提供大文件分片上传功能
 */
class LargeFile implements LargeFileType {
   private chunkWorker: Worker = new Worker(new URL('@/workers/createFileChunks.ts', import.meta.url));  //创建文件切片的worker
   private uploadQueue: LargeFileItem[] = []; // 上传队列
   private controllers: Record<string, AbortController> = {};
   readonly chunkSize: LargeFileUpload['chunkSize'] = 1024 * 1024 * 3; // 默认分片大小为3MB
   readonly maxFileUploads: LargeFileUpload['maxFileUploads'] = 3; // 默认文件最大并发上传数为3
   readonly maxFileChunksUploads : LargeFileUpload['maxFileChunksUploads'] = 3; // 限制每个文件分片上传的最大数量
   readonly files: LargeFileUpload['files'] = []; // 初始化为空数组
   readonly baseURL: LargeFileUpload['baseURL'] = ''; // 基础URL初始化为空字符串
   readonly timeout: LargeFileUpload['timeout'] = 0; // 请求超时时间，默认不超时 
   onProgress: LargeFileUpload['onProgress']; // 上传chunk的进度回调函数
   private concurrentFile: RequestConcurrencyType = new RequestConcurrency(this.maxFileUploads as number); //文件的并发
   private concurrentFileChunks : RequestConcurrencyType = new RequestConcurrency(this.maxFileChunksUploads as number); //文件分片的并发
   /**
    * 构造函数
    * @param {LargeFileUpload} params - 大文件上传参数
    */
   constructor(params: LargeFileUpload) {
      const { files, chunkSize, maxFileUploads,maxFileChunksUploads } = params; 
      this.files = files;
      this.chunkSize = chunkSize || this.chunkSize;
      this.maxFileUploads = maxFileUploads || this.maxFileUploads;
      this.maxFileChunksUploads = maxFileChunksUploads || this.maxFileChunksUploads;
      this.baseURL = params.baseURL; // 设置基础URL
      this.timeout = params.timeout; // 设置超时时间 
      this.onProgress = params.onProgress || (() => {}); // 设置上传chunk的进度回调函数，默认不执行任何操作
   }

   /**
    * 分片上传
    * @param {Object} chunk - 分片信息
    * @param {Blob} chunk.blob - 分片数据
    * @param {number} chunk.index - 分片索引
    * @param {number} chunk.start - 分片起始位置
    * @param {number} chunk.end - 分片结束位置
    * @param {string} fileHash - 文件哈希值
    * @param {File} file - 文件对象
    * @param {number} totalChunksNum - 分片总数
    * @returns {Promise<any>} - 上传结果
    */
   async uploadChunk(chunk: { blob: Blob, index: number, start: number, end: number }, fileHash: string, file: File, totalChunksNum: number): Promise<any> {
      const formData = new FormData();
      formData.append('chunk', chunk.blob);
      formData.append('chunkIndex', chunk.index.toString());
      formData.append('fileHash', fileHash);
      formData.append('fileName', file.name);
      formData.append('totalChunksSize', file.size.toString());
      formData.append('fileType', file.type);
      formData.append('totalChunksNum', totalChunksNum.toString());
      const httpRes = await http({
         baseURL: this.baseURL,
         timeout: this.timeout,
         url: '/upload',
         method: 'POST',
         data: formData,
         signal: this.controllers[fileHash]?.signal,
      }); 
      return httpRes;
   }

   /**
    * 创建分片
    * @param {File} file - 文件对象
    * @param {never[]} uploadedChunks - 已上传的分片索引数组
    * @param {string | number} chunkSize - 分片大小
    * @returns {Promise<any[]>} - 分片数组
    */
   craeteChunk(file: File, uploadedChunks: never[], chunkSize: string | number): Promise<any[]> {
      return new Promise((resolve, reject) => {
         this.chunkWorker.postMessage({
            file,
            uploadedChunks,
            chunkSize
         });
         this.chunkWorker.onmessage = ({ data }) => {
            console.log(data, '主线程接收消息');
            resolve(data.data);
         };
         this.chunkWorker.onerror = () => reject([]);
      });
   }

   /**
    * 获取已上传的分片
    * @param {string} fileHash - 文件哈希值
    * @returns {Promise<any>} - 已上传分片信息
    */
   async getUploadedChunks(fileHash: string): Promise<any> {
      const httpRes = await http({
         baseURL: this.baseURL,
         timeout: this.timeout,
         url: '/check',
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
         },
         data: JSON.stringify({ fileHash }),
      });
      return httpRes;
   }

   /**
    * 上传文件
    * @param {LargeFileItem} fileInfo - 文件信息
    * @returns {Promise<any>} - 上传结果
    */
   async uploadFile(fileInfo: LargeFileItem): Promise<any> {
      const { file, fileHash } = fileInfo;
      console.log('开始上传文件:', fileInfo);
      Reflect.set(fileInfo,'status','uploading'); // 更新文件状态为已完成
      // 查询一次已上传的分片
      const alreadyChunks = await this.getUploadedChunks(fileHash);
      console.log('已上传的分片:', alreadyChunks);
      if (alreadyChunks.code === 200) Reflect.set(fileInfo,'uploadedChunks',alreadyChunks.data?.uploadedChunks || []); // 更新已上传的分片索引

      const chunks = await this.craeteChunk(file, fileInfo.uploadedChunks, this.chunkSize as number);
      const totalChunksNum = Math.ceil(file.size / (this.chunkSize as number));

      const controller = new AbortController();
      this.controllers[fileHash] = controller;

      const chunksRes = chunks.map(async chunk => {
         if (fileInfo.status === 'paused') {
            controller.abort();
            return Promise.reject(new Error("上传已暂停"));
         } 
         const resChunks = await this.concurrentFile.add(this.uploadChunk(chunk, fileHash, file, totalChunksNum)) as ResponseChunks['apiRes'] 
         // console.log(resChunks.data.index, '分片上传成功');

         // 查询第二次已上传的分片方便progress
         const actionsChunks = await this.getUploadedChunks(fileHash);
         // console.log('第二次查询已上传的分片:', actionsChunks.data?.uploadedChunks.length / totalChunksNum);


         Reflect.set(fileInfo,'uploadedChunks',actionsChunks.data?.uploadedChunks || []);
         Reflect.set(fileInfo,'progress',Math.round((actionsChunks.data?.uploadedChunks.length / totalChunksNum) * 100)); // 更新文件上传进度
         if(actionsChunks.data?.uploadedChunks.length === totalChunksNum) {
            Reflect.set(fileInfo,'status','done'); // 更新文件状态为已完成

         }
         if(this.onProgress) this.onProgress({
            apiRes : resChunks,  // 分片上传结果
            fileInfo,            // 文件信息
            // files : this.files     // 所有文件 
         })  //更新进度条回调
         return resChunks;
      }); 
      return Promise.all(chunksRes);
   }

   /**
    * 开始上传 
    * @returns {Promise<any>} - 上传结果
    */
   async startUpload(): Promise<any> {
      const files: LargeFileItem[] = Array.from(this.files).map((file: File) => ({
         file,
         progress: 0,
         status: 'pending',
         uploadedChunks: [],
         fileHash: ''
      }));

      const queue = await Promise.all(files.map(async (file) => {
         if (file.status === 'pending' || file.status === 'paused') {
            if (!file.fileHash) Reflect.set(file, 'fileHash', await tools.getFileHash(file.file));
         }
         return file;
      }));

      console.log('开始上传文件队列:', queue);
      return Promise.all(queue.map(async (qu) => this.concurrentFileChunks.add(this.uploadFile(qu)))); 
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
      return largeFile.startUpload()   // chunk的result
     
   }
}

export default tools