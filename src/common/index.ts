import CryptoJS from 'crypto-js';
import http from '@/api/request.ts'
import { AxiosRequestConfig } from 'axios';
import imageCompression from 'browser-image-compression';
type ReturnValidateFiles = { isValid: boolean, invalidFiles: File[] }

type ResponseChunks<T> = {
   apiRes: responseType<T>,
   fileInfo: LargeFileItem,
}
type ResponseChunksJSON = {
   chunkSize: number;   // 切片大小
   index: number;      // 切片索引
   totalChunksSize: number;   // 切片总大小
   uploadedChunks: number[];  // 已经上传的切片索引
}

type ResponseMergeJSON = {
   originalname: string, // 原始文件名
   mimetype: string, // 文件的 MIME 类型
   suffixType: string, // 扩展名
   destination: string, // 文件存放的目录
   fileName: string, // 文件名
   path: string, // 文件的完整路径
   size: number // 文件大小
}
export type LargeFileUpload = {
   files: FileList | File[],
   chunkSize?: number,  // 分片大小
   maxFileUploads?: number, // 限制文件并发上传的最大数量
   maxFileChunksUploads?: number, // 限制每个文件分片上传的最大数量
   largeUrl?: { // 大文件上传相关的URL
      timeout?: number, // 超时时间，默认不超时
      upload: AxiosRequestConfig, // 大文件分片上传地址
      check?: AxiosRequestConfig, // 大文件分片的查询地址
      merge?: AxiosRequestConfig, // 大文件分片的合并地址
      second?: AxiosRequestConfig, // 大文件分片的秒传地址
   },
   baseURL: string, // 基础URL 
   onProgress?: <T>(params: ResponseChunks<T>) => void, // 上传chunk的进度回调函数
}

type LargeFileItem = {
   file: File;
   progress: number;
   status: string;
   uploadedChunks: never[];
   fileHash: string;
   uploadedBytes: number; // 已上传的字节数
}
interface Tools {
   chunkWorker: Worker,
   largeFile: LargeFileType | null,
   validateFiles: (files: File[], acceptRules: string | string[]) => ReturnValidateFiles,
   getFileHash: (file: File | Record<string, any>) => Promise<string>,
   getFileProto: (file: File) => object,
   largeFileUpload: () => Promise<LargeFileItem[]>,
   initLargeUplod: (params: LargeFileUpload) => void,
   pausedUpload: (target: LargeFileUpload['files'] | File) => Promise<LargeFileUpload['files'] | File>,
   compressionImg:(options: CompressionImgOptions, file: File) => Promise<File>,
}

interface RequestConcurrencyType {
   max: number;
   current: number;
   queue: unknown[];
   isPaused: boolean;
   pause: () => void;
   resume: () => void;
   add: (fn: Promise<unknown>) => Promise<unknown>;
   _run: (fileInfo: Record<string, unknown>) => void;
}


interface LargeFileType {
   uploadChunk: (chunk: { blob: Blob, index: number, start: number, end: number }, fileHash: string, file: File, totalChunksNum: number) => Promise<any>;
   craeteChunk: (file: File, uploadedChunks: never[], chunkSize: string | number) => Promise<any[]>;
   uploadFile: (fileInfo: LargeFileItem) => Promise<any>;
   getUploadedChunks: (fileHash: string) => Promise<any>;
   startUpload: () => Promise<any>;
   secondUpload: (fileHash: string) => Promise<any>;
   pausedUploadChunk: (target: LargeFileUpload['files'] | File) => Promise<LargeFileUpload['files'] | File[]>
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
   isPaused: boolean; // 是否暂停状态
   constructor(max: number) {
      this.max = max;
      this.current = 0;
      this.queue = [];
      this.isPaused = false;  //暂停并发发出
   }
   add(fn: Promise<any>) {

      return new Promise((resolve, reject) => {
         if (this.isPaused) {
            return reject(new Error("Upload paused")); // 直接拒绝新任务
         }
         this.queue.push({ fn, resolve, reject });
         this._run();
      });

   }
   pause() {
      this.isPaused = true;
      this.queue = []; // 清空未执行的任务队列
   }

