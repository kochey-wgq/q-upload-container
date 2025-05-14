import CryptoJS from 'crypto-js';

type ReturnValidateFiles = { isValid: boolean, invalidFiles: File[] }

type CreateFileChunksPar = {
   files: FileList | File[],
   uploadedChunks?: number[],
   CHUNK_SIZE?: number,
}

type CreateFileChunksReturn = { index: number, blob: Blob, start: number, end: number }
interface Tools {
   validateFiles: (files: File[], acceptRules: string | string[]) => ReturnValidateFiles,
   getFileHash: (file: File) => Promise<string>,
   getFileProto: (file: File) => object,
   createFileChunks: (params: CreateFileChunksPar) => CreateFileChunksReturn[],
}

/**
 * 工具函数集合
 * @module tools
 * @description 提供文件类型校验、文件哈希计算的工具
/** @type {*} */
const tools: Tools = {
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
   createFileChunks: (params: CreateFileChunksPar): CreateFileChunksReturn[] => {
      const { uploadedChunks = [], CHUNK_SIZE = 5 * 1024 * 1024 } = params;
      // 处理文件列表(类数组)
      const files = Array.from(params.files);


      const fileChunks = files.map((file: File) => {

         const chunkData: { 
            chunks:CreateFileChunksReturn[], // 文件切片列表
            start: number,
            end: number,
            chunkIndex: number
         } = { 
            chunks : [],
            start: 0,
            end: Math.min(CHUNK_SIZE, file.size),
            chunkIndex: 0,
         }  

         // 开始文件切片
         while(chunkData.start < file.size) {
            // 跳过已上传的分片
            if(!uploadedChunks.includes(chunkData.chunkIndex)) {
               chunkData.chunks.push({
                  index: chunkData.chunkIndex,
                  start : chunkData.start,
                  end: chunkData.end, 
                  blob: file.slice(chunkData.start, chunkData.end),
               });
            }
            //更新切片的起始和结束位置
            chunkData.start = chunkData.end;
            chunkData.end = Math.min(chunkData.start + CHUNK_SIZE, file.size);
            chunkData.chunkIndex++;
         }
         return chunkData.chunks
      })
      //二维转一维
      console.log(fileChunks, '切片文件')
      return fileChunks.flat();
   }
}

export default tools