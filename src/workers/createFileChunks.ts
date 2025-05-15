import http from '@/api/request.ts'
type CreateFileChunksReturn = { index: number, blob: Blob, start: number, end: number }
self.onmessage = async ({ data }) => {
   console.log('worker from createFileChunks:', data);
   const controllers = {}

   // 创建文件切片
   const craeteChunk = (file: File, uploadedChunks: number[] = [], CHUNK_SIZE = 3 * 1024 * 1024) => {
      // 切片集
      const chunks = [];
      //初始切头
      let start = 0;
      // 初始切尾
      let end = Math.min(CHUNK_SIZE, file.size);
      // 初始切片索引
      let chunkIndex = 0;

      while (start < file.size) {
         //  判断当前切片索引是否已经上传
         if (!uploadedChunks.includes(chunkIndex)) {
            chunks.push({
               index: chunkIndex,
               start,
               end,
               blob: file.slice(start, end),
            });
         }
         //  更新切片索引和切片范围
         start = end;
         end = Math.min(start + CHUNK_SIZE, file.size);
         chunkIndex++;
      }

      return chunks;
   };


   //分片上传
   const uploadChunk = async (chunk,fileHash,file) => {
      const formData = new FormData()
      formData.append('chunk', chunk.blob)
      formData.append('chunkIndex', chunk.index)
      formData.append('fileHash', fileHash)
      formData.append('fileName', file.name)
      const httpRes = await http({
         url: '/api/file/check',
         method: 'POST', 
         data: formData,
         signal: controllers[fileHash]?.signal,
      }); 

      return httpRes
   }

   // 文件上传
   const uploadFile = async (fileInfo) => {
      // 获取文件信息
      const { file, fileHash } = fileInfo
      // 获取文件分块
      const chunks = craeteChunk(file, fileInfo.uploadedChunks, data.chunkSize);
      // 获取文件分块总数量
      const totalChunks = Math.ceil(file.size / data.CHUNK_SIZE);

      // 检查已上传的分片
      const httpRes = await http({
         url: '/api/file/check',
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
      controller[fileHash] = controller;

      //开始上传当前文件逐片上传
      for  (let i = 0; i < chunks.length; i++) {
         //如果当前文件处于暂停状态，则跳过当前文件
         if(fileInfo.status === 'paused'){
            controller.abort()
            break
         }
         // 逐片上传
         const success = await uploadChunk(chunks[i], fileHash, file);

         if(success){
            fileInfo.uploadedChunks.push(chunks[i].index)
            const progress = Math.round((fileInfo.uploadedChunks.length / chunks.length) * 100)
         }else{
            return
         }
      }

   }

   self.postMessage({ status: 'success', data: chunks });
};