   resume() {
      this.isPaused = false;
      this._run(); // 恢复时重新启动队列
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
   private controller: Record<string, AbortController> = {};     // 控制器，用于取消上传请求
   largeUrl: LargeFileUpload['largeUrl'] // 大文件上传相关的URL
   readonly chunkSize: LargeFileUpload['chunkSize'] = 1024 * 1024 * 3; // 默认分片大小为3MB
   readonly maxFileUploads: LargeFileUpload['maxFileUploads'] = 3; // 默认文件最大并发上传数为3
   readonly maxFileChunksUploads: LargeFileUpload['maxFileChunksUploads'] = 3; // 限制每个文件分片上传的最大数量
   readonly files: LargeFileUpload['files'] = []; // 源文件列表，初始化为空数组
   readonly baseURL: LargeFileUpload['baseURL'] = ''; // 基础URL初始化为空字符串  
   onProgress: LargeFileUpload['onProgress']; // 上传chunk的进度回调函数
   private concurrentFile: RequestConcurrencyType = new RequestConcurrency(this.maxFileUploads as number); //文件的并发
   private concurrentFileChunks: RequestConcurrencyType = new RequestConcurrency(this.maxFileChunksUploads as number); //文件分片的并发
   /**
    * 构造函数
    * @param {LargeFileUpload} params - 大文件上传参数
    */
   constructor(params: LargeFileUpload) {
      const { files, chunkSize, maxFileUploads, maxFileChunksUploads } = params;
      this.files = files;
      this.chunkSize = chunkSize || this.chunkSize;
      this.maxFileUploads = maxFileUploads || this.maxFileUploads;
      this.maxFileChunksUploads = maxFileChunksUploads || this.maxFileChunksUploads;
      this.largeUrl = params.largeUrl; // 设置大文件上传相关的URL
      this.baseURL = params.baseURL; // 设置基础URL 
      this.onProgress = params.onProgress || (() => { }); // 设置上传chunk的进度回调函数，默认不执行任何操作
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
         ...(() => {
            const defaultPar = {
               method: 'POST',
            }
            return {
               timeout: this.largeUrl?.timeout,
               ...defaultPar,
               ...this.largeUrl?.upload, // 合并大文件的上传地址配置
            }
         })(),
         data: formData,
         signal: this.controller[fileHash]?.signal,
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
      return new Promise(resolve => {
         const chunkWorker: Worker = new Worker(new URL('@/workers/createFileChunks.ts', import.meta.url));  //创建文件切片的worker
         chunkWorker.postMessage({
            file,
            uploadedChunks,
            chunkSize
         });
         chunkWorker.onmessage = ({ data }) => {
            console.log(data, '主线程接收消息');
            resolve(data.data);
         };
         chunkWorker.onerror = () => resolve([]);
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
         ...(() => {
            const defaultPar = {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
               }
            }
            return {
               timeout: this.largeUrl?.timeout,
               ...defaultPar,
               ...this.largeUrl?.check, // 合并大文件的查询地址配置
            }
         })(),
         data: JSON.stringify({ fileHash }),
      });
      return httpRes;
   }
   /**
    * @param fileHash 文件哈希值
    * @param fileName 文件名
    * @description 合并文件分片
    */
   async mergeFileChunks(fileHash: string, fileName: string): Promise<any> {
      const httpRes = await http({
         baseURL: this.baseURL,
         ...(() => {
            const defaultPar = {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
               }
            }
            return {
               timeout: this.largeUrl?.timeout,
               ...defaultPar,
               ...this.largeUrl?.merge, // 合并大文件的合并地址配置
            }
         })(),
         data: JSON.stringify({
            fileHash,
            fileName,
         }),
      });
      return httpRes;
   }
   /** 
    * @param fileHash 文件哈希值
    * @returns {Promise<any>} - 秒传结果
    */
   async secondUpload(fileHash: string): Promise<any> {
      const httpRes = await http({
         baseURL: this.baseURL,
         ...(() => {
            const defaultPar = {
               method: 'GET',
            }
            return {
               timeout: this.largeUrl?.timeout,
               ...defaultPar,
               ...this.largeUrl?.second, // 合并大文件的秒传地址配置
            }
         })(),
         params: { fileHash },
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
      // 计算总分片数
      const totalChunksNum = Math.ceil(file.size / (this.chunkSize as number));
      //API控制器
      const controller = new AbortController();
      this.controller[fileHash] = controller
      //通知服务器合并分片
      const mergeChunk = async (): Promise<responseType<ResponseMergeJSON>> => {
         console.log(fileHash, '合并完成')

         Reflect.set(fileInfo, 'merged', true);
         // 通知服务器合并分片
         const apiRes = await this.mergeFileChunks(fileHash, file.name);
         Reflect.set(fileInfo, 'status', 'done'); // 更新文件状态为已完成
         return apiRes;
      }


      // 是否存在文件而秒传
      const secondRes = await this.secondUpload(fileHash); // 秒传


      if (secondRes.code === 200 && secondRes.data) {
         Reflect.set(fileInfo, 'progress', 100); // 更新文件上传进度
         Reflect.set(fileInfo, 'status', 'done');
         if (this.onProgress) this.onProgress<number>({
            apiRes: secondRes,              // 分片上传结果
            fileInfo,            // 文件信息  
         })
         return Promise.resolve([]); // 返回已完成的文件信息
      }





      // 更新文件状态为上传中
      Reflect.set(fileInfo, 'status', 'uploading');
      this.concurrentFileChunks.resume(); // 恢复分片上传的并发控制

      // 查询一次已上传的分片
      const alreadyChunks = await this.getUploadedChunks(fileHash);
      // console.log('开始上传-已上传的分片:', alreadyChunks);


      //首次先查询更新文件状态、获取已上传的分片大小
      if (alreadyChunks.code === 200) {
         // 更新已上传字节数
         if (alreadyChunks.data.uploadedChunks.length) fileInfo.uploadedBytes = +((this.chunkSize as number) * alreadyChunks.data.uploadedChunks.length)
         console.log('第一次的上传字节:', fileInfo.uploadedBytes, totalChunksNum);


         //如果上传的分片数量等于总分片数，说明文件已经上传完成
         if (alreadyChunks.data.uploadedChunks.length === totalChunksNum) {
            const apiRes = await mergeChunk(); // 合并分片
            Reflect.set(fileInfo, 'progress', 100); // 更新文件上传进度
            if (this.onProgress) this.onProgress<ResponseMergeJSON>({
               apiRes,              // 分片上传结果
               fileInfo,            // 文件信息  
            })
            return Promise.resolve([]); // 返回已完成的文件信息
         }

         Reflect.set(fileInfo, 'uploadedChunks', alreadyChunks.data?.uploadedChunks || []); // 更新已上传的分片索引

      }

      console.log('开始上传文件:', fileInfo);
      const chunks = await this.craeteChunk(file, fileInfo.uploadedChunks, this.chunkSize as number);

      console.log('创建的分片:', chunks, 'fileHash:', fileHash);

      //开始chunk依次并发上传
      const chunksRes = chunks.map(async chunk => {

         try {
            // 并发分片上传
            const apiRes = await this.concurrentFileChunks.add(this.uploadChunk(chunk, fileHash, file, totalChunksNum)) as responseType<ResponseChunksJSON>
            if (apiRes.code === 200) {

               // console.log(apiRes.data.index, '分片上传成功');
               console.log(fileInfo.status, '文件状态');
               fileInfo.uploadedBytes += apiRes.data.chunkSize; // 累加已上传字节  
               console.log('持续上传字节:', fileInfo.uploadedBytes);
               console.log('正在上传-已上传的分片:', fileInfo.uploadedBytes / file.size, fileInfo.uploadedBytes, file.size);
               const progress = Math.round((fileInfo.uploadedBytes / file.size) * 100 >= 100 ? 100 : Math.round((fileInfo.uploadedBytes / file.size) * 100))

               Reflect.set(fileInfo, 'progress', progress); // 更新文件上传进度



               //判断服务器的分片是否全部上传完成
               if (!Reflect.has(fileInfo, 'merged') && fileInfo.uploadedBytes >= file.size) {
                  await mergeChunk(); // 合并分片

               }
               if (fileInfo.uploadedBytes / file.size < 1) {
                  console.log('还在存储');
                  localStorage.setItem(`progress-${fileHash}`, String(progress)); // 存储上传进度到本地存储
               } else {
                  console.log('已经上传完毕');
                  localStorage.removeItem(`progress-${fileHash}`); // 如果上传合并完成，移除本地存储的进度
               }
               if (this.onProgress) this.onProgress<ResponseChunksJSON>({
                  apiRes,  // 分片上传结果
                  fileInfo,            // 文件信息  
               })  //更新进度条回调
            }
            return apiRes;
         } catch (error) {
            console.error('分片上传失败:', error);
            Reflect.set(fileInfo, 'status', 'error'); // 更新文件上传进度
            if (this.onProgress) this.onProgress({
               apiRes: [] as any,  // 分片上传结果
               fileInfo,            // 文件信息  
            })
            return Promise.reject([])
         }
      });
      return Promise.allSettled(chunksRes);
   }
   /**
    * 暂停上传
    * @param fileInfo 文件信息
    * @param fileHash  文件哈希值
    */
   async pausedUploadChunk(target: LargeFileUpload['files'] | File): Promise<LargeFileUpload['files'] | File[]> {
      // 更新状态
      const editStatus = (fileHash: string, file: LargeFileUpload['files'] | File) => {
         this.controller[fileHash].abort();
         Reflect.set(file, 'status', 'paused');
         this.concurrentFileChunks.pause(); // 暂停分片上传的并发控制
      }
      //如果是单文件暂停
      if (target instanceof File) {

         const fileHash = await tools.getFileHash(target as File)

         if (this.controller[fileHash]) {
            editStatus(fileHash, target);
         }

         return Promise.resolve([target]);
      } else if (Object.prototype.toString.call(target) === '[object Array]') {

         Array.from(target as LargeFileUpload['files']).forEach(async fileInfo => {

            const fileHash = await tools.getFileHash(fileInfo)

            if (this.controller[fileHash]) {
               editStatus(fileHash, fileInfo);
            }
         })

         return Promise.resolve(target);
      }

      return Promise.resolve([]);
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
         uploadedBytes: 0,
         fileHash: ''
      }));
      const queue = await Promise.all(files.map(async file => {
         Reflect.set(file, 'fileHash', await tools.getFileHash(file.file))
         return file
      }));

      // console.log('开始上传文件队列:', queue);
      return Promise.all(queue.map(async (qu) => await this.concurrentFile.add(this.uploadFile(qu))));
   }
}









