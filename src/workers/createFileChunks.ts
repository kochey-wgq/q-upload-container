
 
self.onmessage = async ({ data }) => {
   console.log('worker from createFileChunks:', data);

   const { file, uploadedChunks = [], chunkSize} = data;

   // 创建文件切片
   // 切片集
   const chunks = [];
   //初始切头
   let start = 0;
   // 初始切尾
   let end = Math.min(chunkSize, file.size);
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
      end = Math.min(start + chunkSize, file.size);
      chunkIndex++;
   }
 
 

   self.postMessage({ status: 'success', data: chunks});
};