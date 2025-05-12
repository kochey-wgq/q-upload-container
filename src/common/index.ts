import CryptoJS from 'crypto-js';

type ReturnValidateFiles = { isValid: boolean, invalidFiles: File[] }

interface Tools {
   validateFiles: (files: File[], acceptRules: string | string[]) => ReturnValidateFiles,
   getFileHash: (file: File) => Promise<string>,
   getFileProto: (file: File) => object
}

/**
 * 工具函数集合
 * @module tools
 * @description 提供文件类型校验、文件哈希计算的工具
 */
const tools: Tools = {
   /**
    * 校验文件类型
    * @param {File[]} files - 文件列表
    * @param {string | string[]} acceptRules - 接受的文件类型规则
    * @returns {Object} - 返回一个对象，包含 isValid 和 invalidFiles 属性
    * isValid: 布尔值，表示文件是否通过校验
    * invalidFiles: 数组，包含不符合规则的文件
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
   }
}

export default tools