/**
 * 工具函数集合
 * @module tools
 * @description 提供文件类型校验、文件哈希计算的工具
/** @type {*} */
const tools: Tools = {
   chunkWorker: new Worker(new URL('@/workers/createFileChunks.ts', import.meta.url)),
   largeFile: null,
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
   getFileHash: (file: File | Record<string, any>): Promise<string> => {
      return new Promise<string>((resolve, reject) => {
         try { // 如果传输过来的是File文件
            if (file instanceof File) {
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
            } else {
               // 处理普通JS对象（转为JSON字符串再哈希）
               const jsonString = JSON.stringify(file);
               const hash = CryptoJS.SHA256(jsonString);
               resolve(hash.toString(CryptoJS.enc.Hex));
            }
         } catch (error) {
            reject(error);
         }


      });
   },
   /**
    * 获取file文件原型链数据
    * @param {File} file - 文件对象
    * @description 过滤文件对象，去除不必要的属性，只保留标准属性
    * @returns  {File} - 过滤后的文件对象
    */
   getFileProto: (file: File): Record<string, any> => {

      const standardProps = [
         'name', 'size', 'type', 'lastModified',
         'lastModifiedDate', 'webkitRelativePath'
      ]

      const filtered = standardProps.reduce<Record<string, any>>((pre, cur) => {
         if ((file as Record<string, any>)[cur]) {
            pre[cur] = (file as Record<string, any>)[cur];
         }
         return pre;
      }, {});
      return filtered
   },
   /**
    * 创建文件切片
    * @param {LargeFileUpload} params - 文件数据
    * @param {LargeFileUpload.files} params.files - 要切片的文件列表
    * @param {LargeFileUpload.chunkSize} params.chunkSize - 分片大小
    * @param {LargeFileUpload.maxFileUploads} params.maxFileUploads - 限制文件并发上传的最大数量
    * @param {LargeFileUpload.maxFileChunksUploads} params.maxFileChunksUploads - 限制每个文件分片上传的最大数量
    * @param {LargeFileUpload.largeUrl} params.largeUrl - 大文件的上传地址
    * @param {LargeFileUpload.baseURL} params.baseURL - baseURL基础url
    * @param {LargeFileUpload.onProgress} params.onProgress - 进度回调函数，接收一个参数，为上传进度信息
    * @returns {Array<CreateFileChunksReturn>} - 返回一个包含文件切片的数组
    */
   initLargeUplod(params: LargeFileUpload): void {
      this.largeFile = new LargeFile(params);
   },
   // 开始上传
   largeFileUpload(): Promise<LargeFileItem[]> {
      return this.largeFile?.startUpload() as Promise<LargeFileItem[]>  // chunk的result 
   },
   /**
    * 暂停上传
    * @param {FileList | File[] | File} target - 暂停上传的目标分片 
    * @returns 暂停上传的数据
   */
   async pausedUpload(target: LargeFileUpload['files'] | File): Promise<LargeFileUpload['files'] | File> {
      return this.largeFile ? await this.largeFile.pausedUploadChunk(target) : Promise.reject('未检测到上传文件')
   },
   /** 
    * @param {CompressionImgOptions} options - 上传参数
    * @param {File} file 
    * @returns file - 压缩后的图片
    */
   async compressionImg(options: CompressionImgOptions, file: File): Promise<File> {
 
      try {
         const compressedFile = await imageCompression(file, options);
         console.log('compressedFile instanceof Blob', compressedFile instanceof Blob); // true
         console.log(`compressedFile size ${compressedFile.size / 1024 / 1024} MB`); // smaller than maxSizeMB

         console.log(compressedFile, 'compressedFile')
         return new File([compressedFile], file.name, {
            type: file.type,
            lastModified: file.lastModified
         });
      } catch (error) {
         console.error('图片压缩失败:', error);
         return file; // 返回源文件
      }
   }
}

export default tools