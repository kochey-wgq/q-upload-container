import CryptoJS from 'crypto-js';

type ReturnValidateFiles = { isValid: boolean, invalidFiles: File[] }

type LargeFileUpload = {
   files: FileList | File[], 
   chunkSize?: number,
}


interface Tools {
   uploadQueue: any[],
   validateFiles: (files: File[], acceptRules: string | string[]) => ReturnValidateFiles,
   getFileHash: (file: File) => Promise<string>,
   getFileProto: (file: File) => object,
   largeFileUpload: (params: LargeFileUpload) => any
}

interface RequestConcurrencyType {
   max: number;
   current: number;
   queue: any[];
   add: (item: any) => void;
}


// 请求并发数
class RequestConcurrency implements RequestConcurrencyType{
   max: number;
   current: number;
   queue: any[];
   constructor (max: number) {
      this.max = max;
      this.current = 0;
      this.queue = [];
   }
   add(fn:Promise<any>) {
      return new Promise((resolve, reject) => {
         this.queue.push({fn, resolve, reject})
         this._run()
      })
   }
   _run(){

   }
}














/**
 * 工具函数集合
 * @module tools
 * @description 提供文件类型校验、文件哈希计算的工具
/** @type {*} */
const tools: Tools = {
   uploadQueue: [],
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
    * @param {CreateFileChunksPar.CHUNK_SIZE} params.CHUNK_SIZE - 切片大小，默认值为 5MB
    * @returns {Array<CreateFileChunksReturn>} - 返回一个包含文件切片的数组
    */
   largeFileUpload (params: LargeFileUpload):any { 
      const worker = new Worker(new URL('@/workers/createFileChunks.ts', import.meta.url));
      const { chunkSize,maxUploads} = params
      const files = Array.from(params.files).map((file: File) => ({
         file,
         progress: 0, // 上传进度初始化为0
         status: 'pending', // 初始状态为等待上传
         uploadedChunks: [], // 已上传的分片索引数组
         fileHash: null // 文件哈希初始为null，稍后计算
      }))

      // 上传队列
      const processUploadQueue  = () => {


      }
      // 开始上传
      const startUpload = () =>{
         const queue = files.map((file) => {
            if(file.status === 'pending' || file.status === 'paused'){
               if(!file.fileHash) Reflect.set(file, 'fileHash', this.getFileHash(file.file))
            }
         })

         for(let i = 0; i < Math.min(queue.length, maxUploads); i++){
            processUploadQueue()
         }
      }
 
      worker.postMessage(params);
      worker.onmessage = ({data}) => {
         console.log(data,'主线程接收消息')
         
      }
   }
}

export default tools